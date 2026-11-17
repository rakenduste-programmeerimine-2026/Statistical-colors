# Bug log

Every fixed bug, newest first. Follow the `fix-bug` skill to add one.

## Types

| Type | Meaning |
|---|---|
| implicit-state-machine | State spread across flags or fields allowed an invalid combination |
| logic | Wrong condition, calculation or branch |
| concurrency | Race condition, ordering or stale data |
| validation | Bad input accepted or good input rejected, including boundaries |
| integration | Mismatch with another layer, service or dependency |
| database | Schema, migration, query or Supabase policy problem |
| configuration | Environment, build or tooling settings |
| ui | Layout, styling or interaction problem |
| performance | Too slow or too much memory or CPU |
| security | Exposure of data or access |

## Log

| Date | Type | Description | Fix | Issue | State machine |
|---|---|---|---|---|---|
| 2026-11-17 | performance | Pixel preview kept the previous decoded image (hundreds of MB for large files) after a new file was picked; found by `performance-analyst` before commit | Drop the image, view and readout when the source changes; limit the preview to 4096 × 4096 pixels | #42 | `docs/automata/pixel-viewer.md` |
| 2026-11-17 | ui | Scrolling the page over the pixel preview zoomed the image instead of scrolling; found in the browser check before commit | Zoom only on Ctrl/Cmd + scroll | #42 | `docs/automata/pixel-viewer.md` |
| 2026-11-17 | implicit-state-machine | Pixel preview fitted once, to a canvas size reported before layout settled, so the first fit was too small; found in the browser check before commit | Derive the view from Fit until the user zooms or pans, so resizes refit | #42 | `docs/automata/pixel-viewer.md` |
| 2026-11-17 | logic | Pixel readout showed the hex with an alpha suffix (`#032F29 255`); found by a test before commit | Format the hex from r, g, b only | #42 | — |
| 2026-11-17 | validation | The PDF reader reported "path limit" on a page with exactly the maximum number of paths; found by a boundary test before commit | Check the limit when a path would be added, not after every token | #45 | — |
| 2026-11-17 | validation | `crop` with an origin past the right or bottom edge read pixels from the next row instead of returning a transparent 1 × 1; found by the compliance review before commit | Return a transparent 1 × 1 when nothing of the rectangle is inside the image | #44 | — |
| 2026-11-17 | configuration | Chrome ignored the extension's debugger permission, because it does not allow `debugger` as an optional permission; reported by the user when loading the extension | List `debugger` as a normal permission and attach only for K1, S1 and S3 (P-027); a test checks the manifest | #44 | `docs/automata/capture-extension.md` |
| 2026-11-17 | implicit-state-machine | Figma plugin UI: dropping a file during an import re-enabled Import (a second import could start) and replaced the screenshot the running import still read; inherited from the reference; found by the compliance review before commit | Keep the files an import started with in `state.importing`, and keep Import disabled until it ends | #46 | `docs/automata/figma-plugin.md` |
| 2026-11-17 | ui | Figma plugin UI stayed in "importing" forever when preparing the images failed, because no "done" message comes; found by the compliance review before commit | Catch the failure in the UI, show it and end the import | #46 | `docs/automata/figma-plugin.md` |
| 2026-11-17 | security | Figma plugin UI put dropped file names into `innerHTML`, so a name could inject markup; inherited from the reference; fixed during the port | Show file names with `textContent` | #46 | — |
