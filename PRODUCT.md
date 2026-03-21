# flash — Product Specification

## What is flash?

flash is a CLI flashcard tool that combines spaced repetition scheduling with AI-powered card generation and answer evaluation. It uses a custom plain-text format (`.fc`) designed for both humans and machines, stores review state separately, and integrates into developer workflows via Claude Code.

## Problem

Flashcard tools fall into two camps:

1. **GUI-based** (Anki, Quizlet) — powerful scheduling but locked behind desktop/web UIs, proprietary formats, vendor lock-in
2. **CLI toys** — plain text but no smart scheduling, no AI, no real learning science

Developers who want to learn in the terminal have nothing that combines real spaced repetition, AI assistance, and a format they can own and version control.

## Core Principles

1. **Plain text ownership** — `.fc` files are human-readable, machine-parseable, diffable, git-friendly. You own your data.
2. **CLI-first** — No GUI, no browser, no electron. Fast commands in the terminal.
3. **AI-augmented, not AI-dependent** — Core review works offline. AI enhances creation, coaching, and answer evaluation.
4. **Smart scheduling over gamification** — No streaks, no XP. FSRS-5 adapts to your actual performance.
5. **Developer workflow native** — Claude Code integration so you can study where you code.
6. **Agent-first AI** — All AI features are powered by well-defined agents. Same agents, same prompts, same logic — whether running in CLI mode (via OpenRouter) or Claude Code mode (as native subagents).

## Design Decisions

Architectural decisions are tracked in `docs/adr/`. Key decisions:

- [ADR-001](docs/adr/001-fc-format.md) — `.fc` plain text format over YAML/TOML/JSON
- [ADR-002](docs/adr/002-agent-architecture.md) — Unified agent architecture for CLI and Claude Code
- [ADR-003](docs/adr/003-state-separation.md) — Separate `.fc.state` files for review state
- [ADR-004](docs/adr/004-bun-runtime.md) — Bun over Node.js for CLI runtime

---

## The `.fc` Format

### Design Goals

