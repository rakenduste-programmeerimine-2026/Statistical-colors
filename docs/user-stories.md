# User stories

Stories built from the finite automata in `docs/automata/`. Use the format in the `finite-automata` skill.

## Capture extension

Numbered from US-101 so they do not clash with stories on the app-port branches (#37, #42).

### US-101: Capture a tab losslessly

Automaton: capture extension run, Idle → Capturing → Idle
Source: [PROMPT P-022] "begin staging the plugin screenshot tool"

As a designer, I want an exact PNG of the page I am looking at, so that its colours can be analysed without loss.

Acceptance criteria:
- Given the popup, when I press Capture with no approach chosen, then `shot.png` and `report.json` are saved to `Downloads/intent-capture-<time>/` without a save dialog.
- Given the capture, then `report.json` lists the page size and URL, the capture method `tabs.captureVisibleTab`, the pixel size of the shot, and the OS and browser with whether each was detected or chosen.
- Given two captures within 600 ms, then the second waits, because Chrome allows about two per second.

### US-102: Only one capture at a time

Automaton: capture extension run, Capturing → Capturing (refused)
Source: [UNDERSTANDING] ported from the reference `background.js`

As a designer, I want a second press during a capture to be refused clearly, so that two captures do not mix their files.

Acceptance criteria:
- Given a capture is running, when I press Capture again, then I see "A capture is already running." and the first capture is unaffected.
- Given it has finished, when I press Capture, then a new capture starts.

### US-103: Use the debugger only when needed

Automaton: capture extension run, Idle → Attached
Source: [PROMPT P-027] "Required, attach on demand (Recommended)" (replaces P-023 item 6, which Chrome does not allow)

As a designer, I want the extension to attach the debugger only when I choose an approach that needs it, so that a plain capture never shows Chrome's debugging bar.

Acceptance criteria:
- Given the extension is installed, then Chrome lists the debugger permission once, at install.
- Given no debugger approach is chosen, then the debugging bar is not shown.
- Given K1, S1 or S3 is chosen, then the viewport is pinned to its size before the bar appeared, and the debugger is detached when the capture ends, even after an error.

## Recovery approaches

### US-104: Recover the scene behind the pixels

Automaton: capture extension run, Capturing (approaches and combinations)
Source: [PROMPT P-022] "Capture + recovery approaches"

As a designer, I want the capture to recover the vectors, text and declared colours behind the screenshot, so that the Figma file is editable and the analysis knows which colour belongs to which element.

Acceptance criteria:
- Given S2 is chosen, then scene.svg holds the drawing and the scene metadata, and scene-vs-shot.png shows where it differs from the shot.
- Given D1 and D2 are chosen, then text-alpha.png, background.png and snapped.png are saved, and the D1+D2 step reports how many blend colours remain without text.
- Given a debugger approach (K1, S1, S3) is chosen, then the permission is asked for first (US-103).
- Given an approach fails, then the others still run, and report.json names the failure.
- Given S2 ran, then the patch step saves scene-final.svg, with native controls as vectors where a route matched the shot and as bitmaps otherwise.

### US-105: Stay inside Chrome's limits

Automaton: capture extension run, Capturing
Source: [UNDERSTANDING] P-025, not yet confirmed by the user

As a designer, I want a capture to finish, so that I get its files even on a large or busy page.

Acceptance criteria:
- Given 8× on a 2× display at 1920 × 1080, then K1 uses 2× and report.json gives the requested and the effective scale.
- Given a k× side of 4096 CSS px at scale 4 (16384 px), then that scale is kept; at 4097 px it halves.
- Given 9 canvases, then F1 fits the first 8 and reports the ninth as skipped.
- Given 61 native controls, then 60 are scored route by route and the 61st becomes a bitmap.
- Given a run without the debugger, then Chrome is pinged before every step, so the service worker is not stopped after 30 idle seconds.
