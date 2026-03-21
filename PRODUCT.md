# fc — Product Specification

## What is fc?

fc is a CLI flashcard tool that combines spaced repetition scheduling with AI-powered card generation and answer evaluation. It uses a custom plain-text format (`.fc`) designed for both humans and machines, stores review state separately, and integrates into developer workflows via Claude Code.

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
- **Machine-parseable** — unambiguous, efficient for AI to generate and parse
- **Git-friendly** — clean diffs, mergeable, no binary content
- **Minimal** — only the fields that matter, no boilerplate
- **Text-only** — no images, no binary attachments

### Deck Structure

```
@deck <name>
@tags <comma-separated tags>
@created <YYYY-MM-DD>
@template <template name>          # optional

---
<card>
---
<card>
---
```

- `@` prefix for deck-level metadata
- `---` separates cards
- Deck metadata is optional except `@deck`

### Card Types

**Standard Q/A** — default type, no `type:` field needed
```
Q: What happens when you assign a variable to another in Rust?
A: Ownership moves (for non-Copy types). The original variable is invalidated.
tags: ownership, move-semantics
hint: Think about the difference between Copy and non-Copy types
```

**Cloze deletion** — fill-in-the-blank, hidden text in `{{}}`
```
Q: Rust ensures memory safety at compile time through the {{borrow checker}}.
type: cloze
tags: compiler, safety
```

**Code output** — "what does this code do/print?"
```
Q: What does this code print?
  let x = vec![1, 2, 3];
  let y = x;
  println!("{:?}", x);
A: It doesn't compile. Ownership moved to y, so x is invalidated.
type: code-output
tags: ownership
```

**Reversible** — auto-generates A→Q direction for bidirectional recall
```
Q: What's the difference between &T and &mut T?
A: &T is a shared (immutable) borrow. &mut T is an exclusive (mutable) borrow.
tags: borrowing
reversible: true
```

### Card Fields

| Field | Required | Description |
|-------|----------|-------------|
| `Q:` | yes | Question (multiline supported) |
| `A:` | yes (except cloze) | Answer (multiline supported) |
| `tags:` | no | Comma-separated per-card tags |
| `type:` | no | `cloze`, `code-output` (default: standard Q/A) |
| `hint:` | no | Shown before revealing answer |
| `difficulty:` | no | Manual difficulty override (1-5) |
| `source:` | no | Origin — url, book title, `ai-generated`, etc. |
| `reversible:` | no | `true` to auto-generate reverse card |

### Parsing Rules

1. Lines starting with `@` before the first `---` are deck metadata
2. `---` on its own line separates cards
3. `Q:` starts the question (continues until `A:`, `type:`, `tags:`, `hint:`, `difficulty:`, `source:`, `reversible:`, or `---`)
4. `A:` starts the answer (continues until a field keyword or `---`)
5. Multiline: any indented line continues the previous `Q:` or `A:` block
6. Blank lines within Q/A blocks are preserved
7. Card IDs are generated from a deterministic hash of the question content

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

State migration: if a question is edited, a new ID is generated. The scheduler detects orphaned IDs and migrates state based on fuzzy matching.

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
- Used by: `fc review` (when `review.aiGrading` enabled), Quiz Agent in Claude Code

**Generator Agent**
- Role: Creates high-quality flashcards from source content
- Input: content (text, code, URL content), target card count, existing deck tags
- Output: array of cards in `.fc` format
- Used by: `fc gen`, Generator skill in Claude Code

**Teacher Agent**
- Role: Teaches a topic through Socratic questioning, identifies knowledge gaps
- Input: topic, conversation history
- Output: questions, explanations, identified gaps, generated cards for weak areas
- Used by: `fc learn`

**Analyzer Agent**
- Role: Analyzes review history to find patterns in mistakes
- Input: review state data, card content
- Output: weak areas, suggested cards, study recommendations
- Used by: `fc weak`, `fc daily`, Coach Agent in Claude Code

**Explainer Agent**
- Role: Provides deeper explanations or rephrases confusing cards
- Input: card content, review history (how many times failed), mode (explain or rephrase)
- Output: explanation or rephrased card
- Used by: `fc explain`, `fc rephrase`

**Challenger Agent**
- Role: Generates harder variants of mastered cards
- Input: mastered card content, related tags
- Output: harder cards in `.fc` format
- Used by: `fc challenge`

**Summarizer Agent**
- Role: Creates a study cheat sheet from a deck
- Input: all cards in a deck
- Output: organized summary/cheat sheet
- Used by: `fc summarize`

### Claude Code Agents (Composite)

These agents compose the base agents above for conversational use:

**Quiz Agent** — wraps Grader Agent with conversational flow. Asks cards, accepts natural language answers, detects confidence from phrasing ("I think..." = uncertain), provides feedback, suggests next steps.

**Coach Agent** — wraps Analyzer Agent with personalized recommendations. Spots patterns across sessions, adapts explanation style based on what clicks for the user.

**Generator Agent (Claude Code)** — wraps Generator Agent with conversation context. Creates cards from code being read, docs being explored, or topics being discussed.

---

