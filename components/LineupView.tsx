"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Artist, LineupRecord } from "@/types";
import { usePlayer, type QueueItem } from "@/components/player/PlayerProvider";

/*
 * THE signature: the lineup IS a playable poster. Name size encodes the set's BPM
 * (faster = bigger). The playing name lights --acid with an --ember pulse.
 *
 * Sortable (BPM by default / set time) and editable: an "edit times"
 * mode lets anyone at the festival add each act's slot — saved to the shared lineup.
 */

type SortKey = "bpm" | "time";
type Row = { artist: Artist; idx: number }; // idx = stable position in the stored array
type Draft = { setTime: string; setDay: string };

const SORTS: { key: SortKey; label: string }[] = [
  { key: "bpm", label: "BPM" },
  { key: "time", label: "Set time" },
];

/** Size comes from the set's tempo (top-tracks-only acts have no set → unknown). */
function artistBpm(a: Artist): number | null {
  return a.set?.bpm ?? null;
}

/** "HH:MM" → minutes since midnight, or null when absent/malformed. */
function timeMinutes(t: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Poster sizing encodes tempo: faster sets read bigger. Continuous fluid size via clamp()
// (Tailwind's discrete text-* steps can't express a proportional scale); unknown → smallest.
function fontSizeFor(bpm: number | null): string {
  if (bpm == null) return "clamp(1rem, 3vw, 1.25rem)"; // unknown tempo → smallest
  const t = Math.min(1, Math.max(0, (bpm - 100) / (175 - 100))); // clamp domain 100–175 BPM
  const lerp = (a: number, b: number) => (a + (b - a) * t).toFixed(2);
  return `clamp(${lerp(1.0, 2.5)}rem, ${lerp(4, 10)}vw, ${lerp(1.25, 5.0)}rem)`;
}

/** Order rows for display. Sorting never drops acts (set-time keeps untimed at the end). */
function sortRows(rows: Row[], sort: SortKey): Row[] {
  if (sort === "bpm") {
    return [...rows].sort((a, b) => {
      const ba = artistBpm(a.artist);
      const bb = artistBpm(b.artist);
      if (ba == null && bb == null) return a.idx - b.idx;
      if (ba == null) return 1; // unknown tempo sinks to the bottom
      if (bb == null) return -1;
      return bb - ba || a.idx - b.idx; // faster first; stable by poster order
    });
  }

  // sort === "time": chronological. Rank days by first appearance in poster order so a
  // multi-day bill reads day-by-day; untimed acts keep poster order at the end.
  const dayRank = new Map<string, number>();
  for (const { artist } of rows) {
    if (artist.setDay && !dayRank.has(artist.setDay)) dayRank.set(artist.setDay, dayRank.size);
  }
  const timed = rows.filter((r) => r.artist.setTime);
  const untimed = rows.filter((r) => !r.artist.setTime);
  timed.sort((a, b) => {
    const da = a.artist.setDay ? (dayRank.get(a.artist.setDay) ?? 999) : 999;
    const db = b.artist.setDay ? (dayRank.get(b.artist.setDay) ?? 999) : 999;
    return da - db || timeMinutes(a.artist.setTime)! - timeMinutes(b.artist.setTime)!;
  });
  return [...timed, ...untimed];
}

type BuiltQueue = { items: QueueItem[]; firstIndexByIdx: Map<number, number> };

/** Build the play queue in the *displayed* order so a tap continues down the visible list. */
function buildQueue(rows: Row[]): BuiltQueue {
  const items: QueueItem[] = [];
  const firstIndexByIdx = new Map<number, number>();
  for (const { artist, idx } of rows) {
    const tracks = artist.set ? [artist.set] : artist.topTracks;
    if (tracks.length === 0) {
      firstIndexByIdx.set(idx, -1); // non-playable
      continue;
    }
    firstIndexByIdx.set(idx, items.length);
    for (const t of tracks) {
      items.push({
        url: t.url,
        title: t.title,
        artist: artist.name,
        durationMin: t.durationMin,
        artworkUrl: t.artworkUrl,
      });
    }
  }
  return { items, firstIndexByIdx };
}

export default function LineupView({
  lineup,
  autoPlay = false,
}: {
  lineup: LineupRecord;
  autoPlay?: boolean;
}) {
  const player = usePlayer();
  // Local source of truth so crowd edits show instantly without a full page reload.
  const [artists, setArtists] = useState<Artist[]>(lineup.artists);
  const [sort, setSort] = useState<SortKey>("bpm");
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(
    () => sortRows(artists.map((artist, idx) => ({ artist, idx })), sort),
    [artists, sort],
  );
  const { items, firstIndexByIdx } = useMemo(() => buildQueue(ordered), [ordered]);

  // Active highlight by track URL — survives re-sorting (the player owns its own queue).
  const playingUrl =
    player.queueId === lineup.slug ? (player.current?.url ?? null) : null;
  const isActive = (a: Artist): boolean => {
    if (!playingUrl) return false;
    return a.set ? a.set.url === playingUrl : a.topTracks.some((t) => t.url === playingUrl);
  };

  // Autoplay-on-arrival: a scattered home-page name links here with ?play=1 so the first
  // set starts on load. Fires once (ref guard), and only if this lineup isn't already the
  // active queue — so back-navigation with the param still present doesn't restart it.
  // items[0] is the first *playable* act in the displayed (BPM) order.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !autoPlay || items.length === 0) return;
    if (player.queueId === lineup.slug) return;
    autoStarted.current = true;
    player.playQueue(lineup.slug, items, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  function startEditing() {
    const next: Record<number, Draft> = {};
    artists.forEach((a, i) => {
      next[i] = { setTime: a.setTime ?? "", setDay: a.setDay ?? "" };
    });
    setDrafts(next);
    setError(null);
    setEditing(true);
  }

  function patchDraft(i: number, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [i]: { ...(d[i] ?? { setTime: "", setDay: "" }), ...patch } }));
  }

  async function saveTimes() {
    // Only send rows whose time/day actually changed.
    const edits = artists
      .map((a, i) => {
        const dr = drafts[i] ?? { setTime: a.setTime ?? "", setDay: a.setDay ?? "" };
        const setTime = dr.setTime.trim() || null;
        const setDay = dr.setDay.trim() || null;
        return { index: i, setTime, setDay };
      })
      .filter((e) => {
        const a = artists[e.index];
        return (a.setTime ?? null) !== e.setTime || (a.setDay ?? null) !== e.setDay;
      });

    if (edits.length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/lineups/${lineup.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "couldn't save times");
      }
      const { lineup: updated } = (await res.json()) as { lineup: LineupRecord };
      setArtists(updated.artists);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't save times");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* controls: sort + edit */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-widest">
        {!editing && (
          <div className="flex items-center gap-3">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={
                  sort === s.key
                    ? "text-acid"
                    : "text-paper/40 transition-colors hover:text-paper"
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {editing ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveTimes}
              disabled={saving}
              className="text-acid disabled:opacity-50"
            >
              {saving ? "saving…" : "save times"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={saving}
              className="text-paper/40 transition-colors hover:text-paper disabled:opacity-50"
            >
              cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="text-paper/40 transition-colors hover:text-acid"
          >
            ✎ edit times
          </button>
        )}
      </div>

      {error && <p className="font-mono text-xs text-ember">{error}</p>}

      {editing ? (
        // Edit mode — over the dimmed poster, assign each act its slot (great on-site).
        <div className="flex w-full max-w-md flex-col gap-1">
          {artists.map((a, i) => (
            <div
              key={`${a.name}-${i}`}
              className="flex items-center gap-2 border-b border-line/20 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate font-display text-sm font-bold uppercase">
                {a.name}
              </span>
              <input
                type="text"
                placeholder="day"
                maxLength={24}
                value={drafts[i]?.setDay ?? ""}
                onChange={(e) => patchDraft(i, { setDay: e.target.value })}
                className="w-16 border-b border-line bg-transparent px-1 py-0.5 font-mono text-xs text-paper placeholder:text-muted/50 focus:border-acid focus:outline-none"
              />
              <input
                type="time"
                value={drafts[i]?.setTime ?? ""}
                onChange={(e) => patchDraft(i, { setTime: e.target.value })}
                className="border-b border-line bg-transparent px-1 py-0.5 font-mono text-xs text-paper focus:border-acid focus:outline-none"
              />
            </div>
          ))}
        </div>
      ) : (
        // Read mode — the playable poster, ordered by the active sort.
        <div className="flex flex-col items-center gap-y-1 text-center">
          {ordered.map(({ artist, idx }) => {
            const playable = (firstIndexByIdx.get(idx) ?? -1) >= 0;
            const active = isActive(artist);
            const bpm = artistBpm(artist);
            return (
              <div key={`${artist.name}-${idx}`} className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={!playable}
                  onClick={() =>
                    playable &&
                    player.playQueue(lineup.slug, items, firstIndexByIdx.get(idx)!)
                  }
                  style={{ fontSize: fontSizeFor(bpm) }}
                  className={[
                    "relative inline-block font-display font-black uppercase leading-[0.95] tracking-tight transition-colors",
                    active
                      ? "text-acid"
                      : playable
                        ? "text-paper hover:text-acid"
                        : "cursor-default text-muted/50",
                  ].join(" ")}
                >
                  {artist.name}
                  {bpm != null && (
                    // the machine's footnote: BPM, anchored to the right of the name
                    // (absolute so it never shifts the centered name off-center).
                    <span className="absolute left-full top-1/2 ml-2 flex -translate-y-1/2 items-center">
                      <span className="font-mono text-xs font-normal text-muted/70">{bpm}</span>
                    </span>
                  )}
                </button>
                {artist.setTime && (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    {artist.setDay ? `${artist.setDay} · ` : ""}
                    {artist.setTime}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