- **Human-writable** — create cards in any text editor without reading docs
- **Machine-parseable** — unambiguous, deterministic, efficient for AI to generate and parse
- **CSV-roundtrippable** — `.fc` ↔ CSV conversion must be lossless; if it round-trips cleanly, the format has no ambiguity
- **Git-friendly** — clean diffs, mergeable, no binary content
- **Minimal** — only the fields that matter, no boilerplate
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
Q: What's the difference between &T and &mut T?
A: &T is a shared (immutable) borrow. &mut T is an exclusive (mutable) borrow.
tags: borrowing
reversible: true
---
```

### Deck Metadata

- `@deck` — deck name (optional — defaults to filename without `.fc` extension)
- `@tags` — deck-wide tags (comma-separated)
- `@created` — creation date (YYYY-MM-DD)
- `@template` — template used to create this deck (if any)

All metadata is optional. A file with just cards and `---` separators is valid.

### Card Types

| Type | Detection | Description |
|------|-----------|-------------|
| **Q/A** | Default (no `type:` needed) | Standard question and answer |
| **Cloze** | Auto-detected from `{{}}` in question | Fill-in-the-blank — hidden text is the answer |
| **Code Output** | `type: code-output` | "What does this code do/print?" |
| **Reversible** | `reversible: true` | Auto-generates A→Q direction for bidirectional recall |

Cloze is auto-detected — if the question contains `{{text}}`, it's a cloze card. No `type: cloze` needed. `type: code-output` is explicit because there's no syntax signal to auto-detect it.

### Card Fields

| Field | Required | Description |
|-------|----------|-------------|
| `Q:` | yes | Question (multiline — continue with indented lines) |
| `A:` | yes (except cloze) | Answer (multiline — continue with indented lines) |
| `tags:` | no | Comma-separated per-card tags |
| `type:` | no | `code-output` (Q/A is default, cloze is auto-detected) |
| `hint:` | no | Shown before revealing answer |
| `difficulty:` | no | Manual difficulty override (1-5) |
| `source:` | no | Origin — url, book title, `ai-generated`, etc. |
| `reversible:` | no | `true` to auto-generate reverse card |

### Parsing Rules

These rules are strict and unambiguous — they enable deterministic parsing and lossless CSV round-tripping.

1. **Deck metadata:** Lines starting with `@` before the first `---` are deck metadata. Format: `@key value`
2. **Card separator:** `---` alone on a line (no other content) separates cards
3. **Field keywords:** `Q:`, `A:`, `tags:`, `type:`, `hint:`, `difficulty:`, `source:`, `reversible:` are recognized **only at the start of a line** (column 0). This means answer text can contain "tags:" or "hint:" mid-sentence without ambiguity.
4. **Multiline content:** Any line starting with whitespace (space or tab) continues the previous `Q:` or `A:` block. Blank lines within Q/A blocks are preserved.
5. **Field order:** Any order within a card is valid. Parser handles all permutations.
6. **Empty cards:** Cards with no `Q:` field are skipped silently by the parser but reported by the linter.
7. **Cloze auto-detection:** If `Q:` contains `{{text}}`, the card type is `cloze` regardless of `type:` field.
8. **Card IDs:** Generated from a deterministic hash of the normalized question text (trimmed, collapsed whitespace, lowercased). Stable across reformatting.

### CSV Mapping

The `.fc` format maps cleanly to flat CSV rows. This is a design constraint — if a card can't be represented as a single CSV row, the format is too complex.

| `.fc` field | CSV column | Notes |
|-------------|------------|-------|
| `Q:` (multiline joined) | `question` | Newlines preserved as `\n` in quoted CSV |
| `A:` (multiline joined) | `answer` | Newlines preserved as `\n` in quoted CSV |
| `tags:` | `tags` | Comma-separated string |
| `type:` or auto-detected | `type` | `qa`, `cloze`, `code-output` |
| `hint:` | `hint` | |
| `difficulty:` | `difficulty` | 1-5 or empty |
| `source:` | `source` | |
| `reversible:` | `reversible` | `true` or empty |

Deck metadata is not included in CSV (it's per-file, not per-card). When importing CSV, deck metadata comes from the target file or command flags.

### Format Tooling

| Tool | What it does |
|------|-------------|
| **Parser** | `.fc` → structured card objects. Strict. Reports errors with line numbers. |
| **Serializer** | Card objects → `.fc` text. Deterministic output (stable diffs). |
| **Linter** | Validates `.fc` files: missing Q/A, orphaned fields, bad cloze syntax, duplicate cards, invalid field values. Reports warnings and errors with line numbers. |
| **Fixer** | Auto-fixes common issues: normalize whitespace, sort tags, fix indentation, remove empty cards. |
| **CSV import** | CSV → card objects → `.fc` file |
| **CSV export** | `.fc` → card objects → CSV |

**Round-trip invariant:** `.fc` → CSV → `.fc` must produce identical output. This is tested automatically and guarantees format correctness.

### Review State

Stored in `.fc.state` JSON files alongside deck files. Content and state are always separate.

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

**Card ID migration:** When a question is edited, a new ID is generated. The scheduler attempts to migrate state: exact match first, then Levenshtein distance < 30% of question length. If no match, the card starts fresh. Orphaned state entries are pruned on next review.

---

## Agent Architecture

All AI features are powered by agents — well-defined units with a role, inputs, outputs, and system prompt. The same agents run in both CLI mode and Claude Code mode.

### How It Works

```
User request (CLI or Claude Code)
        │
  Route to agent
        │
  ┌─────────────────────────────┐
  │  Agent (role + prompt)      │
  │                             │
  │  CLI mode:                  │
  │    → OpenRouter API call    │
  │    → parse response         │
  │    → return structured data │
  │                             │
  │  Claude Code mode:          │
  │    → native subagent        │
  │    → same prompt            │
  │    → conversational output  │
  └─────────────────────────────┘
        │
  Command handler formats output
