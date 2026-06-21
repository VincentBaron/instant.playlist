CREATE TABLE "pattern_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern_id" integer NOT NULL,
	"voter_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"lineup_slug" text NOT NULL,
	"bg_from" text NOT NULL,
	"bg_to" text NOT NULL,
	"accent" text NOT NULL,
	"grain" integer DEFAULT 9 NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patterns_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pattern_votes_pattern_voter_uniq" ON "pattern_votes" USING btree ("pattern_id","voter_hash");--> statement-breakpoint
CREATE INDEX "patterns_lineup_slug_idx" ON "patterns" USING btree ("lineup_slug");