## Configuration

Config at `~/.config/fc/config.json` (XDG-compliant).

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
| `editor` | Editor for `fc edit` | `"$EDITOR"` |

API key can also be set via `FC_API_KEY` environment variable (takes precedence over config).

---

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Runtime | Bun | Fast startup for CLI, zero-config TypeScript, built-in test runner |
| Scheduling | ts-fsrs | Maintained FSRS-5 implementation |
| LLM | OpenRouter API | Model flexibility — one API, any model |
| Terminal UI | @clack/prompts | Lightweight, clean interactive prompts |
| Storage | `.fc` + `.fc.state` JSON | Human-readable content, structured state |
| Config | JSON (`~/.config/fc/`) | XDG-compliant, zero deps, native Bun support |
| Sync | Git | Plain text = free version control and sharing |
| Claude Code | Custom skills + agents | Deep editor workflow integration |

## Architecture

```
~/.config/fc/
  config.json              # API key, model, algorithm, preferences
  templates/               # Deck templates

~/flashcards/              # Default deck directory (configurable)
  rust-ownership.fc        # Deck file (human-editable)
  rust-ownership.fc.state  # Review state (managed by fc)

src/
  ├── cli.ts               # Entry point, command routing
  ├── commands/             # Command handlers
  ├── format/               # .fc parser and serializer
  │   ├── parser.ts
  │   └── serializer.ts
  ├── agents/               # Agent definitions (prompts + schemas)
  │   ├── grader.ts
  │   ├── generator.ts
  │   ├── teacher.ts
  │   ├── analyzer.ts
  │   ├── explainer.ts
  │   ├── challenger.ts
  │   └── summarizer.ts
  ├── ai/                   # LLM client (OpenRouter)
  │   └── client.ts
  ├── scheduler/            # FSRS-5 wrapper
  │   └── scheduler.ts
  ├── review/               # Interactive review engine
  │   └── engine.ts
  ├── config/               # Config management
  │   └── config.ts
  └── claude-code/          # Claude Code skills + composite agents
      ├── skills/
      └── agents/

docs/
  └── adr/                  # Architecture Decision Records
```

---

## CLI Lifecycle

### Versioning

fc uses semantic versioning (`MAJOR.MINOR.PATCH`). Version is stored in `package.json`.

- **MAJOR** — breaking changes to `.fc` format, config schema, or CLI interface
- **MINOR** — new commands, new card fields, new config options
- **PATCH** — bug fixes, prompt improvements, performance

### Update

`fc update` pulls the latest version from git (same pattern as the install script). It:
1. Fetches latest from origin
2. Compares versions
3. Runs config migration if the config schema changed
4. Reports what changed

### Config Migration

When the config schema changes between versions, fc handles it automatically:
1. On startup, fc reads `config.json` and checks for a `version` field
2. If missing or outdated, it runs migrations sequentially (v1→v2→v3...)
3. Each migration adds new fields with defaults, renames changed fields, removes deprecated ones
4. The original config is backed up to `config.json.bak` before migration
5. User is notified of what changed

This means users never face broken configs after updating.

### Doctor

`fc doctor` runs health checks:
- Config exists and is valid JSON
- Config schema is current version (runs migration if not)
- API key is set (warn if missing — not an error, AI features are optional)
- Decks directory exists and is readable
- `.fc` files in decks dir are parseable (reports any format errors)
- `.fc.state` files have valid structure
- Bun version is compatible
- Git is available (for sync/share features)

---

## Phased Delivery

### Phase 1 — Core CLI (offline, no AI)
Everything needed to create, review, and manage flashcards without an API key.

- `.fc` format parser/serializer (all card types)
- Deck management: `fc new`, `fc add`, `fc edit`, `fc list`, `fc search`, `fc merge`
- Review engine with FSRS-5 scheduling, tag filtering, interleaved mode
- Self-grading during review (again/hard/good/easy)
- Stats and daily dashboard
- Config system
- Deck templates
- Install script (one-liner, bootstraps Bun)

### Phase 2 — AI Integration
Agent-powered AI features via OpenRouter.

- Agent architecture: client, prompt system, structured I/O
- Grader Agent → AI answer grading in `fc review`
- Generator Agent → `fc gen` from topics, files, URLs, stdin
- Teacher Agent → `fc learn` Socratic mode
- Analyzer Agent → `fc weak`, enhanced `fc daily`
- Explainer Agent → `fc explain`, `fc rephrase`
- Challenger Agent → `fc challenge`
- Summarizer Agent → `fc summarize`

### Phase 3 — Claude Code Integration
Same agents, conversational interface.

- `/fc` slash command skills
- Quiz Agent (wraps Grader) — conversational review with confidence detection
- Coach Agent (wraps Analyzer) — personalized learning patterns
- Generator Agent (Claude Code) — cards from conversation context

### Phase 4 — Ecosystem
Sharing, sync, and polish.

- `fc share` + `fc follow` (git-based deck sharing)
- `fc sync` (git-based multi-device sync)
- `fc watch <dir>` — auto-generate cards from new files
- Optional TUI mode with richer terminal UI
