"use client";

import Link from "next/link";

// Click-through is the demand signal for whether discovery (browse) is worth building out — YOL-34.
export default function BrowseAllLink({ count }: { count: number }) {
  function track() {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "browse_all_click" }),
      keepalive: true,
    }).catch(() => {
      /* best-effort — never block navigation on this */
    });
  }

  return (
    <Link
      href="/browse"
      onClick={track}
      className="font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-acid"
    >
      browse all {count} →
    </Link>
  );
}
