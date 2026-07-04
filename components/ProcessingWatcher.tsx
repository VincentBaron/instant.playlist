"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While a lineup is still resolving, periodically re-fetch this server-rendered page. */
export default function ProcessingWatcher({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
