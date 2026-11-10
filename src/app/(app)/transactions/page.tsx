import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listFeed } from "@/server/services/feed";
import { listAccounts } from "@/server/services/accounts";
import { listCategories } from "@/server/services/categories";
import { dayKeyOf, isDayKey, isRangePreset, rangeForPreset } from "@/domain/time";
import { FEED_TYPES, type FeedType } from "@/lib/validation";
import { TransactionsView } from "@/components/transactions/transactions-view";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireOnboardedUser();
  const sp = await searchParams;
  const db = getDb();
  const now = new Date();

  const q = one(sp.q).slice(0, 100);
  const typeRaw = one(sp.type);
  const type = (FEED_TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as FeedType) : undefined;
  const preset = one(sp.range);
  let from = one(sp.from);
  let to = one(sp.to);
  if (isRangePreset(preset)) ({ from, to } = rangeForPreset(preset, now));
  if (!isDayKey(from)) from = "";
  if (!isDayKey(to)) to = "";
  const limitRaw = Number(one(sp.limit));
  const limit = Number.isInteger(limitRaw) && limitRaw >= 40 && limitRaw <= 500 ? limitRaw : 40;
  const accountId = one(sp.accountId) || undefined;
  const categoryId = one(sp.categoryId) || undefined;

  const [feed, accounts, categories] = await Promise.all([
    listFeed(db, user.id, { q, type, accountId, categoryId, from: from || undefined, to: to || undefined, limit }),
    listAccounts(db, user.id),
    listCategories(db, user.id, { includeArchived: true }),
  ]);

  return (
    <TransactionsView
      items={feed.items}
      hasMore={feed.hasMore}
      limit={limit}
      todayKey={dayKeyOf(now)}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      filters={{ q, type: type ?? "", accountId: accountId ?? "", categoryId: categoryId ?? "", from, to, range: isRangePreset(preset) ? preset : "" }}
    />
  );
}
