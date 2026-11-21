# Term tooltip

Status: implicit
Code locations: `src/components/Term.tsx` (`at`: null when closed, the screen position when open)
Decision: keep implicit [UNDERSTANDING]: one nullable value, two states, no invalid combination.
Analysis: none

## Transitions

| From | Event | To | Source |
|---|---|---|---|
| Closed | hover, focus, or a tap | Open, at the term's position (fixed, so a scrolling table cannot clip it) | [PROMPT P-038] "Terminitele on vaja tööriistavihjeid" |
| Open | mouse leaves, focus leaves, a second tap | Closed | [UNDERSTANDING] |
| Open | Escape | Closed; the key is marked handled, so an enclosing widget stays open | [UNDERSTANDING] |
| Open | any scroll | Closed, so it never drifts away from its term | [UNDERSTANDING] |

The explanation is always available to screen readers through `aria-describedby`, open or not.
