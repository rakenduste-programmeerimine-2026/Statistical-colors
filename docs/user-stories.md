# User stories

Stories built from the finite automata in `docs/automata/`. Use the format in the `finite-automata` skill.

## Upload form

### US-001: Reject a file before it is sent

Automaton: upload form, Idle/Error → Error
Source: [PROMPT P-017] "take the frontend from it and convert it into nextjs"

As a designer, I want a clear message when my file cannot be used, so that I know what to fix.

Acceptance criteria:
- Given no file is picked, when I submit, then I see "Faili pole valitud."
- Given a file ending in .tiff, .svg or no extension, when I submit, then I see the file type message.
- Given a file of 25 MB + 1 byte, when I submit, then I see the size message; at exactly 25 MB it is accepted.

### US-002: Start the analysis

Automaton: upload form, Idle/Error → Processing
Source: [PROMPT P-017] "take the frontend from it and convert it into nextjs"

As a designer, I want my image analysed with my chosen options, so that the results match what I asked for.

Acceptance criteria:
- Given a valid PNG, JPEG, BMP, GIF or WebP file, when I submit, then the message disappears and the button reads "Töötlen…" and is disabled.
- Given top N 0, 5001 or empty, when I submit, then 1, 5000 or 5000 is used.

### US-003: See the results

Automaton: upload form, Processing → Navigated
Source: [PROMPT P-017] "take the frontend from it and convert it into nextjs"

As a designer, I want to land on the results page when the analysis is done, so that I can read the colours.

Acceptance criteria:
- Given the analysis is stored, when it finishes, then the browser opens `/results/<id>`.

### US-004: Report an unreadable image

Automaton: upload form, Processing → Error (InvalidImageError)
Source: [PROMPT P-017] "take the frontend from it and convert it into nextjs"

As a designer, I want to know when a file only looks like an image, so that I can export it again.

Acceptance criteria:
- Given an empty .png file, when the analysis fails, then I see "See fail ei paista olevat korrektne pilt." and can submit again.

### US-005: Report any other failure

Automaton: upload form, Processing → Error (other failure)
Source: [PROMPT P-017] "take the frontend from it and convert it into nextjs"

As a designer, I want to see why processing failed, so that I can report it.

Acceptance criteria:
- Given the backend fails with a named error, when the analysis ends, then I see "Töötlemine ebaõnnestus: <name>: <message>".

## Theme picker

### US-006: Get my saved theme back

Automaton: theme picker, Loading → Synced
Source: [PROMPT P-017] "take the frontend from it and convert it into nextjs"

As a designer, I want the page to open in the theme I last chose, so that I do not set it again on every visit.

Acceptance criteria:
- Given a saved current theme in this browser, when a page loads, then its colours are applied and shown in both fields.
- Given nothing saved or corrupt data, when a page loads, then #ffffff / #111111 is used.

### US-007: Preview colours before saving

Automaton: theme picker, Synced/Previewing → Previewing
Source: [PROMPT P-017] "take the frontend from it and convert it into nextjs"

As a designer, I want the page to change as I type or pick a colour, so that I can judge the theme before saving it.

Acceptance criteria:
- Given the theme card, when I type "00fbff" as the background, then the page background becomes `oklch(from #00fbff l c h)` and the picker shows #00fbff.
- Given the theme card, when I pick a colour with the picker, then the hex field shows it.

### US-008: Save a theme

Automaton: theme picker, Previewing → Synced (save)
Source: [PROMPT P-017] "take the frontend from it and convert it into nextjs"

As a designer, I want to save the colours I picked, so that I can return to them.

Acceptance criteria:
- Given unsaved colours, when I click "Salvesta teema", then they are stored as a theme and become current.
- Given the same colours are already saved, when I save again, then no duplicate appears.

### US-009: Switch to a saved theme

Automaton: theme picker, Synced/Previewing → Synced (pick)
Source: [PROMPT P-017] "take the frontend from it and convert it into nextjs"

As a designer, I want to pick one of my saved themes from a list with swatches, so that I can switch quickly.

Acceptance criteria:
- Given two saved themes, when I pick one in "Salvestatud teemad", then the page and both fields use its colours and it becomes current.

### US-010: Type a colour without it jumping back

Automaton: theme picker field, Clean → Drafting → Clean
Source: [UNDERSTANDING] a fix to the original, which replaced half-typed text on every keystroke

As a designer, I want to type a hex code character by character, so that I can enter it by hand.

Acceptance criteria:
- Given the text field, when I type "#12", then the text stays "#12" and the colour does not change.
- Given "#12" in the field, when the field loses focus, then it shows the last valid colour again.
- Given the field, when I type 8 characters, then only 7 are kept.

