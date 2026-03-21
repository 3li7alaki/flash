```
  ███████╗ ██████╗
  ██╔════╝██╔════╝
  █████╗  ██║
  ██╔══╝  ██║
  ██║     ╚██████╗
  ╚═╝      ╚═════╝
```

### Flashcard CLI with AI superpowers

> Plain text flashcards. Smart scheduling. AI-powered generation. All from your terminal.

**fc** is a CLI-first flashcard tool that uses spaced repetition (FSRS-5) to schedule reviews and AI agents to generate cards from anything — topics, articles, code, docs, URLs. It stores everything in a human-readable `.fc` format that's git-friendly and yours to keep.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/3li7alaki/fc/main/install.sh | bash
```

## Features

### Smart Scheduling (FSRS-5)

No streaks. No gamification. Just math.

Cards you struggle with come back sooner. Cards you know get pushed further out. The FSRS-5 algorithm handles all of this — you just review.

### The `.fc` Format

A text format designed for both humans and machines — easy to write by hand, efficient for AI to generate and parse.

```
@deck Rust Ownership
@tags rust, systems-programming
@created 2026-03-21

---
Q: What happens when you assign a variable to another in Rust?
A: Ownership moves (for non-Copy types). The original variable is invalidated.
tags: ownership, move-semantics
---
Q: Rust ensures memory safety at compile time through the {{borrow checker}}.
type: cloze
tags: compiler, safety
---
Q: What does this code print?
  let x = vec![1, 2, 3];
  let y = x;
  println!("{:?}", x);
A: It doesn't compile. Ownership moved to y, so x is invalidated.
type: code-output
tags: ownership
```

**Card types:** Q/A, cloze deletions (`{{answer}}`), code-output, reversible (auto-generates A→Q)

**Your data, your files.** `.fc` files are plain text — diff them, version them, share them via git. Review state lives in separate `.fc.state` JSON files so your content stays clean.

### AI-Powered (via OpenRouter)

All AI features are powered by a unified agent architecture — the same agents work in both CLI and Claude Code. Requires an API key; core review works fully offline without one.

**Generate cards from anything:**

```bash
fc gen "teach me about TCP/IP"          # From a topic
fc gen --from article.md                # From a file
fc gen --from https://example.com/post  # From a URL
cat notes.md | fc gen                   # From stdin
```

**AI answer grading** — during review, type your answer in natural language. The AI evaluates semantic similarity, not exact wording. "the value moves" matches "ownership transfers" — it tells you what you got right and what you missed. Falls back to self-grading when offline.

```
Q: What happens when you assign a variable to another in Rust?

Your answer: the value moves and the old one can't be used
→ Correct. Ownership transfers and the original binding is invalidated.
  You covered the key concept. Rating: Good — next review in 4 days.
```

**Socratic learning:**

```bash
fc learn <topic>            # AI teaches you, finds your gaps, generates cards for weak spots
```

**Beyond generation:**

| Command | What it does |
|---------|-------------|
| `fc weak` | Analyzes your mistakes and generates targeted cards |
| `fc explain <card-id>` | Deeper explanation of a card you're struggling with |
| `fc rephrase <card-id>` | AI rephrases a confusing card so it clicks |
| `fc challenge` | Generates harder variants of cards you've mastered |
| `fc summarize <deck>` | Generates a cheat sheet from a deck |

### Claude Code Integration

Study without leaving your editor. The same AI agents that power the CLI run natively inside Claude Code.

**Skills:**
```
/fc review [deck]     — Review session inside Claude Code
/fc gen "topic"       — Generate a deck from conversation context
/fc weak              — Weak cards with AI explanations
/fc quiz              — Quick quiz (5-10 cards)
/fc stats             — Learning dashboard
```

**Agents:**
- **Quiz Agent** — Asks cards, judges your answer conversationally (not exact match), detects confidence
- **Coach Agent** — Spots patterns in your mistakes, suggests what to study, adapts explanations
- **Generator Agent** — Creates cards from code, docs, or topics you're discussing

### Git-Based Sync & Sharing

Decks are plain text. Git handles everything else.

```bash
fc share <deck>              # Publish deck as a GitHub repo
fc follow <url>              # Follow someone's shared deck
fc sync                      # Pull updates from followed decks + push your own
```

Share a deck → others follow it → you update cards → they get the updates. No proprietary sync. Just git.

## Configuration

Config lives at `~/.config/fc/config.json`. Run `fc config` to set up interactively.

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

| Key | What it does | Default |
|-----|-------------|---------|
| `ai.provider` | LLM provider | `openrouter` |
| `ai.apiKey` | API key (also via `FC_API_KEY` env var) | — |
| `ai.model` | Model for generation and grading | `anthropic/claude-sonnet-4` |
| `scheduler.algorithm` | Scheduling algorithm | `fsrs-5` |
| `review.aiGrading` | AI evaluates answers instead of self-grading | `true` |
| `review.showHints` | Show hints during review | `true` |
| `review.cardsPerSession` | Max cards per session (0 = all due) | `0` |
| `decksDir` | Where decks are stored | `~/flashcards` |
| `editor` | Editor for `fc edit` | `$EDITOR` |

## CLI Reference

### Core

```bash
fc new <name>                       # Create a new deck
fc new <name> --template <template> # Create from a template
fc add <deck>                       # Add a card interactively
fc edit <deck>                      # Open deck in $EDITOR
fc list                             # List all decks with stats
fc review [deck]                    # Start review session (FSRS-scheduled)
fc review --tag <tag>               # Review by tag across decks
fc review --mix                     # Interleaved review across decks
fc stats [deck]                     # Learning stats and weak areas
fc daily                            # Dashboard: due cards, weak spots, study plan
fc search <query>                   # Search across all decks
fc merge <deck1> <deck2>            # Merge two decks
fc lint [deck]                      # Validate .fc files, report errors
fc fix [deck]                       # Auto-fix format issues
fc config                           # Manage settings
```

### Import/Export

```bash
fc export <deck> --format csv       # Export deck to CSV
fc import <file.csv> [deck]         # Import cards from CSV
```

### AI-Powered

```bash
fc gen "topic"                      # Generate deck from topic
fc gen --from <file>                # Generate from file
fc gen --from <url>                 # Generate from URL
cat file | fc gen                   # Generate from stdin
fc learn <topic>                    # Socratic teaching mode
fc weak                             # Analyze mistakes, generate targeted cards
fc explain <card-id>                # Deep explanation
fc rephrase <card-id>              # Clearer phrasing
fc challenge                        # Harder variants of mastered cards
fc summarize <deck>                 # Generate cheat sheet
```

### Ecosystem

```bash
fc share <deck>                     # Publish deck as a GitHub repo
fc follow <url>                     # Follow a shared deck
fc sync                             # Pull followed deck updates + push yours
fc templates                        # List deck templates
```

### Maintenance

```bash
fc update                           # Update fc to latest version
fc doctor                           # Health check — config, deps, state
fc version                          # Show current version
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
