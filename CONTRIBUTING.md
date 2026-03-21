# Contributing to flash

## Getting Started

1. Fork the repo
2. Clone your fork
3. `bun install`
4. Create a feature branch: `git checkout -b feat/your-feature`
5. Make your changes
6. Run tests: `bun test`
7. Commit with the conventions below
8. Push and open a PR

## Commit Conventions

Format: `type(scope): description`

**Types:**
- `feat` — new command, card type, or capability
- `fix` — bug fix
- `docs` — documentation only
- `refactor` — restructuring without changing behavior
- `test` — adding or updating tests
- `chore` — maintenance (CI, deps, config)

**Scope:** use the component name (e.g., `parser`, `scheduler`, `ai`, `review`).

## The `.fc` Format

If you're modifying the parser or adding card features:

- Keep the format human-writable — if it's hard to type by hand, it's wrong
- Keep the format machine-parseable — unambiguous, no context-dependent parsing
- Card content lives in `.fc` files, review state lives in `.fc.state` files — never mix them
- Test with multiline content, special characters, and edge cases
- See [PRODUCT.md](PRODUCT.md) for the full format specification

## Writing Commands

- Commands go in `src/commands/`, one file per command
- All commands must support headless mode via flags (no hanging prompts)
- AI-powered commands should fail gracefully when offline (error message, not crash)
- Core commands must work fully offline

## Tests

Run before submitting:

```bash
bun test
```

Cover at minimum:
- `.fc` parser: all card types, edge cases, malformed input
- Scheduler: FSRS-5 calculations, rating transitions
- Commands: expected input/output

## PRs

- One logical change per PR
- All tests must pass
- Update docs if you're changing CLI behavior or the `.fc` format
