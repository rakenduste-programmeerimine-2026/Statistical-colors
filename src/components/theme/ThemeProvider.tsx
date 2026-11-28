"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useServices } from "@/adapters/services";
import { DEFAULT_THEME_STATE, addTheme, currentTheme, setCurrentTheme, type ThemeState } from "@/core/theme/theme";

interface Preview {
  bg: string;
  text: string;
}

interface ThemeContextValue {
  state: ThemeState;
  /** Colours currently shown on the page, saved or not. */
  preview: Preview;
  setPreview: (preview: Preview) => void;
  save: (bg: string, text: string, name?: string) => Promise<void>;
  select: (id: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Hex in, OKLCH out: the browser converts it, so the page colours stay OKLCH. */
export const toOklch = (hex: string) => `oklch(from ${hex} l c h)`;

function applyToPage({ bg, text }: Preview) {
  const root = document.documentElement.style;
  root.setProperty("--theme-bg", toOklch(bg));
  root.setProperty("--theme-text", toOklch(text));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { themes } = useServices();
  const [state, setState] = useState<ThemeState>(DEFAULT_THEME_STATE);
  const [preview, setPreviewState] = useState<Preview>(() => currentTheme(DEFAULT_THEME_STATE));

  useEffect(() => {
    let active = true;
    themes.load().then((loaded) => {
      if (!active) return;
      setState(loaded);
      setPreviewState(currentTheme(loaded));
    });
    return () => {
      active = false;
    };
  }, [themes]);

  useEffect(() => applyToPage(preview), [preview]);

  const commit = useCallback(
    async (next: ThemeState) => {
      setState(next);
      setPreviewState(currentTheme(next));
      await themes.save(next);
    },
    [themes],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      state,
      preview,
      setPreview: setPreviewState,
      save: (bg, text, name) => commit(addTheme(state, bg, text, name)),
      select: (id) => commit(setCurrentTheme(state, id)),
    }),
    [state, preview, commit],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
