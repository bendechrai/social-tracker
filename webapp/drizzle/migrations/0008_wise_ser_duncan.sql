ALTER TABLE "users" ADD COLUMN "profile_role" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_company" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_goal" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_tone" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_context" text;