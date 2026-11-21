import { isHexColor, type ViewerId, type ViewerPrefsStore } from "@/core/viewer/viewer-prefs";

const KEY = "statistical-colors:viewer-backgrounds";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Remembers each viewer's background in the browser (P-039 item 5). Storage
 * can be missing or throw (private windows, blocked site data); the choice
 * then still holds until the page is closed.
 */
export class LocalViewerPrefs implements ViewerPrefsStore {
  private memory: Partial<Record<ViewerId, string>> = {};
  private loaded = false;

  constructor(private readonly storage: () => KeyValueStorage | undefined = () => globalThis.localStorage) {}

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = this.storage()?.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object")
        for (const [k, v] of Object.entries(parsed)) if ((k === "pixel" || k === "gamut") && isHexColor(v)) this.memory[k] = v;
    } catch {
      // Unreadable or corrupt: start from the defaults.
    }
  }

  background(viewer: ViewerId): string | null {
    this.load();
    return this.memory[viewer] ?? null;
  }

  setBackground(viewer: ViewerId, hex: string | null): void {
    this.load();
    if (hex === null || !isHexColor(hex)) delete this.memory[viewer];
    else this.memory[viewer] = hex;
    try {
      this.storage()?.setItem(KEY, JSON.stringify(this.memory));
    } catch {
      // Storage unavailable: the choice holds for this visit.
    }
  }
}
