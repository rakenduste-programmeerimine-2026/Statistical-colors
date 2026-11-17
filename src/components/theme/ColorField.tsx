"use client";

import { useId, useState } from "react";
import { isHex6, normalizeHex } from "@/core/theme/theme";
import { input, label as labelClass } from "../ui";

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

/**
 * Hex text field kept in sync with a native colour picker.
 * Unlike the original, a half-typed value is kept while typing; the colour
 * only changes once the text is a valid 6-digit hex.
 */
export function ColorField({ label, value, onChange }: Props) {
  const id = useId();
  const [text, setText] = useState(value);
  const [shownValue, setShownValue] = useState(value);

  // A new colour from outside (picker, saved theme) replaces the text.
  if (value !== shownValue) {
    setShownValue(value);
    setText(value);
  }

  function handleText(next: string) {
    setText(next);
    const hex = normalizeHex(next, "");
    if (isHex6(hex)) onChange(hex);
  }

  return (
    <div className="min-w-60 flex-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2.5">
        <input
          id={id}
          className={`${input} flex-1 font-mono`}
          type="text"
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => handleText(e.target.value)}
          onBlur={() => setText(value)}
        />
        <input
          aria-label={`${label}: värvivalija`}
          className="h-10 w-11 rounded-lg border border-line bg-transparent p-0"
          type="color"
          value={value}
          onChange={(e) => onChange(normalizeHex(e.target.value, value))}
        />
      </div>
    </div>
  );
}
