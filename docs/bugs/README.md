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
| 2026-11-17 | validation | The PDF reader reported "path limit" on a page with exactly the maximum number of paths; found by a boundary test before commit | Check the limit when a path would be added, not after every token | #45 | — |
| 2026-11-17 | validation | `crop` with an origin past the right or bottom edge read pixels from the next row instead of returning a transparent 1 × 1; found by the compliance review before commit | Return a transparent 1 × 1 when nothing of the rectangle is inside the image | #44 | — |
