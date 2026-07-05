import Link from "next/link";

/** The instant.playlist wordmark text. Always wrap it in a `Link href="/"` so it goes home. */
export function WordmarkText() {
  return (
    <>
      instant<span className="text-ember">.</span>playlist
    </>
  );
}

export default function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={className}>
      <WordmarkText />
    </Link>
  );
}
