import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-forms";
import { getDb } from "@/server/db";
import { getSessionUser } from "@/server/auth/current";

export const metadata: Metadata = { title: "Kirish" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(user.onboarded ? "/" : "/onboarding");
  // Birinchi ishga tushirish: hali foydalanuvchi yo'q — ro'yxatdan o'tish.
  if ((await getDb().user.count()) === 0) redirect("/register");
  return <LoginForm />;
}
