CREATE TABLE "subreddit_fetch_status" (
	"name" varchar(100) PRIMARY KEY NOT NULL,
	"last_fetched_at" timestamp,
	"refresh_interval_minutes" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
