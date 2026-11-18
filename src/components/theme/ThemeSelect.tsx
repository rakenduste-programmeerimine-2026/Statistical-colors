"use client";

import * as Select from "@radix-ui/react-select";
import type { Theme } from "@/core/theme/theme";
import { input } from "../ui";
import { toOklch } from "./ThemeProvider";
import { formatOklch, hexToOklch } from "@/core/color/oklch";

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
  return (
    <Select.Root value={currentId} onValueChange={onSelect}>
      <Select.Trigger
        aria-labelledby={labelId}
        className={`${input} mt-2 flex cursor-pointer items-center justify-between gap-2.5`}
      >
        <span className="flex items-center gap-2.5 overflow-hidden">
          <ThemeSwatch theme={shown} />
          <span className="font-mono">
            {shown.bg} / {shown.text}
          </span>
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
                  <Select.ItemText>
                    <span className="font-mono">
                      {theme.bg} / {theme.text}
                    </span>
                  </Select.ItemText>
                  {/* Outside ItemText, so typeahead and the trigger keep the hex label. */}
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
