# ADR-001: Plain text `.fc` format

## Status
Accepted

## Context
We need a file format for storing flashcard decks. Options considered:
- JSON — machine-friendly but painful to write by hand
- YAML — human-friendly but whitespace-sensitive, ambiguous parsing edge cases
- TOML — good for config, awkward for card content with multiline Q/A
- Markdown — too flexible, hard to parse reliably for structured data
- Custom plain text — design exactly what we need

## Decision
Custom `.fc` plain text format with `@` metadata, `---` card separators, and `Q:`/`A:` fields.

## Reasoning
- Optimized for the two primary producers: humans typing in an editor and AI generating content
- No indentation sensitivity (unlike YAML)
- No quoting/escaping requirements (unlike JSON)
- `---` separators give clean diffs when cards are added/removed
- Fields are explicit keywords (`Q:`, `A:`, `tags:`) — no ambiguity
- Multiline content just works — continue on the next line
- Format is so simple that a parser is ~50 lines of code

## Consequences
- We own the parser — no third-party format dependency
- Contributors need to understand the format (documented in PRODUCT.md)
- Editor syntax highlighting would need a custom grammar (future nice-to-have)