## Pixel viewer and demo

### US-011: Preview a picked file exactly

Automaton: pixel viewer, Loading → AutoFit
Source: [PROMPT P-019] "add a exact pixel viewer like preview when a user adds a file"

As a designer, I want to see the file I picked before I send it, pixel for pixel, so that I know I picked the right image.

Acceptance criteria:
- Given no file is picked, or the file breaks the upload rules (for example .tiff or 25 MB + 1 byte), then no preview is shown.
- Given I pick a 512 × 40 BMP, then the preview shows "512 × 40 px" at the largest whole-number zoom that fits.
- Given the preview, then every screen pixel shows a stored value of the file: no smoothing, no colour-profile conversion.

### US-012: Read the pixel under the cursor

Automaton: pixel viewer, AutoFit/Manual (pointer move, no state change)
Source: [PROMPT P-019] "exact pixel viewer"

As a designer, I want to read the exact colour under my cursor, so that I can check single pixels.

Acceptance criteria:
- Given the cursor is on pixel (0, 0) of the demo image, then I see "x 0, y 0 · #032F29 · rgb 3, 47, 41".
- Given a pixel with alpha below 255, then the alpha is shown too.
- Given the cursor is outside the image, then the readout asks me to move over the image.

### US-013: Zoom and pan

Automaton: pixel viewer, AutoFit → Manual → AutoFit
Source: [UNDERSTANDING] ported from the reference Exact Pixel Viewer

As a designer, I want to zoom in on details and back out, so that I can inspect small areas.

Acceptance criteria:
- Given 1×, when I press + (button, key or Ctrl + scroll), then the zoom is 2×; when I zoom out from 1×, then it is 1/2 (every second pixel, unblended).
- Given I scroll without Ctrl over the preview, then the page scrolls and the zoom does not change.
- Given I zoomed in, when the window is resized, then my zoom stays; when I press Fit or 0, then the preview fits again.
- Given 6× or more, when I tick "Pikslivõrk", then a grid is drawn between pixels.

### US-014: Refuse an inexact decode

Automaton: pixel viewer, Loading → Failed
Source: [PROMPT P-020] item 6

As a designer, I want to be told when the browser cannot open my file exactly, so that I do not trust wrong colours.

Acceptance criteria:
- Given the browser cannot decode the file with colour conversion turned off, then I see a message naming the file and the zoom buttons are disabled.
- Given an image of 4096 × 4096 pixels, then it is previewed; given 4096 × 4097, then I see that it is too large to preview and can still analyse it (P-021 item 3).

### US-015: Open the demo

Automaton: upload form (link, no state change); results page
Source: [PROMPT P-019] "when someone presses the demo button and open the bmp included with it in the preview screen"

As a new visitor, I want to see a finished result without uploading anything, so that I understand what the app does.

Acceptance criteria:
- Given the upload page, when I press "Ava demo", then `/results/demo` opens.
- Given the demo result, then a note says it is the real result of "palette (1).bmp" from the earlier colour picker study, the summary shows 512 × 40, 20480 pixels and 295 unique colours, and the BMP is in the preview.
- Given the demo result, when I download either CSV, then I get the original app's file.

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

## Figma plugin

### US-201: Import a capture as editable Figma layers

Automaton: Figma plugin import, Ready → Importing → Ready
Source: [PROMPT P-022] "Extension + Figma plugin"; P-023 item 3, "The Figma file is the end deliverable"

As a designer, I want to turn a capture into native Figma layers, so that I can edit the page instead of tracing a screenshot.

Acceptance criteria:
- Given scene-final.svg and shot.png are dropped in, when I press Import, then a frame "Capture · <url>" appears with frames, text, vectors and images in their captured places, a hidden, locked "shot.png (reference)" layer, and an "Import report" text layer beside it.
- Given a box with fill, radii, shadow and border, then the frame has the same fill, corner radii, drop shadow and inside stroke.
- Given borders of different colours per side, then each side is a thin rectangle named border-top, border-right and so on.

### US-202: Keep text where it was

Automaton: Figma plugin import, Importing (text)
Source: [UNDERSTANDING] ported from the reference plugin

As a designer, I want text in the right font and width, so that it does not reflow into its neighbours.

Acceptance criteria:
- Given the browser's font is installed, then it is used; given only its open substitute (Arial → Arimo), then the substitute is used; given neither, then Inter, Roboto or Arial.
- Given "Prefer open substitute fonts" is ticked, then the substitute comes first.
- Given a run's width differs from the captured width by more than 0.5 px, then its letter spacing is adjusted to match, and the report marks it "pinned".

### US-203: Never leave a hole

Automaton: Figma plugin import, Importing (fallbacks)
Source: [UNDERSTANDING] ported from the reference plugin

