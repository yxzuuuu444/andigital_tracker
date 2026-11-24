"use client";

import { useEffect } from "react";

/** Applies the saved light/dark choice on load. */
export function ThemeInit() {
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("andigital.theme");
      if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}
