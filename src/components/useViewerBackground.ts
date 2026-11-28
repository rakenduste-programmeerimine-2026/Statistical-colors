"use client";

import { useEffect, useState } from "react";
import { useServices } from "@/adapters/services";
import type { ViewerId } from "@/core/viewer/viewer-prefs";

/**
 * A viewer's background, remembered across visits (P-039 item 5). The saved
 * value is read after mounting, so the server render and the first client
 * render agree.
 */
export function useViewerBackground(viewer: ViewerId): [string | null, (hex: string | null) => void] {
  const { viewerPrefs } = useServices();
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    // Reading browser storage is an external system: sync it once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(viewerPrefs.background(viewer));
  }, [viewerPrefs, viewer]);
  const set = (hex: string | null) => {
    setValue(hex);
    viewerPrefs.setBackground(viewer, hex);
  };
  return [value, set];
}
