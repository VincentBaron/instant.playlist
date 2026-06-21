import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
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
