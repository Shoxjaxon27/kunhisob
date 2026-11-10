import type { Db, DbLike } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { categoryInputSchema, toFieldErrors, type CategoryInput } from "@/lib/validation";

export type CategoryDto = {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  color: string;
  icon: string;
  archived: boolean;
};

export const DEFAULT_EXPENSE_CATEGORIES: ReadonlyArray<{ name: string; color: string; icon: string }> = [
  { name: "Oziq-ovqat", color: "#f97316", icon: "shopping-basket" },
  { name: "Transport", color: "#0ea5e9", icon: "car" },
  { name: "Uy-joy va kommunal", color: "#14b8a6", icon: "home" },
  { name: "Aloqa va internet", color: "#6366f1", icon: "wifi" },
  { name: "Sog‘liq", color: "#ef4444", icon: "heart-pulse" },
  { name: "Kiyim-kechak", color: "#ec4899", icon: "shirt" },
  { name: "Ta’lim", color: "#8b5cf6", icon: "graduation-cap" },
  { name: "Ko‘ngilochar", color: "#eab308", icon: "clapperboard" },
  { name: "Restoran va kafe", color: "#f43f5e", icon: "utensils" },
  { name: "Sovg‘alar", color: "#d946ef", icon: "gift" },
  { name: "Oila", color: "#22c55e", icon: "users" },
  { name: "Boshqa xarajat", color: "#64748b", icon: "tag" },
];

export const DEFAULT_INCOME_CATEGORIES: ReadonlyArray<{ name: string; color: string; icon: string }> = [
  { name: "Maosh", color: "#10b981", icon: "banknote" },
  { name: "Qo‘shimcha daromad", color: "#06b6d4", icon: "sparkles" },
  { name: "Biznes", color: "#84cc16", icon: "briefcase" },
  { name: "Sovg‘a va yordam", color: "#a855f7", icon: "gift" },
  { name: "Boshqa daromad", color: "#64748b", icon: "trending-up" },
];

type Row = { id: string; name: string; kind: string; color: string; icon: string; archivedAt: Date | null };

function toDto(c: Row): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind as "INCOME" | "EXPENSE",
    color: c.color,
    icon: c.icon,
    archived: c.archivedAt !== null,
  };
}

export async function seedDefaultCategories(db: DbLike, userId: string): Promise<void> {
  const rows = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ ...c, kind: "EXPENSE" as const, sortOrder: i })),
    ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ ...c, kind: "INCOME" as const, sortOrder: i })),
  ];
  for (const r of rows) {
    await db.category.upsert({
      where: { userId_kind_name: { userId, kind: r.kind, name: r.name } },
      update: {},
      create: { userId, ...r },
    });
  }
}

export async function listCategories(
  db: Db,
  userId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<CategoryDto[]> {
  const rows = await db.category.findMany({
    where: { userId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(toDto);
}

function parse(input: unknown): CategoryInput {
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("validation", "Ma’lumotlar noto‘g‘ri", toFieldErrors(parsed.error));
  }
  return parsed.data;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export async function createCategory(db: Db, userId: string, input: unknown): Promise<CategoryDto> {
  const data = parse(input);
  const last = await db.category.aggregate({ where: { userId, kind: data.kind }, _max: { sortOrder: true } });
  try {
    const row = await db.category.create({
      data: { userId, ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    await writeAudit(db, userId, "category", row.id, "create", undefined, data);
    return toDto(row);
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new AppError("conflict", "Bunday nomli kategoriya allaqachon bor", { name: "Bunday nom band" });
    }
    throw e;
  }
}

export async function updateCategory(db: Db, userId: string, id: string, input: unknown): Promise<CategoryDto> {
  const data = parse(input);
  const existing = await db.category.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError("not_found", "Kategoriya topilmadi");
  if (existing.kind !== data.kind) {
    const used = await db.transaction.count({ where: { categoryId: id, userId } });
    if (used > 0) {
      throw new AppError("conflict", "Tranzaksiyalari bor kategoriyaning turini o‘zgartirib bo‘lmaydi", {
        kind: "Turini o‘zgartirib bo‘lmaydi",
      });
    }
  }
  try {
    const row = await db.category.update({ where: { id }, data });
    await writeAudit(db, userId, "category", id, "update", toDto(existing), data);
    return toDto(row);
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new AppError("conflict", "Bunday nomli kategoriya allaqachon bor", { name: "Bunday nom band" });
    }
    throw e;
  }
}

export async function setCategoryArchived(db: Db, userId: string, id: string, archived: boolean): Promise<void> {
  const existing = await db.category.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError("not_found", "Kategoriya topilmadi");
  await db.category.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await writeAudit(db, userId, "category", id, archived ? "archive" : "unarchive");
}
