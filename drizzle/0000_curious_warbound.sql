CREATE TABLE "lineups" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"festival" text,
	"official_ticket_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"artist_count" integer NOT NULL,
	"playable_count" integer NOT NULL,
	"artists" jsonb NOT NULL,
	CONSTRAINT "lineups_slug_unique" UNIQUE("slug")
);
