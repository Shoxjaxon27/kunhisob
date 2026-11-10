import type { Db } from "../db";
import { dayRange } from "@/domain/time";
import { isDayKey } from "@/domain/time";
import { isCurrency, type CurrencyCode } from "@/domain/money";
import type { FeedType } from "@/lib/validation";

export type FeedAccountRef = { id: string; name: string; color: string; icon: string };
export type FeedCategoryRef = { id: string; name: string; color: string; icon: string };

export type FeedTxItem = {
  kind: "tx";
  id: string;
  type: string;
  flow: "IN" | "OUT";
  amount: bigint;
  currency: CurrencyCode;
  occurredAt: Date;
  note: string;
  account: FeedAccountRef;
  category: FeedCategoryRef | null;
  tags: string[];
};

export type FeedTransferItem = {
  kind: "transfer";
  id: string;
  fromAmount: bigint;
  toAmount: bigint;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: string | null;
  occurredAt: Date;
  note: string;
  from: FeedAccountRef;
  to: FeedAccountRef;
};

export type FeedItem = FeedTxItem | FeedTransferItem;

export type FeedFilters = {
  q?: string;
  type?: FeedType;
  accountId?: string;
  categoryId?: string;
  /** Toshkent kuni, ikkala chekka kiradi. */
  from?: string;
  to?: string;
  limit?: number;
};

export const FEED_DEFAULT_LIMIT = 40;
export const FEED_MAX_LIMIT = 500;

const cur = (v: string): CurrencyCode => (isCurrency(v) ? v : "UZS");

export async function listFeed(
  db: Db,
  userId: string,
  filters: FeedFilters = {},
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(filters.limit ?? FEED_DEFAULT_LIMIT, 1), FEED_MAX_LIMIT);
  const q = filters.q?.trim() ?? "";

  const from = filters.from && isDayKey(filters.from) ? filters.from : undefined;
  const to = filters.to && isDayKey(filters.to) ? filters.to : undefined;
  let occurredAt: { gte?: Date; lt?: Date } | undefined;
  if (from || to) {
    occurredAt = {};
    if (from) occurredAt.gte = dayRange(from).start;
    if (to) occurredAt.lt = dayRange(to).end;
  }

  const txType = filters.type && filters.type !== "TRANSFER" ? filters.type : undefined;
  const wantTx = filters.type !== "TRANSFER";
  const wantTransfers = !filters.type || filters.type === "TRANSFER";
  const skipTransfersForCategory = Boolean(filters.categoryId);

  const [txRows, trRows] = await Promise.all([
    wantTx
      ? db.transaction.findMany({
          where: {
            userId,
            deletedAt: null,
            ...(txType ? { type: txType } : {}),
            ...(filters.accountId ? { accountId: filters.accountId } : {}),
            ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
            ...(occurredAt ? { occurredAt } : {}),
            ...(q
              ? {
                  OR: [
                    { note: { contains: q } },
                    { category: { is: { name: { contains: q } } } },
                    { account: { is: { name: { contains: q } } } },
                    { tags: { some: { name: { contains: q.replace(/^#/, "").toLowerCase() } } } },
                  ],
                }
              : {}),
          },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take: limit + 1,
          include: { account: true, category: true, tags: true },
        })
      : Promise.resolve([]),
    wantTransfers && !skipTransfersForCategory
      ? db.transfer.findMany({
          where: {
            userId,
            deletedAt: null,
            ...(occurredAt ? { occurredAt } : {}),
            AND: [
              ...(filters.accountId
                ? [{ OR: [{ fromAccountId: filters.accountId }, { toAccountId: filters.accountId }] }]
                : []),
              ...(q
                ? [
                    {
                      OR: [
                        { note: { contains: q } },
                        { fromAccount: { is: { name: { contains: q } } } },
                        { toAccount: { is: { name: { contains: q } } } },
                      ],
                    },
                  ]
                : []),
            ],
          },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take: limit + 1,
          include: { fromAccount: true, toAccount: true },
        })
      : Promise.resolve([]),
  ]);

  const items: FeedItem[] = [
    ...txRows.map(
      (t): FeedTxItem => ({
        kind: "tx",
        id: t.id,
        type: t.type,
        flow: t.flow,
        amount: t.amount,
        currency: cur(t.currency),
        occurredAt: t.occurredAt,
        note: t.note,
        account: { id: t.account.id, name: t.account.name, color: t.account.color, icon: t.account.icon },
        category: t.category
          ? { id: t.category.id, name: t.category.name, color: t.category.color, icon: t.category.icon }
          : null,
        tags: t.tags.map((x) => x.name).sort(),
      }),
    ),
    ...trRows.map(
      (t): FeedTransferItem => ({
        kind: "transfer",
        id: t.id,
        fromAmount: t.fromAmount,
        toAmount: t.toAmount,
        fromCurrency: cur(t.fromCurrency),
        toCurrency: cur(t.toCurrency),
        rate: t.rate,
        occurredAt: t.occurredAt,
        note: t.note,
        from: { id: t.fromAccount.id, name: t.fromAccount.name, color: t.fromAccount.color, icon: t.fromAccount.icon },
        to: { id: t.toAccount.id, name: t.toAccount.name, color: t.toAccount.color, icon: t.toAccount.icon },
      }),
    ),
  ];

  items.sort((a, b) => {
    const d = b.occurredAt.getTime() - a.occurredAt.getTime();
    return d !== 0 ? d : a.id < b.id ? 1 : -1;
  });

  return { items: items.slice(0, limit), hasMore: items.length > limit };
}
