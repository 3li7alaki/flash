# ADR-003: Separate `.fc.state` files for review state

## Status
Accepted

## Context
Review state (scheduling data, repetition count, difficulty scores) needs to be stored somewhere. Options:
1. Inline in the `.fc` file alongside card content
2. Separate `.fc.state` JSON file per deck
3. Single global state database (SQLite, etc.)

## Decision
Option 2 — separate `.fc.state` JSON files alongside each deck file.

## Reasoning
- Deck files stay clean and human-editable — no machine-generated noise mixed with card content
- State is per-deck, easy to reason about
- JSON is trivially readable by Bun without deps
- Git-friendly: content changes and state changes are separate commits
- If state gets corrupted, you lose scheduling data but never lose cards
- No database dependency — just files

## Consequences
- Two files per deck (`.fc` + `.fc.state`)
- Card IDs must be stable — derived from question content hash
- State migration needed when questions are edited (fuzzy match orphaned IDs)
- `.fc.state` files should be gitignored by default for shared decks (scheduling is personal), but included for personal sync
