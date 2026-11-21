"use client";

import { useId, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "@/core/glossary";

/**
 * A term with a short explanation (P-038: tooltips for colour terms). The term
 * is a button, so it works with the keyboard and on touch: hover, focus or a
 * tap shows the explanation; Escape or moving away hides it. The explanation is
 * also linked with aria-describedby for screen readers.
 */
export function Term({ k, children }: { k: GlossaryKey; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="cursor-help border-b border-dotted border-current bg-transparent p-0 text-inherit"
      >
        {children}
      </button>
      <span
        id={id}
        role="tooltip"
        // Kept out of the term's name (a table heading stays "OKLCH"); screen readers get it through aria-describedby.
        aria-hidden="true"
        className={`absolute top-full left-0 z-30 mt-1 w-72 rounded-md border border-line bg-page p-2 text-left text-sm font-normal whitespace-normal text-ink shadow-[0_4px_12px_oklch(0_0_0/0.15)] ${open ? "" : "sr-only"}`}
      >
        {GLOSSARY[k]}
      </span>
    </span>
  );
}
