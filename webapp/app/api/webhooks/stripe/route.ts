import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { creditPurchases, creditBalances } from "@/drizzle/schema";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const creditsCents = Number(session.metadata?.creditsCents ?? 0);
    const amountCents = session.amount_total ?? 0;

    if (!userId || creditsCents <= 0) {
      console.error("Invalid webhook metadata:", session.metadata);
      return NextResponse.json({ received: true });
    }

    try {
      await db.transaction(async (tx) => {
        await tx
          .insert(creditPurchases)
          .values({
            userId,
            stripeSessionId: session.id,
            amountCents,
            creditsCents,
            status: "completed",
          })
          .onConflictDoNothing({ target: creditPurchases.stripeSessionId });

        await tx
          .insert(creditBalances)
          .values({
            userId,
            balanceCents: creditsCents,
          })
          .onConflictDoUpdate({
            target: creditBalances.userId,
            set: {
              balanceCents: sql\`\${creditBalances.balanceCents} + \${creditsCents}\`,
              updatedAt: new Date(),
            },
          });
      });
    } catch (err) {
      console.error("Error processing webhook:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
