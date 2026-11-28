"use client";

import { useId, useState } from "react";
import { THEME_NAME_MAX } from "@/core/theme/theme";
import { button, card, hint, input, label } from "../ui";
import { ColorField } from "./ColorField";
import { ThemeSelect } from "./ThemeSelect";
import { useTheme } from "./ThemeProvider";

/** The theme card shown at the top of every page in the original app. */
export function ThemePicker() {
  const { state, preview, setPreview, save, select } = useTheme();
  const savedLabelId = useId();
  const nameId = useId();
  const [name, setName] = useState("");

  return (
    <section className={card} aria-labelledby="theme-heading">
      <h2 id="theme-heading" className="text-xl font-bold">
        Teema
      </h2>
      <div className="flex flex-wrap items-end gap-4">
        <ColorField label="Taust" value={preview.bg} onChange={(bg) => setPreview({ ...preview, bg })} />
        <ColorField label="Tekst" value={preview.text} onChange={(text) => setPreview({ ...preview, text })} />
        <div className="min-w-60 flex-1">
          <label htmlFor={nameId} className={label}>
            Teema nimi (valikuline)
          </label>
          <input
            id={nameId}
            className={`${input} mt-2`}
            maxLength={THEME_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="nt Tume kontrast"
          />
          <button
            type="button"
            className={`${button} mt-2`}
            onClick={() => {
              void save(preview.bg, preview.text, name);
              setName("");
            }}
          >
            Salvesta teema
          </button>
          <span className={`${hint} mt-1.5`}>Salvestatakse selle brauseri mällu.</span>
        </div>
        <div className="min-w-60 flex-1">
          <span id={savedLabelId} className={label}>
            Salvestatud teemad
          </span>
          <ThemeSelect
            themes={state.themes}
            currentId={state.currentId}
            onSelect={select}
            shown={preview}
            labelId={savedLabelId}
          />
        </div>
      </div>
    </section>
  );
}
