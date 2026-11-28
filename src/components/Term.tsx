"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "@/core/glossary";

const WIDTH = 288;

/**
 * A term with a short explanation (P-038: tooltips for colour terms). The term
 * is a button, so it works with the keyboard and on touch: hover, focus or a
 * tap shows the explanation; Escape, moving away or scrolling hides it. Screen
 * readers get the explanation through aria-describedby. The open explanation is
 * placed with fixed positioning, so a scrolling box (the colour table) cannot
 * clip it.
 */
export function Term({ k, children }: { k: GlossaryKey; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setAt({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)) });
  };
  const hide = () => setAt(null);

  useEffect(() => {
    if (!at) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [at]);

  return (
    <span className="relative inline-block">
      <button
        ref={ref}
        type="button"
        aria-describedby={id}
        aria-expanded={at !== null}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (at ? hide() : show())}
        onKeyDown={(e) => {
          if (e.key === "Escape" && at) {
            // Handled here, so an enclosing widget does not close as well.
            e.preventDefault();
            hide();
          }
        }}
        className="cursor-help border-b border-dotted border-current bg-transparent p-0 text-inherit"
      >
        {children}
      </button>
      <span
        id={id}
        role="tooltip"
        // Kept out of the term's name (a table heading stays "OKLCH"); screen readers get it through aria-describedby.
        aria-hidden="true"
        style={at ? { position: "fixed", top: at.top, left: at.left, width: WIDTH } : undefined}
        className={`z-50 rounded-md border border-line bg-page p-2 text-left text-sm font-normal whitespace-normal text-ink shadow-[0_4px_12px_oklch(0_0_0/0.15)] ${at ? "" : "sr-only"}`}
      >
        {GLOSSARY[k]}
      </span>
    </span>
  );
}
