import { NextResponse } from "next/server";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

/** Tirikligini tekshirish: bazaga oddiy so'rov. Hech qanday ma'lumot yoki sir qaytarmaydi. */
export async function GET(): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  try {
    await getDb().$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503, headers });
  }
}
