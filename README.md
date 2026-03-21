```
  ███████╗██╗      █████╗ ███████╗██╗  ██╗
  ██╔════╝██║     ██╔══██╗██╔════╝██║  ██║
  █████╗  ██║     ███████║███████╗███████║
  ██╔══╝  ██║     ██╔══██║╚════██║██╔══██║
  ██║     ███████╗██║  ██║███████║██║  ██║
  ╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
```

### Flashcard CLI with AI superpowers

> Plain text flashcards. Smart scheduling. AI-powered generation. All from your terminal.

**flash** is a CLI-first flashcard tool that uses spaced repetition (FSRS-5) to schedule reviews and AI agents to generate cards from anything — topics, articles, code, docs, URLs. It stores everything in a human-readable `.fc` format that's git-friendly and yours to keep.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/3li7alaki/flash/main/install.sh | bash
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
flash gen "teach me about TCP/IP"          # From a topic
flash gen --from article.md                # From a file
flash gen --from https://example.com/post  # From a URL
cat notes.md | flash gen                   # From stdin
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
flash learn <topic>            # AI teaches you, finds your gaps, generates cards for weak spots
```

**Beyond generation:**

| Command | What it does |
|---------|-------------|
| `flash weak` | Analyzes your mistakes and generates targeted cards |
| `flash explain <card-id>` | Deeper explanation of a card you're struggling with |
| `flash rephrase <card-id>` | AI rephrases a confusing card so it clicks |
| `flash challenge` | Generates harder variants of cards you've mastered |
| `flash summarize <deck>` | Generates a cheat sheet from a deck |

### Claude Code Integration

Study without leaving your editor. The same AI agents that power the CLI run natively inside Claude Code.

**Skills:**
```
/flash review [deck]     — Review session inside Claude Code
/flash gen "topic"       — Generate a deck from conversation context
/flash weak              — Weak cards with AI explanations
/flash quiz              — Quick quiz (5-10 cards)
/flash stats             — Learning dashboard
```

**Agents:**
- **Quiz Agent** — Asks cards, judges your answer conversationally (not exact match), detects confidence
- **Coach Agent** — Spots patterns in your mistakes, suggests what to study, adapts explanations
- **Generator Agent** — Creates cards from code, docs, or topics you're discussing

### Git-Based Sync & Sharing

Decks are plain text. Git handles everything else.

```bash
flash share <deck>              # Publish deck as a GitHub repo
flash follow <url>              # Follow someone's shared deck
flash sync                      # Pull updates from followed decks + push your own
```

Share a deck → others follow it → you update cards → they get the updates. No proprietary sync. Just git.

## Configuration

Config lives at `~/.config/flash/config.json`. Run `flash config setup` to configure your API key and model interactively.

```json
{
  "ai": {
    "provider": "openrouter",
    "apiKey": "",
    "model": "deepseek/deepseek-chat-v3-0324"
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
| `ai.apiKey` | API key (also via `FLASH_API_KEY` env var) | — |
| `ai.model` | Model for generation and grading | `deepseek/deepseek-chat-v3-0324` |
| `scheduler.algorithm` | Scheduling algorithm | `fsrs-5` |
| `review.aiGrading` | AI evaluates answers instead of self-grading | `true` |
| `review.showHints` | Show hints during review | `true` |
| `review.cardsPerSession` | Max cards per session (0 = all due) | `0` |
| `decksDir` | Where decks are stored | `~/flashcards` |
| `editor` | Editor for `flash edit` | `$EDITOR` |

## CLI Reference

### Core

```bash
flash new <name>                       # Create a new deck
flash new <name> --template <template> # Create from a template
flash add <deck>                       # Add a card (interactive or --question/--answer flags)
flash edit <deck>                      # Open deck in $EDITOR
flash list                             # List all decks with stats
flash review [deck]                    # Start review session (FSRS-scheduled)
flash review --tag <tag>               # Review by tag across decks
flash review --mix                     # Interleaved review across decks
flash stats [deck]                     # Learning stats and weak areas
flash daily                            # Dashboard: due cards, weak spots, study plan
flash search <query>                   # Search across all decks
flash merge <deck1> <deck2>            # Merge two decks
flash lint [deck]                      # Validate .fc files, report errors
flash fix [deck]                       # Auto-fix format issues
flash config                           # Show current settings
flash config setup                     # Interactive API key and model setup
flash config setup --key <key> [--model <id>]  # Headless setup
```

### Import/Export

```bash
flash export <deck> --format csv       # Export deck to CSV
flash import <file.csv> [deck] [--append]  # Import cards from CSV
```

### AI-Powered

```bash
flash gen "topic"                      # Generate deck from topic
flash gen --from <file>                # Generate from file
flash gen --from <url>                 # Generate from URL
cat file | flash gen                   # Generate from stdin
flash learn <topic>                    # Socratic teaching mode
flash weak [--save]                    # Analyze mistakes, generate targeted cards
flash explain <card-id>                # Deep explanation
flash rephrase <card-id>              # Clearer phrasing
flash challenge [--save]               # Harder variants of mastered cards
flash summarize <deck>                 # Generate cheat sheet
```

### Ecosystem

```bash
flash share <deck>                     # Publish deck as a GitHub repo
flash follow <url>                     # Follow a shared deck
flash sync                             # Pull followed deck updates + push yours
flash templates                        # List deck templates
```

### Maintenance

```bash
flash update                           # Update flash to latest version
flash doctor                           # Health check — config, deps, state
flash version                          # Show current version
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
