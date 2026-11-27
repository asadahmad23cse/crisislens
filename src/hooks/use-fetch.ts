"use client";

import { useEffect, useState } from "react";

export function useFetch<T>(url: string | null): {
  data: T | null;
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: !!url,
    error: null,
  });

  useEffect(() => {
    if (!url) {
      return;
    }
    let cancelled = false;
    const abortController = new AbortController();
    // Trigger fetch via state update from async callback (not sync setState in effect)
    const run = async () => {
      try {
        const r = await fetch(url, { signal: abortController.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (cancelled) return;
        setState({ data: json, loading: false, error: null });
      } catch (e: any) {
        if (cancelled || abortController.signal.aborted) return;
        setState({ data: null, loading: false, error: e?.message ?? "fetch failed" });
      }
    };
    run();
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [url]);

  return state;
}