As a designer, I want every part of the page to appear in Figma, so that nothing is silently missing.

Acceptance criteria:
- Given a node that cannot be built (for example an image whose bytes are missing), then it becomes a bitmap layer named "patch · build-failed · <name>", and the report lists why.
- Given no screenshot was dropped, then patches become dashed placeholders and the pixel check is skipped.
- Given an SVG without capture metadata, then I see that it has none and Import stays disabled.

### US-204: Carry the colour analysis into Figma

Automaton: Figma plugin import, Importing (analysis)
Source: [PROMPT P-022] "the info gathered by the analysis here gets added as optional metadata for figma as the end deliverable"

As a designer, I want the colour analysis attached to the imported frame, so that the Figma file holds the statistics with the design.

Acceptance criteria:
- Given an analysis for the capture, then it is stored on the frame as plugin data `fs-analysis` and the report says "Colour analysis: attached".
- Given none (until the backend read, #48, exists), then the import still works and the report says "not attached".

## Results colour analysis (#54)

### US-205: Read every colour as OKLCH

Automaton: (readouts, no state)
Source: [PROMPT P-030] "add OKLCH as information wherever hex and rgb are shown as text" (quoted in full in P-030)

As a designer, I want each colour's OKLCH value next to its hex and rgb, so that I can reuse it in OKLCH-based tools without converting.

Acceptance criteria:
- Given the colour table, then each row shows `oklch(L% C h)` with 2, 5 and 2 decimals, and greys show hue `none`.
- Given a pixel under the cursor, then the readout ends with ` · oklch(…)`, with `/ alpha` when alpha is below 1.
- Boundaries: `#000000` → `oklch(0.00% 0 none)`, `#FFFFFF` → `oklch(100.00% 0 none)`.

### US-206: See a harmony and how far each colour is from it

Automaton: Results colour analysis, (load) → Harmony / OKLCH
Source: [PROMPT P-030] "Display the delta E from the ideal oklch harmony visually by increasing the size of the empty circle on the wheel"

As a designer, I want the harmony drawn on an OKLCH wheel with an empty circle per ideal point, so that I can see at a glance which colours are off.

Acceptance criteria:
- Given a harmony, then each point has an empty circle at the ideal position and a filled dot at the actual colour, joined by a line.
- Given ΔE 0, then the circle has the base size; larger ΔE gives a larger circle, up to a maximum.
- Given a screen reader, then the wheel names the structure, its model, rotation and mean and largest ΔE, and a table lists each point.

### US-207: See the harmony on the wheel it was built on

Automaton: Results colour analysis, Harmony / OKLCH → Harmony / OtherModel
Source: [PROMPT P-030] "add an option of showing them on the color wheel in their original colorwheel, but default view is oklch and on hover they can choose other colomodels"

As a designer, I want to switch the wheel to HSL, HSV, HWB or RYB, so that I can see that a palette built in HSL is exact there.

Acceptance criteria:
- Given the wheel, then OKLCH is selected, and the other models appear on hover or focus.
- Given a structure found in HSL, then the HSL button says "algne ratas".
- Given I choose HSL, then the points move to their HSL hue and the description says "Ratas: HSL".

### US-208: See several structures, including ramps

Automaton: Results colour analysis, Harmony ↔ Strip
Source: [PROMPT P-030] "Allow for multible per image. Remember to support more than just hormonies"

As a designer, I want a list of every structure found, so that I can inspect harmonies and ramps in the same image.

Acceptance criteria:
- Given three structures, then the list shows each with family, model, score, coverage and mean and largest ΔE.
- Given I select an equal-step ramp, then a strip shows each colour in OKLCH and the ΔE of each step.

### US-209: Read findings, including dark mode, with how they were found

Automaton: (findings, no state)
Source: [PROMPT P-030] "detect stuff like this is a ui with dark mode but keep it to stuff that can be detected reasonably and reliably without machine learning"

As a designer, I want findings grouped by area with confidence and what they needed, so that I know how far to trust them.

Acceptance criteria:
- Given a dark-mode finding, then it shows under "Kasutajaliides" with severity as text, confidence, provenance, "pikslid ja paigutus" and its caveats.
- Given a kind the UI does not know, then it renders with the server's title.
- Given a simulated analysis, then a note says it is example data.

## Harmony lightness and colour table filters (#70)

### US-210: See how light each harmony colour is

Automaton: Results colour analysis, Harmony (any model)
Source: [PROMPT P-032] "use the outer thickness of the ring around the color point to indicate the difference visually the thicker the lighter it is perceptually compared to the lowest perceptual brightness color"

As a designer, I want each colour's ring to thicken with its lightness above the darkest colour, so that I can compare lightness without reading numbers.

Acceptance criteria:
- Given a harmony, then the darkest colour (OKLCH L) has a 1 px ring and lighter colours thicker ones (30 px per unit ΔL, at most 16 px).
- Given I switch to HSL, HSV, HWB or RYB, then the ring widths do not change (OKLCH L everywhere).
- Given the wheel, then its hue ring is drawn at the median OKLCH lightness of the harmony's colours, on every model.

### US-211: See which colours are probably blend pixels or artefacts

Automaton: (table column, no state)
Source: [PROMPT P-032] "show the chance of segupikslid, artefacts in the 5000 colors thinghy"

As a designer, I want each colour's chance of being a blend pixel or artefact, so that I can ignore colours nobody chose.

Acceptance criteria:
- Given the server sent a chance, then the row shows the most likely kind, its chance in percent and a meter.
- Given none, then the cell shows "—".
- Given simulated values, then a note above the table says so.

### US-212: Filter colours by rough share

Automaton: Colour table filters, Unfiltered → Filtered
Source: [PROMPT P-032] "if there are are rough percentage clusters allow to filter by them not just the 5000 most common"

As a designer, I want to pick a share band, so that I can look at, say, all the colours around 1 % at once.

Acceptance criteria:
- Given shares with gaps of at least half a decade, then each group is a band chip with its range and colour count; with no gaps, decade bands.
- Given I pick a band, then the table shows its colours, including ones beyond the top N, and a status line says how many match.
- Boundary: a gap of exactly 0.5 decades splits; 0.4996 does not.

### US-213: Filter by colour cluster and artefact class

Automaton: Colour table filters, Filtered → Filtered
Source: [PROMPT P-033] items 2 and 3

As a designer, I want to combine a cluster and an artefact class with the share band, so that I can find, for example, the clean colours of one hue family.

Acceptance criteria:
- Given a cluster chip, then only colours the server put in that cluster remain.
- Given "tõenäoline (≥ 50 %)", then colours with a chance of exactly 0.5 are included; "puhas (< 50 %)" includes 0.49.
- Given filters that match nothing, then the status says "Ükski värv ei vasta filtrile.".

## 3D colour-space view (#75)

### US-214: Browse the sRGB gamut like the notebook

Automaton: 3D colour-space view, controls
Source: [PROMPT P-035] "step one is feature parity"

As a designer, I want the sampled sRGB gamut in 3D with a hue and chroma range selection, so that I can see where a range of colours lies.

Acceptance criteria:
- Given the view, then every in-gamut lattice point shows in faint grey and the selected range in its own colour, with counts of all, selected and neutral points.
- Given a hue width of 360°, then every coloured point is selected; given "include neutrals", the grey axis is too.
- Given a chroma minimum above the maximum, then "Vigane valik" is shown and nothing is selected.
- Given I switch to CIELAB, then the lattice is rebuilt with ΔE*ab 4 and the chroma range becomes 40–80.

### US-215: See how much of the gamut the image covers

Automaton: 3D colour-space view, image colours
Source: [PROMPT P-035] "The idea is to show visually how much of the whole the pixels cover."

As a designer, I want the image's colours coloured in on an even lattice with the coverage figure, so that I see at a glance how much of sRGB the image uses.

Acceptance criteria:
- Given an image, then each of its colours colours in its nearest lattice point, sized by its summed share, with a contrasting ring.
- Given the server's coverage, then the headline reads "Pilt katab X % sRGB gamutist"; given a simulated one, it says so; given none, it says the server has not sent it.
- Given I hover an occupied point, then I see L, a, b, hex, and the number of image colours and their share.

### US-216: Move freely through the colour space

Automaton: 3D colour-space view, camera
Source: [PROMPT P-035] "allowing the user to move around the camera in open space"

As a designer, I want to orbit around the gamut or fly through it, so that I can look at any part closely.

Acceptance criteria:
- Given orbit mode, then dragging turns around the gamut centre and scrolling zooms (distance 0.3–6).
- Given fly mode and focus on the view, then W A S D or the arrows move, Q and E go down and up, and dragging looks around.
- Given "Lähtesta vaade", or a new space, then the default three-quarter view returns.

### US-217: Choose the background of a viewer

Automaton: (setting, no state machine)
Source: [PROMPT P-037] "allow to change the background color of the 3d pointcloud and the picture viewer thingy"

As a designer, I want to set the background of the 3D view and the pixel viewer, so that colours can be judged against white, grey or black.

Acceptance criteria:
- Given a preset or any colour, then only that view's background changes; the page theme does not.
- Given a dark background in the 3D view, then its text, rings and faint lattice turn light.
- Given "vaikimisi" or "lehe taust", then the view returns to its default.
