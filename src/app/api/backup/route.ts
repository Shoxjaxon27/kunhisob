import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { buildBackup } from "@/server/services/backup";
import { dayKeyOf } from "@/domain/time";

export const dynamic = "force-dynamic";

/** To'liq JSON nusxa: faqat tizimga kirgan foydalanuvchining o'z ma'lumotlari. */
export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!user) return new NextResponse("Kirish talab qilinadi", { status: 401, headers });
  try {
    const now = new Date();
    const body = await buildBackup(getDb(), user.id, now);
    return new NextResponse(body, {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="finova-nusxa-${dayKeyOf(now)}.json"` },
    });
  } catch {
    return new NextResponse("Nusxa olishda xatolik", { status: 500, headers });
  }
}
