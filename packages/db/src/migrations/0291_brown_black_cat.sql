ALTER TABLE "agent_api_keys" ADD COLUMN "key_prefix" text NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD COLUMN "previous_key_hash" text;