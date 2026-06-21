"use client";

import { useState } from "react";

/*
 * Share (copy link / native share sheet) + the downloadable QR. Client-side because
 * it reads window.location and the clipboard. The QR is pre-rendered server-side.
 */
export default function ShareControls({
  qrDataUrl,
  slug,
  title,
}: {
  qrDataUrl: string;
  slug: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user dismissed the sheet — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — nothing we can do */
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center border border-line px-4 py-2 font-mono text-xs uppercase tracking-widest text-paper transition-colors hover:border-acid hover:text-acid"
        >
          {copied ? "link copied" : "share"}
        </button>
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="inline-flex items-center border border-line px-4 py-2 font-mono text-xs uppercase tracking-widest text-paper transition-colors hover:border-acid hover:text-acid"
        >
          {showQr ? "hide qr" : "qr"}
        </button>
      </div>

      {showQr && (
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL, no optimization needed */}
          <img src={qrDataUrl} alt={`QR code for ${title}`} className="h-40 w-40" />
          <a
            href={qrDataUrl}
            download={`${slug}-qr.png`}
            className="font-mono text-[10px] uppercase tracking-widest text-muted underline"
          >
            download qr
          </a>
        </div>
      )}
    </div>
  );
}
