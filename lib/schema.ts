import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Artist } from "@/types";

/*
 * One table is enough for the MVP. The pivot from the old local-SQLite spec adds a
 * stable public `slug` (the URL identity for shareable pages) and an optional
 * `official_ticket_url` (architected-for now; the money loop in M7).
 */
export const lineups = pgTable("lineups", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // public identifier in the URL
  title: text("title").notNull(), // derived label or festival name
  festival: text("festival"), // festival name from vision (null if unknown)
  officialTicketUrl: text("official_ticket_url"), // null for random UGC scans
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  artistCount: integer("artist_count").notNull(),
  playableCount: integer("playable_count").notNull(),
  artists: jsonb("artists").$type<Artist[]>().notNull(), // resolved Artist[]
  posterImage: text("poster_image"), // nullable: downscaled JPEG data URL for the faded backdrop
});

/*
 * Community "patterns" — anonymous, curated-color theme submissions per lineup. The
 * top-voted (non-archived) pattern is the lineup's default look. Identity is the secret
 * `token` (the creator's private link); voting is deduped by `pattern_votes`. Capped at
 * 10 live per lineup (oldest lowest-voted is archived when a new one is posted).
 */
export const patterns = pgTable(
  "patterns",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull().unique(), // secret — the creator's private status link
    lineupSlug: text("lineup_slug").notNull(),
    bgFrom: text("bg_from").notNull(), // gradient start (curated)
    bgTo: text("bg_to").notNull(), // gradient end (curated)
    accent: text("accent").notNull(), // --acid override (curated)
    grain: integer("grain").notNull().default(9), // grain × 100, stored as int
    votes: integer("votes").notNull().default(0), // denormalized counter (see pattern_votes)
    archived: boolean("archived").notNull().default(false), // evicted by the 10-cap
    selected: boolean("selected").notNull().default(false), // organiser picked it
    published: boolean("published").notNull().default(false), // organiser posted it to socials
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("patterns_lineup_slug_idx").on(t.lineupSlug)],
);

/*
 * One row per (pattern, voter) — the dedupe ledger behind the votes counter. voterHash =
 * sha256(ip|user-agent); paired with a client localStorage guard this is "1 vote/device +
 * IP". Not tamper-proof (no auth), but it raises the bar on rigging the default look.
 */
export const patternVotes = pgTable(
  "pattern_votes",
  {
    id: serial("id").primaryKey(),
    patternId: integer("pattern_id").notNull(),
    voterHash: text("voter_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("pattern_votes_pattern_voter_uniq").on(t.patternId, t.voterHash),
  ],
);
