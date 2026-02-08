ALTER TABLE "credit_purchases" ALTER COLUMN "stripe_session_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "credit_purchases_user_id_idx" ON "credit_purchases" USING btree ("user_id");