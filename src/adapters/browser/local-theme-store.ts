import { DEFAULT_THEME_STATE, parseThemeState, type ThemeState } from "@/core/theme/theme";
import type { ThemeStore } from "@/core/theme/theme-store";

const KEY = "statistical-colors:themes";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Saves themes in the browser. Storage can be missing or throw (private
 * windows, blocked site data); the picker then still works for this visit.
 */
export class LocalThemeStore implements ThemeStore {
  private memory: ThemeState = DEFAULT_THEME_STATE;

  constructor(private readonly storage: () => KeyValueStorage | undefined = () => globalThis.localStorage) {}

  async load(): Promise<ThemeState> {
    try {
      const raw = this.storage()?.getItem(KEY);
      if (raw) this.memory = parseThemeState(JSON.parse(raw));
    } catch {
      // Unreadable or corrupt: keep what we have, like the original reset to the default.
    }
    return this.memory;
  }

  async save(state: ThemeState): Promise<void> {
    this.memory = state;
    try {
      this.storage()?.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable: the theme still applies until the page is closed.
    }
  }
}
