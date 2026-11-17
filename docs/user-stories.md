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

### US-103: Grant the debugger only when needed

Automaton: capture extension run, Idle → Attached
Source: [PROMPT P-023] item 6, "Optional permission (Recommended)"

As a designer, I want the extension to ask for the debugger permission only when I choose an approach that needs it, so that a plain capture never shows Chrome's debugging bar.

Acceptance criteria:
- Given no debugger approach is chosen, then no permission prompt appears and the debugging bar is not shown.
- Given a debugger approach is chosen and I refuse the permission, then I see that the chosen approaches need it and nothing is captured.
- Given I allow it, then the viewport is pinned to its size before the bar appeared, and the debugger is detached when the capture ends, even after an error.
