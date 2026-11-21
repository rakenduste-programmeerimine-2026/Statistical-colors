"use client";

import { useEffect, useId, useState } from "react";
import { ThemePicker } from "./ThemePicker";
import { toOklch, useTheme } from "./ThemeProvider";

/**
 * The theme picker as a tab on the right edge that stays in view while the
 * page scrolls (#91: it used to sit at the top, so changing the theme meant
 * scrolling up). Closed it shows only the current colours; open it shows the
 * whole picker. Escape closes it.
 */
export function ThemeWidget() {
  const [open, setOpen] = useState(false);
  const { preview } = useTheme();
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <aside aria-label="Teema" className="fixed top-24 right-0 z-40 flex items-start">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex flex-col items-center gap-2 rounded-l-lg border border-r-0 border-line bg-page px-2 py-3 text-sm shadow-[0_2px_8px_oklch(0_0_0/0.12)]"
      >
        <span
          aria-hidden
          className="inline-block size-5 rounded-md border border-ink/25"
          style={{ background: `linear-gradient(90deg, ${toOklch(preview.bg)} 0 50%, ${toOklch(preview.text)} 50% 100%)` }}
        />
        <span className="[writing-mode:vertical-rl]">{open ? "Sulge teema" : "Teema"}</span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="max-h-[80vh] w-[min(40rem,calc(100vw-4rem))] overflow-auto rounded-bl-xl border border-r-0 border-line bg-page shadow-[0_4px_16px_oklch(0_0_0/0.15)]"
      >
        <ThemePicker />
      </div>
    </aside>
  );
}
