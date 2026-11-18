"use client";

import { useId } from "react";
import { hexToOklch } from "@/core/color/oklch";

export interface BackgroundPreset {
  label: string;
  /** Null is the view's own default colour. */
  hex: string | null;
}

/** The colour a picked hex is drawn with: converted to OKLCH by the browser, like the theme (P-018 item 4). */
export const backgroundCss = (hex: string) => `oklch(from ${hex} l c h)`;

/**
 * A text colour that stays readable on a chosen background: near-black on
 * light backgrounds, near-white on dark ones (OKLCH lightness 0.6 is the turn).
 */
export function contrastInk(hex: string): string {
  return hexToOklch(hex).l < 0.6 ? "oklch(0.97 0 0)" : "oklch(0.18 0 0)";
}

interface Props {
  label: string;
  value: string | null;
  onChange: (hex: string | null) => void;
  presets: BackgroundPreset[];
  /** The colour input shows this when the default is chosen. */
  defaultHex: string;
  /** Tailwind class that paints the default swatch, e.g. "bg-stage". */
  defaultSwatch: string;
}

/** Background colour for a viewer: presets, any colour, or back to the default (P-037). */
export function BackgroundPicker({ label, value, onChange, presets, defaultHex, defaultSwatch }: Props) {
  const id = useId();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted">{label}:</span>
      {presets.map((p) => {
        const on = value === p.hex;
        return (
          <button
            key={p.label}
            type="button"
            aria-pressed={on}
            title={p.label}
            onClick={() => onChange(p.hex)}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${on ? "border-ink font-bold" : "border-line"}`}
          >
            <span
              aria-hidden
              className={`inline-block size-3.5 rounded-sm border border-ink/25 ${p.hex ? "" : defaultSwatch}`}
              style={p.hex ? { background: backgroundCss(p.hex) } : undefined}
            />
            {p.label}
          </button>
        );
      })}
      <label htmlFor={id} className="inline-flex items-center gap-1">
        <input
          id={id}
          type="color"
          value={value ?? defaultHex}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-line bg-transparent p-0"
        />
        muu
      </label>
    </div>
  );
}
