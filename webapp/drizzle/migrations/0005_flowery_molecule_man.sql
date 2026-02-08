CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reddit_id" varchar(20) NOT NULL,
	"post_reddit_id" varchar(20) NOT NULL,
	"parent_reddit_id" varchar(20),
	"author" varchar(100) NOT NULL,
	"body" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"reddit_created_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comments_reddit_id_unique" UNIQUE("reddit_id")
);
--> statement-breakpoint
CREATE INDEX "comments_post_reddit_id_idx" ON "comments" USING btree ("post_reddit_id");