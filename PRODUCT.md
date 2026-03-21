# flash — Product Specification

## What is flash?

A CLI flashcard tool combining FSRS-5 spaced repetition with AI-powered card generation and answer evaluation. Uses a custom plain-text `.fc` format, stores review state separately, and integrates into developer workflows via Claude Code.

## Core Principles

1. **Plain text ownership** — `.fc` files are human-readable, machine-parseable, diffable, git-friendly
2. **CLI-first** — no GUI, no browser, no electron
3. **AI-augmented, not AI-dependent** — core review works offline, AI enhances creation and grading
4. **Smart scheduling over gamification** — no streaks, no XP, FSRS-5 adapts to performance
5. **Developer workflow native** — Claude Code integration, project-local decks
6. **Agent-first AI** — same agents, same prompts in CLI (OpenRouter) and Claude Code (native)

## Design Decisions

Architectural decisions tracked in `docs/adr/`:

- [ADR-001](docs/adr/001-fc-format.md) — `.fc` plain text format over YAML/TOML/JSON
- [ADR-002](docs/adr/002-agent-architecture.md) — Unified agent architecture for CLI and Claude Code
- [ADR-003](docs/adr/003-state-separation.md) — Separate `.fc.state` files for review state
- [ADR-004](docs/adr/004-bun-runtime.md) — Bun over Node.js for CLI runtime

---

## The `.fc` Format

### Design Goals

- **Human-writable** — create cards in any text editor without reading docs
- **Machine-parseable** — unambiguous, deterministic, efficient for AI
- **CSV-roundtrippable** — lossless `.fc` ↔ CSV conversion guarantees no ambiguity
- **Git-friendly** — clean diffs, mergeable, no binary content
- **Text-only** — no images, no binary attachments

### Deck Structure

```
@deck Rust Ownership
@tags rust, systems-programming
@created 2026-03-21

---
Q: What happens when you assign a variable to another in Rust?
A: Ownership moves (for non-Copy types). The original variable
   is invalidated and can no longer be used.
tags: ownership, move-semantics
---
Q: Rust ensures memory safety through the {{borrow checker}}.
tags: compiler, safety
---
Q: What does this code print?
   let x = vec![1, 2, 3];
   let y = x;
   println!("{:?}", x);
A: Doesn't compile. Ownership moved to y, x is invalidated.
type: code-output
tags: ownership
hint: Think about move semantics
---
Q: How many tools should an agent ideally have?
A: b
type: mcq
choices: 1-2 | 4-5 | 10-15 | As many as needed
tags: agent-design
---
Q: LLMs can reliably self-report their confidence levels.
A: False
type: true-false
tags: reliability
---
```

### Deck Metadata

- `@deck` — deck name (optional — defaults to filename without `.fc`)
- `@tags` — deck-wide tags (comma-separated)
- `@created` — creation date (YYYY-MM-DD)
- `@template` — template used to create this deck (if any)

All metadata is optional. A file with just cards and `---` separators is valid.

### Card Types

| Type | Detection | Description |
|------|-----------|-------------|
| **Q/A** | Default | Standard question and answer |
| **MCQ** | `type: mcq` + `choices:` | Multiple choice — choices shown as a/b/c/d |
| **True/False** | `type: true-false` or auto-detected from `True`/`False` answer | Binary question |
| **Cloze** | Auto-detected from `{{}}` in question | Fill-in-the-blank |
| **Code Output** | `type: code-output` | "What does this code do/print?" |
| **Reversible** | `reversible: true` | Auto-generates A→Q direction |

### Card Fields

| Field | Required | Description |
|-------|----------|-------------|
| `Q:` | yes | Question (multiline — indent continuation lines) |
| `A:` | yes (except cloze) | Answer (multiline) |
| `tags:` | no | Comma-separated per-card tags |
| `type:` | no | `code-output`, `mcq`, `true-false` (Q/A is default, cloze auto-detected) |
| `choices:` | no (required for mcq) | Pipe-separated: `Option A \| Option B \| Option C` |
| `hint:` | no | Shown before revealing answer |
| `difficulty:` | no | Manual difficulty override (1-5) |
| `source:` | no | Origin — url, book title, `ai-generated`, etc. |
| `reversible:` | no | `true` to auto-generate reverse card |

### Parsing Rules

