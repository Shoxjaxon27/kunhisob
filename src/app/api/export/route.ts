import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { exportCsv } from "@/server/services/export";

export const dynamic = "force-dynamic";

/** CSV eksport: faqat tizimga kirgan foydalanuvchining o'z ma'lumotlari. */
export async function GET(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Kirish talab qilinadi", { status: 401, headers: { "Cache-Control": "no-store" } });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  try {
    const csv = await exportCsv(getDb(), user.id, from, to);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="finova-${from}_${to}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return new NextResponse(e.message, { status: 400, headers: { "Cache-Control": "no-store" } });
    return new NextResponse("Eksportda xatolik", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