```

### Agent Definitions

Each agent is defined by:
- **Role** — one sentence describing what it does
- **System prompt** — instructions for the LLM
- **Input schema** — what it receives
- **Output schema** — what it returns (structured in CLI mode, conversational in Claude Code mode)

Agents live in `src/agents/` as TypeScript modules that export their prompt and schemas.

### Agents

**Grader Agent**
- Role: Evaluates user answers against correct answers using semantic similarity
- Input: question, correct answer, user answer
- Output: correct/partial/incorrect, feedback, suggested rating
- Used by: `flash review` (when `review.aiGrading` enabled), Quiz Agent in Claude Code

**Generator Agent**
- Role: Creates high-quality flashcards from source content
- Input: content (text, code, URL content), target card count, existing deck tags
- Output: array of cards in `.fc` format
- Used by: `flash gen`, Generator skill in Claude Code

**Teacher Agent**
- Role: Teaches a topic through Socratic questioning, identifies knowledge gaps
- Input: topic, conversation history
- Output: questions, explanations, identified gaps, generated cards for weak areas
- Used by: `flash learn`

**Analyzer Agent**
- Role: Analyzes review history to find patterns in mistakes
- Input: review state data, card content
- Output: weak areas, suggested cards, study recommendations
- Used by: `flash weak`, `flash daily`, Coach Agent in Claude Code

**Explainer Agent**
- Role: Provides deeper explanations or rephrases confusing cards
- Input: card content, review history (how many times failed), mode (explain or rephrase)
- Output: explanation or rephrased card
- Used by: `flash explain`, `flash rephrase`

**Challenger Agent**
- Role: Generates harder variants of mastered cards
- Input: mastered card content, related tags
- Output: harder cards in `.fc` format
- Used by: `flash challenge`

**Summarizer Agent**
- Role: Creates a study cheat sheet from a deck
- Input: all cards in a deck
- Output: organized summary/cheat sheet
- Used by: `flash summarize`

### Claude Code Agents (Composite)

These agents compose the base agents above for conversational use:

**Quiz Agent** — wraps Grader Agent with conversational flow. Asks cards, accepts natural language answers, detects confidence from phrasing ("I think..." = uncertain), provides feedback, suggests next steps.

**Coach Agent** — wraps Analyzer Agent with personalized recommendations. Spots patterns across sessions, adapts explanation style based on what clicks for the user.

**Generator Agent (Claude Code)** — wraps Generator Agent with conversation context. Creates cards from code being read, docs being explored, or topics being discussed.

---

## Configuration

Config at `~/.config/flash/config.json` (XDG-compliant).

```json
{
  "ai": {
    "provider": "openrouter",
    "apiKey": "",
    "model": "anthropic/claude-sonnet-4"
  },
  "scheduler": {
    "algorithm": "fsrs-5"
  },
  "review": {
    "aiGrading": true,
    "showHints": true,
    "cardsPerSession": 0
  },
  "decksDir": "~/flashcards",
  "editor": "$EDITOR"
}
```

| Key | Description | Default |
|-----|-------------|---------|
| `ai.provider` | LLM provider | `"openrouter"` |
| `ai.apiKey` | API key | `""` |
| `ai.model` | Model for generation and grading | `"anthropic/claude-sonnet-4"` |
| `scheduler.algorithm` | Scheduling algorithm | `"fsrs-5"` |
| `review.aiGrading` | AI evaluates answer similarity instead of self-grading | `true` |
| `review.showHints` | Show hints during review | `true` |
| `review.cardsPerSession` | Max cards per session (0 = all due) | `0` |
| `decksDir` | Where decks are stored | `"~/flashcards"` |
| `editor` | Editor for `flash edit` | `"$EDITOR"` |

API key can also be set via `FLASH_API_KEY` environment variable (takes precedence over config).

---

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Runtime | Bun | Fast startup for CLI, zero-config TypeScript, built-in test runner |
| Scheduling | ts-fsrs | Maintained FSRS-5 implementation |
| LLM | Vercel AI SDK + OpenRouter | Structured output via Zod, streaming, retries — any model via OpenRouter |
| Terminal UI | @clack/prompts | Lightweight, clean interactive prompts |
| Storage | `.fc` + `.fc.state` JSON | Human-readable content, structured state |
| Config | JSON (`~/.config/flash/`) | XDG-compliant, zero deps, native Bun support |
| Sync | Git | Plain text = free version control and sharing |
| Claude Code | Custom skills + agents | Deep editor workflow integration |

## Architecture

```
~/.config/flash/
  config.json              # API key, model, algorithm, preferences
  templates/               # Deck templates

