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
