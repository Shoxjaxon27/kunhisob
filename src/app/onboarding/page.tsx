import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { requireUser } from "@/server/auth/current";

export const metadata: Metadata = { title: "Boshlang‘ich sozlash" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboarded) redirect("/");
  return <OnboardingWizard initialName={user.name} />;
}
