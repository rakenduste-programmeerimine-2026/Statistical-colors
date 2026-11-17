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
