CREATE TABLE "email_global_suppressions" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"reason" text,
	"source" text DEFAULT 'operator' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_send_policies" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"require_human_approval" boolean DEFAULT true NOT NULL,
	"daily_limit" integer DEFAULT 100 NOT NULL,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_send_policies_daily_limit_check" CHECK ("email_send_policies"."daily_limit" between 1 and 100000)
);
--> statement-breakpoint
ALTER TABLE "email_sends" DROP CONSTRAINT "email_sends_outcome_check";--> statement-breakpoint
ALTER TABLE "email_sends" ADD COLUMN "approval_id" uuid;--> statement-breakpoint
ALTER TABLE "email_sends" ADD COLUMN "dry_run" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_send_policies" ADD CONSTRAINT "email_send_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_outcome_check" CHECK ("email_sends"."outcome" in ('queued', 'sent', 'delivered', 'failed', 'uncertain', 'dry_run'));