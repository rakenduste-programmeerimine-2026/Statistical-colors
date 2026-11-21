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
| 2026-11-21 | test | The extension test for the 100,000-path PDF limit timed out under full-suite load (5.7 s against the 5 s default), on main too | Give that test a 20 s timeout; the limit itself is unchanged | #90 | — |
| 2026-11-21 | logic | The "Segupiksli sarnasus" column and its filter showed the highest chance of any artefact kind, so a simulated JPEG or banding chance could appear as blend similarity; found by the compliance review before the PR | Column and filter read only the `artefact.antialias-blend` entry (`blendSimilarity`) | #90 | — |
| 2026-11-21 | ui | In the colour table the artefact bar spread over the next column and values wrapped over several lines; alpha showed as a bare "000"; reported in the user test | Cells stay on one line in a sideways-scrolling box; the artefact cell is a fixed-width bar and number ("—" for 0); alpha reads "läbipaistmatus N %" | #90 | — |
| 2026-11-21 | ui | Zooming was too abrupt on laptops: the pixel viewer moved a whole zoom level on every wheel event, and a trackpad pinch sends many small events, so one gesture skipped several levels; reported in the user test | Small wheel steps add up to one level per 100 px (`accumulateWheel`, tested at 99 and 100 px); the 3D view normalises and caps each step | #90 | — |
| 2026-11-21 | logic | The colour count chosen on the upload form was lost: "Ava demo" always opened 5000 colours, and the results heading printed the requested count even when the image had fewer colours, so the page kept saying "5000 sagedasemat värvi"; reported in the user test | The demo link carries `?top_n`, the heading and hint name the rows actually listed, and the 3D view gets the same top N colours; regression tests written first | #90 | — |
| 2026-11-19 | implicit-state-machine | After "Töötle teine pilt" the upload form stayed in "Töötlen…" with the old error, because `cacheComponents` makes Next.js hide the page in `<Activity>` and show the same instance again, and `processing` was reset only on failure; found by hand while testing #40 | Reset `processing` and `error` in a `useLayoutEffect` cleanup, which runs when Activity hides the form; reproduced with an `<Activity>` hidden → visible test | #86 | `docs/automata/upload-form.md` |
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
| 2026-11-18 | logic | The colour analysis stub labelled a contrast pair that passes AA and AAA with the failure kind `accessibility.wcag-fail`, so the UI showed "Kontrast alla WCAG piiri"; found in the browser check before review | Add the neutral kind `accessibility.contrast` and use it for passing pairs | #54 | — |
| 2026-11-18 | ui | The structure wheel hid the HSL, HSV, HWB and RYB buttons at opacity 0 until hover or focus, so touch users could not find them; found by the compliance review before the PR | Show inactive buttons dimmed (40 %) instead of invisible | #54 | `docs/automata/results-analysis.md` |
| 2026-11-18 | logic | The simulated per-colour blend chance ranked each share against the largest one, so the demo's 294 equal flat swatches all showed about 88 % "segupiksel"; found in the browser check before review | Base the simulated chance on the pixel count (few pixels = likely edge blend) and test a palette of equal swatches | #70 | — |
| 2026-11-18 | validation | The colour table would crash the results page when the server sends a row with an empty `artefacts` list, because the highest-chance lookup used `reduce` without a start value; found by the compliance review before the PR | Start the lookup from "none" and test the empty list | #70 | — |
| 2026-11-18 | configuration | A new `--color-delta` token used only through an SVG `stroke="var(…)"` attribute was not emitted, because Tailwind 4 `@theme inline` only outputs variables that a class uses, so the ΔE circle had no stroke; found in the browser check before commit | Build the token from the theme variables (like `--color-muted`) and apply it with the `stroke-delta` class | #70 | — |
| 2026-11-18 | ui | The ΔE circles on the structure wheel were hidden: they were drawn before the colour dots and lightness rings, and at their 7 px base size they fit inside a dot with its ring; reported by the user | Draw the ΔE circles last with a page-coloured halo, and start their radius just outside the largest dot with its lightness ring, growing with ΔE from there | #70 | `docs/automata/results-analysis.md` |
| 2026-11-18 | implicit-state-machine | The 3D view's canvas stayed blank in development: React's double mount cancelled the pending animation frame but kept its id, so every later redraw request was skipped; found in the browser check before commit | Clear the id together with cancelling the frame | #75 | `docs/automata/gamut-view.md` |
| 2026-11-18 | ui | The 3D view kept a hover readout after switching space or resetting the view, and the default camera cut off the wider CIELAB solid; found in the browser check before commit | Tie the readout to a view key, and set the default distance from the space's a/b extent | #75 | `docs/automata/gamut-view.md` |
| 2026-11-18 | implicit-state-machine | In the 3D view, releasing one movement key and pressing another within one frame started a second animation loop, so every frame was drawn twice until all keys were released; found by `state-machine-analyst` | One explicit, tested frame loop (`src/core/gamut/frame-loop.ts`) that can only queue one frame; refactor approved by the user | #75 | `docs/automata/gamut-view.md` |
| 2026-11-18 | ui | In the 3D view, a key stayed held when Shift changed its name between press and release (`=` / `+`), so the camera kept zooming; Ctrl/Cmd shortcuts were swallowed; found by `state-machine-analyst` | Track physical key codes and leave Ctrl, Cmd and Alt combinations to the browser | #75 | `docs/automata/gamut-view.md` |
| 2026-11-18 | ui | In the 3D view, the hover readout stayed while the wheel or keys moved the camera, a cancelled touch left a drag running, and a pointer-leave listener was added on every re-render; found by `state-machine-analyst` | Clear the readout when the camera moves, end the drag on pointercancel and lostpointercapture, and remove the listener on cleanup | #75 | `docs/automata/gamut-view.md` |
