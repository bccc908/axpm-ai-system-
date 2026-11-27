"use client";

import { useEffect } from "react";

let specificTitle: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Sets `{title} · KD` while mounted. Shell falls back when this is cleared. */
export function usePageDocumentTitle(title: string) {
  useEffect(() => {
    specificTitle = title;
    emit();
    return () => {
      if (specificTitle === title) {
        specificTitle = null;
        emit();
      }
    };
  }, [title]);
}

export function useShellDocumentTitle(navTitle: string | null, fallback: string) {
  useEffect(() => {
    const apply = () => {
      const page = specificTitle ?? navTitle;
      document.title = page ? `${page} · KD` : fallback;
    };
    apply();
    listeners.add(apply);
    return () => {
      listeners.delete(apply);
    };
  }, [navTitle, fallback]);
}
