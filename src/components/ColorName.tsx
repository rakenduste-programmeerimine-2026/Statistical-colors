"use client";

import { useEffect, useSyncExternalStore } from "react";
import { loadNameIndex, nearestName, type NameIndex } from "@/core/color/names";
import { oklchToSrgb, type Oklch, type Rgb8 } from "@/core/color/oklch";

// One shared copy of the name list for the whole page, loaded on first use.
let loaded: NameIndex | null = null;
let loader: () => Promise<NameIndex> = loadNameIndex;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The colour-name index, or null until the list has loaded (it loads lazily, P-040 item 2). */
export function useNameIndex(): NameIndex | null {
  const index = useSyncExternalStore(subscribe, () => loaded, () => null);
  useEffect(() => {
    if (loaded) return;
    void loader().then((i) => {
      loaded = i;
      listeners.forEach((l) => l());
    });
  }, []);
  return index;
}

/** For tests: use an index without loading the package, or stop loading (`null` loader). */
export function setNameIndexForTests(index: NameIndex | null, load: (() => Promise<NameIndex>) | null = null) {
  loaded = index;
  loader = load ?? (() => new Promise<NameIndex>(() => {}));
  listeners.forEach((l) => l());
}

const toRgb = (c: Rgb8 | Oklch): Rgb8 => ("r" in c ? c : oklchToSrgb(c));

/**
 * The nearest name from color-name-list next to a colour code (P-039 item 8).
 * Marked "≈": it is the closest name, not the colour's official name.
 */
export function ColorName({ color, className = "" }: { color: Rgb8 | Oklch; className?: string }) {
  const index = useNameIndex();
  if (!index) return null;
  const name = nearestName(index, toRgb(color));
  if (!name) return null;
  return (
    <span className={`font-sans text-muted ${className}`} title="Lähim nimi värvinimede loendist (color-name-list)">
      ≈ {name}
    </span>
  );
}

/** The name as plain text, for places that need a string (canvas tooltips, labels). */
export function colorNameText(index: NameIndex | null, color: Rgb8 | Oklch): string {
  return index ? nearestName(index, toRgb(color)) : "";
}
