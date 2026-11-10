import type { Db, DbLike } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { computeBalances } from "@/domain/ledger";
import { MoneyError, isCurrency, parseMoney, type CurrencyCode } from "@/domain/money";
import { accountInputSchema, toFieldErrors, type AccountInput } from "@/lib/validation";

export type AccountDto = {
  id: string;
  name: string;
  type: "CASH" | "CARD" | "SAVINGS" | "OTHER";
  currency: CurrencyCode;
  openingBalance: bigint;
  balance: bigint;
  color: string;
  icon: string;
  archived: boolean;
};

/**
 * Hisob balanslarini ma'lumotlardan hisoblaydi (saqlangan balans yo'q):
 * opening + kirim − chiqim + o'tkazma(kirgan) − o'tkazma(chiqqan). O'chirilganlar hisobga olinmaydi.
 */
export async function getAccountBalances(
  db: DbLike,
  userId: string,
  accounts: ReadonlyArray<{ id: string; openingBalance: bigint }>,
): Promise<Map<string, bigint>> {
  const [tx, out, inc] = await Promise.all([
    db.transaction.groupBy({
      by: ["accountId", "flow"],
      where: { userId, deletedAt: null },
      _sum: { amount: true },
    }),
    db.transfer.groupBy({
      by: ["fromAccountId"],
      where: { userId, deletedAt: null },
      _sum: { fromAmount: true },
    }),
    db.transfer.groupBy({
      by: ["toAccountId"],
      where: { userId, deletedAt: null },
      _sum: { toAmount: true },
    }),
  ]);

  return computeBalances(
    accounts,
    tx.map((r) => ({ accountId: r.accountId, flow: r.flow, sum: r._sum.amount ?? 0n })),
    [
      ...out.map((r) => ({ accountId: r.fromAccountId, direction: "out" as const, sum: r._sum.fromAmount ?? 0n })),
      ...inc.map((r) => ({ accountId: r.toAccountId, direction: "in" as const, sum: r._sum.toAmount ?? 0n })),
    ],
  );
}

type AccountRow = {
  id: string;
  name: string;
  type: string;
  currency: string;
  openingBalance: bigint;
  color: string;
  icon: string;
  archivedAt: Date | null;
};

function toDto(a: AccountRow, balance: bigint): AccountDto {
  return {
    id: a.id,
    name: a.name,
    type: a.type as AccountDto["type"],
    currency: (isCurrency(a.currency) ? a.currency : "UZS") as CurrencyCode,
    openingBalance: a.openingBalance,
    balance,
    color: a.color,
    icon: a.icon,
    archived: a.archivedAt !== null,
  };
}

export async function listAccounts(
  db: Db,
  userId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<AccountDto[]> {
  const rows = await db.account.findMany({
    where: { userId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const balances = await getAccountBalances(db, userId, rows);
  return rows.map((r) => toDto(r, balances.get(r.id) ?? r.openingBalance));
}

export async function getAccount(db: Db, userId: string, id: string): Promise<AccountDto> {
  const row = await db.account.findFirst({ where: { id, userId } });
  if (!row) throw new AppError("not_found", "Hisob topilmadi");
  const balances = await getAccountBalances(db, userId, [row]);
  return toDto(row, balances.get(row.id) ?? row.openingBalance);
}

function parseInput(input: unknown): AccountInput {
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("validation", "Ma’lumotlar noto‘g‘ri", toFieldErrors(parsed.error));
  }
  return parsed.data;
}

function parseOpening(text: string, currency: CurrencyCode): bigint {
  const raw = text.trim() === "" ? "0" : text;
  try {
    return parseMoney(raw, currency);
  } catch (e) {
    if (e instanceof MoneyError) {
      throw new AppError("validation", "Boshlang‘ich balans noto‘g‘ri", { openingBalance: "Summa noto‘g‘ri" });
    }
    throw e;
  }
}

export async function createAccount(db: Db, userId: string, input: unknown): Promise<AccountDto> {
  const data = parseInput(input);
  const opening = parseOpening(data.openingBalance, data.currency);
  const last = await db.account.aggregate({ where: { userId }, _max: { sortOrder: true } });
  const row = await db.account.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      currency: data.currency,
      openingBalance: opening,
      color: data.color,
      icon: data.icon,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });
  await writeAudit(db, userId, "account", row.id, "create", undefined, { ...data, openingBalance: opening });
  return toDto(row, opening);
}

export async function updateAccount(db: Db, userId: string, id: string, input: unknown): Promise<AccountDto> {
  const data = parseInput(input);
  const existing = await db.account.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError("not_found", "Hisob topilmadi");

  if (existing.currency !== data.currency) {
    const [tx, tr] = await Promise.all([
      db.transaction.count({ where: { accountId: id, userId } }),
      db.transfer.count({ where: { userId, OR: [{ fromAccountId: id }, { toAccountId: id }] } }),
    ]);
    if (tx + tr > 0) {
      throw new AppError("conflict", "Harakatlari bor hisobning valyutasini o‘zgartirib bo‘lmaydi", {
        currency: "Valyutani o‘zgartirib bo‘lmaydi",
      });
    }
  }

  const opening = parseOpening(data.openingBalance, data.currency);
  const row = await db.account.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type,
      currency: data.currency,
      openingBalance: opening,
      color: data.color,
      icon: data.icon,
    },
  });
  await writeAudit(
    db,
    userId,
    "account",
    id,
    "update",
    { name: existing.name, openingBalance: existing.openingBalance, currency: existing.currency },
    { ...data, openingBalance: opening },
  );
  const balances = await getAccountBalances(db, userId, [row]);
  return toDto(row, balances.get(row.id) ?? opening);
}

export async function setAccountArchived(db: Db, userId: string, id: string, archived: boolean): Promise<void> {
  const existing = await db.account.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError("not_found", "Hisob topilmadi");
  if (archived) {
    const active = await db.account.count({ where: { userId, archivedAt: null } });
    if (active <= 1 && existing.archivedAt === null) {
      throw new AppError("conflict", "Kamida bitta faol hisob qolishi kerak");
    }
  }
  await db.account.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await writeAudit(db, userId, "account", id, archived ? "archive" : "unarchive");
}

/** Faqat hech qanday harakati yo'q hisobni to'liq o'chiradi; aks holda arxivlash kerak. */
export async function deleteAccount(db: Db, userId: string, id: string): Promise<void> {
  const existing = await db.account.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError("not_found", "Hisob topilmadi");
  const [tx, tr] = await Promise.all([
    db.transaction.count({ where: { accountId: id, userId } }),
    db.transfer.count({ where: { userId, OR: [{ fromAccountId: id }, { toAccountId: id }] } }),
  ]);
  if (tx + tr > 0) {
    throw new AppError("conflict", "Harakatlari bor hisobni o‘chirib bo‘lmaydi — arxivlang");
  }
  await db.account.delete({ where: { id } });
}
