import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listAccounts } from "@/server/services/accounts";
import { AccountsView } from "@/components/accounts/accounts-view";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await requireOnboardedUser();
  const accounts = await listAccounts(getDb(), user.id, { includeArchived: true });
  return <AccountsView accounts={accounts} />;
}
