"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  creditBalances,
  creditPurchases,
  aiUsageLog,
} from "@/drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { getStripe } from "@/lib/stripe";
import { isValidPackAmount, CREDIT_PACKS } from "@/lib/credit-packs";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function getCreditBalance(): Promise<number> {
  const userId = await requireUserId();
  const balance = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.userId, userId),
    columns: { balanceCents: true },
  });
  return balance?.balanceCents ?? 0;
}

export async function createCheckoutSession(
  amountCents: number
): Promise<{ url: string } | { error: string }> {
  const userId = await requireUserId();

  if (!isValidPackAmount(amountCents)) {
    return { error: "Invalid credit pack amount" };
  }

  const pack = CREDIT_PACKS.find((p) => p.amountCents === amountCents);
  if (!pack) {
    return { error: "Invalid credit pack" };
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `AI Credits - ${pack.label}`,
            description: `${(pack.creditsCents / 100).toFixed(2)} in AI credits`,
          },
          unit_amount: pack.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      creditsCents: String(pack.creditsCents),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/credits?result=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/credits?result=canceled`,
  });

  if (!session.url) {
    return { error: "Failed to create checkout session" };
  }

  return { url: session.url };
}

export async function getUsageHistory(
  page = 1,
  limit = 20
): Promise<{
  entries: Array<{
    id: string;
    modelId: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    costCents: number;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  totalPages: number;
}> {
  const userId = await requireUserId();
  const offset = (page - 1) * limit;

  const [entries, countResult] = await Promise.all([
    db
      .select({
        id: aiUsageLog.id,
        modelId: aiUsageLog.modelId,
        provider: aiUsageLog.provider,
        promptTokens: aiUsageLog.promptTokens,
        completionTokens: aiUsageLog.completionTokens,
        costCents: aiUsageLog.costCents,
        createdAt: aiUsageLog.createdAt,
      })
      .from(aiUsageLog)
      .where(eq(aiUsageLog.userId, userId))
      .orderBy(desc(aiUsageLog.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(aiUsageLog)
      .where(eq(aiUsageLog.userId, userId)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  return {
    entries,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getUsageSummary(): Promise<
  Array<{ date: string; costCents: number }>
> {
  const userId = await requireUserId();

  const rows = await db
    .select({
      date: sql<string>`TO_CHAR(${aiUsageLog.createdAt}, 'YYYY-MM-DD')`,
      costCents: sql<number>`SUM(${aiUsageLog.costCents})`,
    })
    .from(aiUsageLog)
    .where(
      sql`${aiUsageLog.userId} = ${userId} AND ${aiUsageLog.createdAt} >= NOW() - INTERVAL '30 days'`
    )
    .groupBy(sql`TO_CHAR(${aiUsageLog.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${aiUsageLog.createdAt}, 'YYYY-MM-DD')`);

  return rows.map((r) => ({
    date: r.date,
    costCents: Number(r.costCents),
  }));
}

export async function getPurchaseHistory(): Promise<
  Array<{
    id: string;
    amountCents: number;
    creditsCents: number;
    status: string;
    createdAt: Date;
  }>
> {
  const userId = await requireUserId();

  return db
    .select({
      id: creditPurchases.id,
      amountCents: creditPurchases.amountCents,
      creditsCents: creditPurchases.creditsCents,
      status: creditPurchases.status,
      createdAt: creditPurchases.createdAt,
    })
    .from(creditPurchases)
    .where(eq(creditPurchases.userId, userId))
    .orderBy(desc(creditPurchases.createdAt));
}

export async function getAiAccessInfo(): Promise<{
  hasGroqKey: boolean;
  creditBalanceCents: number;
  mode: "byok" | "credits" | "none";
}> {
  const userId = await requireUserId();

  const [user, balance] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { groqApiKey: true },
    }),
    db.query.creditBalances.findFirst({
      where: eq(creditBalances.userId, userId),
      columns: { balanceCents: true },
    }),
  ]);

  let hasGroqKey = false;
  if (user?.groqApiKey) {
    try {
      decrypt(user.groqApiKey);
      hasGroqKey = true;
    } catch {
      // Decryption failed — treat as no key
    }
  }

  const creditBalanceCents = balance?.balanceCents ?? 0;

  let mode: "byok" | "credits" | "none" = "none";
  if (hasGroqKey) {
    mode = "byok";
  } else if (creditBalanceCents > 0) {
    mode = "credits";
  }

  return { hasGroqKey, creditBalanceCents, mode };
}
