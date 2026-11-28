"use client";

import * as Select from "@radix-ui/react-select";
import type { Theme } from "@/core/theme/theme";
import { input } from "../ui";
import { toOklch } from "./ThemeProvider";
import { formatOklch, hexToOklch } from "@/core/color/oklch";
import type { NameIndex } from "@/core/color/names";
import { ColorName, colorNameText, useNameIndex } from "../ColorName";

/**
 * What a theme is called in the list: its own name, else its colours' names
 * ("Snow / Night"), else its codes until the names have loaded (#91).
 */
export function themeLabel(theme: Pick<Theme, "bg" | "text" | "name">, index: NameIndex | null): string {
  if (theme.name) return theme.name;
  const bg = colorNameText(index, hexToOklch(theme.bg));
  const text = colorNameText(index, hexToOklch(theme.text));
  return bg && text ? `${bg} / ${text}` : `${theme.bg} / ${theme.text}`;
}

/** Split swatch: left half background, right half text colour, as in the original. */
function ThemeSwatch({ theme }: { theme: Pick<Theme, "bg" | "text"> }) {
  return (
    <span
      aria-hidden
      className="inline-block size-5.5 shrink-0 rounded-md border border-ink/25"
      style={{ background: `linear-gradient(90deg, ${toOklch(theme.bg)} 0 50%, ${toOklch(theme.text)} 50% 100%)` }}
    />
  );
}

interface Props {
  themes: Theme[];
  currentId: string;
  onSelect: (id: string) => void;
  /** Colours shown on the closed button, so it follows the live preview. */
  shown: Pick<Theme, "bg" | "text">;
  labelId: string;
}

export function ThemeSelect({ themes, currentId, onSelect, shown, labelId }: Props) {
  const index = useNameIndex();
  // The button names the saved theme while the preview matches it, else the previewed colours.
  const current = themes.find((t) => t.id === currentId);
  const shownLabel = current && current.bg === shown.bg && current.text === shown.text ? themeLabel(current, index) : themeLabel(shown, index);
  return (
    <Select.Root value={currentId} onValueChange={onSelect}>
      <Select.Trigger
        aria-labelledby={labelId}
        className={`${input} mt-2 flex cursor-pointer items-center justify-between gap-2.5`}
      >
        <span className="flex items-center gap-2.5 overflow-hidden">
          <ThemeSwatch theme={shown} />
          <span className="truncate">{shownLabel}</span>
        </span>
        <Select.Icon className="opacity-75">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={8}
          className="z-10 max-h-65 w-(--radix-select-trigger-width) overflow-auto rounded-xl border border-line bg-page p-1.5 text-ink shadow-xl shadow-[oklch(0_0_0/0.12)]"
        >
          <Select.Viewport>
            {themes.map((theme) => (
              <Select.Item
                key={theme.id}
                value={theme.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none data-highlighted:bg-ink/5 data-[state=checked]:outline-2 data-[state=checked]:outline-ink/25"
              >
                <ThemeSwatch theme={theme} />
                <span className="flex flex-col">
                  <Select.ItemText>{themeLabel(theme, index)}</Select.ItemText>
                  {/* Outside ItemText, so typeahead finds the name; the codes stay visible (#91). */}
                  <span className="font-mono text-xs text-muted">
                    {theme.bg} <ColorName color={hexToOklch(theme.bg)} /> / {theme.text} <ColorName color={hexToOklch(theme.text)} />
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {formatOklch(hexToOklch(theme.bg))} / {formatOklch(hexToOklch(theme.text))}
                  </span>
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