~/flashcards/              # Default deck directory (configurable)
  rust-ownership.fc        # Deck file (human-editable)
  rust-ownership.fc.state  # Review state (managed by flash)

src/
  ├── cli.ts               # Entry point, command routing
  ├── commands/             # Command handlers
  ├── format/               # .fc parser, serializer, linter, fixer, CSV
  │   ├── parser.ts         # .fc → card objects
  │   ├── serializer.ts     # card objects → .fc text
  │   ├── linter.ts         # validate .fc files
  │   ├── fixer.ts          # auto-fix format issues
  │   └── csv.ts            # CSV import/export
  ├── agents/               # Agent definitions (prompts + schemas)
  │   ├── grader.ts
  │   ├── generator.ts
  │   ├── teacher.ts
  │   ├── analyzer.ts
  │   ├── explainer.ts
  │   ├── challenger.ts
  │   └── summarizer.ts
  ├── ai/                   # LLM integration (Vercel AI SDK + OpenRouter)
  │   ├── client.ts         # Provider setup
  │   └── agent.ts          # Agent framework (defineAgent + Zod schemas)
  ├── scheduler/            # FSRS-5 wrapper
  │   └── scheduler.ts
  ├── review/               # Interactive review engine
  │   └── engine.ts
  ├── config/               # Config management
  │   └── config.ts
  └── types.ts              # Shared type definitions

skills/
  └── flash/SKILL.md         # Claude Code skill definition

agents/                       # Claude Code composite agent prompts
  ├── quiz-agent.md
  ├── coach-agent.md
  └── generator-agent.md

docs/
  └── adr/                  # Architecture Decision Records
```

---

## CLI Lifecycle

### Versioning

flash uses semantic versioning (`MAJOR.MINOR.PATCH`). Version is stored in `package.json`.

- **MAJOR** — breaking changes to `.fc` format, config schema, or CLI interface
- **MINOR** — new commands, new card fields, new config options
- **PATCH** — bug fixes, prompt improvements, performance

### Update

`flash update` pulls the latest version from git (same pattern as the install script). It:
1. Fetches latest from origin
2. Compares versions
3. Runs config migration if the config schema changed
4. Reports what changed

### Config Migration

When the config schema changes between versions, flash handles it automatically:
1. On startup, flash reads `config.json` and checks for a `version` field
2. If missing or outdated, it runs migrations sequentially (v1→v2→v3...)
3. Each migration adds new fields with defaults, renames changed fields, removes deprecated ones
4. The original config is backed up to `config.json.bak` before migration
5. User is notified of what changed

This means users never face broken configs after updating.

### Doctor

`flash doctor` runs health checks:
- Config exists and is valid JSON
- Config schema is current version (runs migration if not)
- API key is set (warn if missing — not an error, AI features are optional)
- Decks directory exists and is readable
- `.fc` files in decks dir are parseable (reports any format errors)
- `.fc.state` files have valid structure
- Bun version is compatible
- Git is available (for sync/share features)

