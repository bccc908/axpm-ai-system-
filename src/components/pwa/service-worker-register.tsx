"use client";

import { useEffect } from "react";

/** Registers /sw.js once per page load. Production only, so dev reloads stay fresh. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* install hints still work without it */
    });
  }, []);
  return null;
}
