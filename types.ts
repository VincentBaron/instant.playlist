import { z } from "zod";

/*
 * Shared domain types. Zod schemas are the source of truth; TS types are inferred.
 * These describe what the resolve step (M3) produces and what the DB stores as JSON.
 *
 * A "Track" is any SoundCloud track we play — either a long DJ `set` or a fallback
 * top track. (Named Track, not Set, to avoid shadowing the JS built-in Set.)
 */
export const TrackSchema = z.object({
  title: z.string(),
  url: z.string().url(), // SoundCloud permalink — drives the widget + the external link
  durationMin: z.number().int().nonnegative(), // rounded minutes
  artworkUrl: z.string().url().nullable(),
  bpm: z.number().nullable().default(null), // BPM (explicit field or genre-inferred); null = unknown
});
export type Track = z.infer<typeof TrackSchema>;

export const ArtistSchema = z.object({
  name: z.string(), // as read off the poster
  profileUrl: z.string().url().nullable(), // SoundCloud profile (null if not found)
  username: z.string().nullable(), // exact SoundCloud account name
  set: TrackSchema.nullable(), // latest long set (null if none)
  topTracks: z.array(TrackSchema), // fallback: top tracks when there's no long set
  // Festival schedule slot — read off the poster (M2) or crowd-added later. null = unknown.
  setTime: z.string().nullable().default(null), // 24h "HH:MM" start time
  setDay: z.string().nullable().default(null), // short day label, e.g. "Fri"
});
export type Artist = z.infer<typeof ArtistSchema>;

export const ArtistsSchema = z.array(ArtistSchema);

/**
 * "processing" = poster read, SoundCloud resolution running in the background;
 * "ready" = fully resolved; "error" = background resolution failed.
 */
export type LineupStatus = "processing" | "ready" | "error";

/** A stored lineup, fully hydrated (public read returns this). */
export type LineupRecord = {
  id: number;
  slug: string; // stable public identifier, e.g. "tomorrowland-2026"
  title: string;
  festival: string | null;
  officialTicketUrl: string | null; // UTM-tagged official link; null for UGC scans
  createdAt: string; // ISO string
  artistCount: number;
  playableCount: number;
  artists: Artist[];
  posterImage: string | null; // dimmed poster backdrop (JPEG data URL); null for older/JSON lineups
  status: LineupStatus;
};

/** Lightweight lineup row for the public index (no artists blob, no heavy poster data URL). */
export type LineupSummary = Omit<LineupRecord, "artists" | "posterImage">;