1. **Deck metadata:** Lines starting with `@` before the first `---`. Format: `@key value`
2. **Card separator:** `---` alone on a line separates cards
3. **Field keywords:** Recognized **only at column 0** — answer text can contain "tags:" mid-sentence without ambiguity
4. **Multiline content:** Lines starting with whitespace continue the previous `Q:` or `A:` block
5. **Field order:** Any order within a card is valid
6. **Empty cards:** No `Q:` field → skipped by parser, reported by linter
7. **Cloze auto-detection:** `{{text}}` in question → cloze regardless of `type:` field
8. **True-false auto-detection:** Answer is exactly "True" or "False" → true-false
9. **MCQ auto-detection:** `choices:` field present → mcq
10. **Card IDs:** Deterministic SHA-256 hash of normalized question text (first 12 hex chars)

### CSV Mapping

| `.fc` field | CSV column | Notes |
|-------------|------------|-------|
| `Q:` | `question` | Newlines preserved as `\n` in quoted CSV |
| `A:` | `answer` | Newlines preserved as `\n` in quoted CSV |
| `tags:` | `tags` | Comma-separated string |
| `type:` | `type` | `qa`, `cloze`, `code-output`, `mcq`, `true-false` |
| `hint:` | `hint` | |
| `difficulty:` | `difficulty` | 1-5 or empty |
| `source:` | `source` | |
| `reversible:` | `reversible` | `true` or empty |
| `choices:` | `choices` | Pipe-separated |

**Round-trip invariant:** `.fc` → CSV → `.fc` must produce identical output.

### Review State

`.fc.state` JSON files alongside deck files. Content and state are always separate.

```json
{
  "deck": "rust-ownership",
  "cards": {
    "a1b2c3": {
      "stability": 4.5,
      "difficulty": 0.3,
      "due": "2026-03-25",
      "reps": 7,
      "lapses": 1,
      "last_review": "2026-03-21",
      "last_rating": "good"
    }
  }
}
```

**Card ID migration:** When a question is edited, a new ID is generated. The scheduler attempts to migrate state via Levenshtein distance. If no match, the card starts fresh.

---

## Deck Discovery

flash finds decks by walking up from cwd looking for `.flashcards/` directories — like git finds `.git/`. Falls back to the global `decksDir` from config (default: `~/flashcards`).

This enables project-local decks: commit `.flashcards/` to a repo and everyone on the team gets the same study decks.

---

## Agent Architecture

All AI features are powered by agents — defined units with a role, system prompt, input/output schemas. Same agents run in CLI mode (OpenRouter) and Claude Code mode (native subagents).

### Agents

| Agent | Role | Used by |
|-------|------|---------|
| **Grader** | Semantic answer evaluation | `flash review`, Quiz Agent |
| **Generator** | Card creation from content | `flash gen`, Claude Code Generator |
| **Teacher** | Socratic teaching, gap identification | `flash learn` |
| **Analyzer** | Review pattern analysis, weak area detection | `flash weak`, `flash daily`, Coach Agent |
| **Explainer** | Deep explanations or card rephrasing | `flash explain`, `flash rephrase` |
| **Challenger** | Harder variants of mastered cards | `flash challenge` |
| **Summarizer** | Cheat sheet generation | `flash summarize` |

### Claude Code Agents (Composite)

- **Quiz Agent** — conversational review with confidence detection
- **Coach Agent** — personalized study recommendations
- **Generator Agent** — cards from code and conversation context (writes `.fc` directly, no API cost)

---

## Configuration

Config at `~/.config/flash/config.json` (XDG-compliant). Run `flash config setup` to configure interactively, or `flash config setup --key <k> --model <m>` headlessly.

| Key | Default | Description |
|-----|---------|-------------|
| `ai.enabled` | `true` | Toggle all AI features on/off |
| `ai.provider` | `openrouter` | LLM provider |
| `ai.apiKey` | `""` | API key (also via `FLASH_API_KEY` env var) |
| `ai.model` | `deepseek/deepseek-chat-v3-0324` | Model for generation and grading |
| `scheduler.algorithm` | `fsrs-5` | Scheduling algorithm |
| `review.aiGrading` | `true` | AI evaluates answers instead of self-grading |
| `review.showHints` | `true` | Show hints during review |
| `review.cardsPerSession` | `0` | Max cards per session (0 = all due) |
| `decksDir` | `~/flashcards` | Global deck directory |
| `editor` | `$EDITOR` | Editor for `flash edit` |

---

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Runtime | Bun | Fast startup, zero-config TypeScript, built-in test runner |
| Scheduling | ts-fsrs | Maintained FSRS-5 implementation |
| LLM | Vercel AI SDK + OpenRouter | Structured output via Zod, any model |
| Terminal UI | @clack/prompts | Lightweight interactive prompts |
| Config | JSON (`~/.config/flash/`) | XDG-compliant, zero deps |
| Sync | Git | Plain text = free version control and sharing |
