/** A saved colour theme: page background and text colour, both `#rrggbb`, and an optional name (#91). */
export interface Theme {
  id: string;
  bg: string;
  text: string;
  name?: string;
}

/** Longest theme name kept. */
export const THEME_NAME_MAX = 40;

/** A trimmed name of at most THEME_NAME_MAX characters, or undefined when empty or not text. */
export function cleanThemeName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim().replace(/\s+/g, " ").slice(0, THEME_NAME_MAX);
  return s || undefined;
}

export interface ThemeState {
  currentId: string;
  themes: Theme[];
}

export const DEFAULT_THEME: Theme = { id: "default", bg: "#ffffff", text: "#111111", name: "Vaikimisi" };

export const DEFAULT_THEME_STATE: ThemeState = { currentId: "default", themes: [DEFAULT_THEME] };

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export function isHex6(value: unknown): value is string {
  return typeof value === "string" && HEX6.test(value.trim());
}

/** Adds a missing `#` and lower-cases a 6-digit hex colour; anything else gives the fallback. */
export function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  let s = value.trim();
  if (!s.startsWith("#")) s = `#${s}`;
  return isHex6(s) ? s.toLowerCase() : fallback;
}

/** Same colours give the same id, so saving a theme twice does not duplicate it. */
export function themeId(bg: string, text: string): string {
  return `${bg.toLowerCase()}_${text.toLowerCase()}`;
}

export function currentTheme(state: ThemeState): Theme {
  return state.themes.find((t) => t.id === state.currentId) ?? state.themes[0] ?? DEFAULT_THEME;
}

/**
 * Adds the theme if it is new and makes it current. Saving the same colours
 * again with a name renames the saved theme (#91).
 */
export function addTheme(state: ThemeState, bg: string, text: string, name?: string): ThemeState {
  const theme: Theme = {
    id: "",
    bg: normalizeHex(bg, DEFAULT_THEME.bg),
    text: normalizeHex(text, DEFAULT_THEME.text),
  };
  theme.id = themeId(theme.bg, theme.text);
  const clean = cleanThemeName(name);
  if (clean) theme.name = clean;
  const exists = state.themes.some((t) => t.id === theme.id);
  const themes = exists
    ? state.themes.map((t) => (t.id === theme.id && clean ? { ...t, name: clean } : t))
    : [...state.themes, theme];
  return { currentId: theme.id, themes };
}

/** Makes an existing theme current; an unknown id changes nothing. */
export function setCurrentTheme(state: ThemeState, id: string): ThemeState {
  return state.themes.some((t) => t.id === id) ? { ...state, currentId: id } : state;
}

/** Accepts stored data only if it has a non-empty theme list; otherwise the default. */
export function parseThemeState(raw: unknown): ThemeState {
  if (!raw || typeof raw !== "object") return DEFAULT_THEME_STATE;
  const { currentId, themes } = raw as Partial<ThemeState>;
  if (!Array.isArray(themes) || themes.length === 0) return DEFAULT_THEME_STATE;
  // Themes saved before names existed load unchanged; a bad name is dropped, not the theme (#91).
  const valid = themes
    .filter((t): t is Theme => !!t && typeof t.id === "string" && isHex6(t.bg) && isHex6(t.text))
    .map(({ id, bg, text, name }) => {
      const clean = cleanThemeName(name);
      return clean ? { id, bg, text, name: clean } : { id, bg, text };
    });
  if (valid.length === 0) return DEFAULT_THEME_STATE;
  return { currentId: typeof currentId === "string" ? currentId : valid[0].id, themes: valid };
}
