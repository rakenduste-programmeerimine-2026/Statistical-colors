import type { ThemeState } from "./theme";

/**
 * Port: where saved themes live. The original app saved them in a JSON file
 * on the server; this port saves them per browser (localStorage), and the
 * port keeps that swappable.
 */
export interface ThemeStore {
  /** The saved state, or the default state if nothing valid is saved. */
  load(): Promise<ThemeState>;
  save(state: ThemeState): Promise<void>;
}
