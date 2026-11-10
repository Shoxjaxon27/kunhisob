import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/auth-forms";
import { getDb } from "@/server/db";
import { getSessionUser } from "@/server/auth/current";

export const metadata: Metadata = { title: "Ro‘yxatdan o‘tish" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect(user.onboarded ? "/" : "/onboarding");

  const hasUsers = (await getDb().user.count()) > 0;
  if (hasUsers && process.env.ALLOW_REGISTRATION !== "true") {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Ro‘yxatdan o‘tish yopiq</h2>
        <p className="text-ink-2">
          Bu o‘rnatma shaxsiy foydalanish uchun sozlangan va hisob allaqachon yaratilgan. Mavjud hisobingiz bilan kiring.
        </p>
        <Link href="/login" className="btn btn-primary">
          Kirish
        </Link>
      </div>
    );
  }
  return <RegisterForm />;
}
