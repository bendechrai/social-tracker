ALTER TABLE "posts" ADD COLUMN "is_nsfw" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "show_nsfw" boolean DEFAULT false NOT NULL;