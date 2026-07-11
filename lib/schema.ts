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
  genres: jsonb("genres").$type<string[]>().notNull().default([]), // ranked genre buckets, most-represented first
  artists: jsonb("artists").$type<Artist[]>().notNull(), // resolved Artist[]
  posterImage: text("poster_image"), // nullable: downscaled JPEG data URL for the faded backdrop
  // Who scanned this poster. Nullable: pre-auth (anonymous) lineups stay null; no
  // hard FK so a deleted user never cascades away a public, shareable lineup.
  ownerId: text("owner_id"),
});

/* ── Auth (better-auth) ──────────────────────────────────────────────────────────────
 * better-auth owns these four tables; shapes/field names follow its Drizzle adapter
 * defaults. String ids (better-auth generates them). Wired in lib/auth.ts via
 * `drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } })`.
 * If you change auth options that add columns (e.g. a plugin), re-run `db:generate`.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── Credits ledger ──────────────────────────────────────────────────────────────────
 * Append-only. A user's balance is SUM(delta) over their rows — transparent and
 * auditable (every free grant, upload spend, refund, and purchase is one row). Reasons:
 *   'signup_free'  +N once at first sight of the account (the free quota)
 *   'poster_upload' -1 per successful scan
 *   'refund'       +1 when a reserved scan failed (unreadable poster / build error)
 *   'purchase'     +N from a completed Buy Me a Coffee support/purchase
 * `idempotencyKey` (nullable, unique) dedupes one-shot grants: 'signup:<userId>' guards
 * the free grant; 'bmc:<paymentId>' makes the webhook safe to retry. Upload/refund rows
 * leave it null (Postgres allows many NULLs under a UNIQUE index).
 */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("credit_ledger_user_id_idx").on(t.userId)],
);

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
