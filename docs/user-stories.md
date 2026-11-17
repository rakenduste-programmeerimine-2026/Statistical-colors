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
