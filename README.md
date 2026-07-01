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

## Quick Start

```bash
flash config setup                     # Set up API key and model
flash new "Rust Ownership"             # Create a deck
flash add rust-ownership               # Add cards interactively
flash review                           # Start reviewing
```

## The `.fc` Format

```
@deck Rust Ownership
@tags rust, systems-programming

---
Q: What happens when you assign a variable to another in Rust?
A: Ownership moves (for non-Copy types). The original variable is invalidated.
tags: ownership, move-semantics
---
Q: Rust ensures memory safety through the {{borrow checker}}.
tags: compiler, safety
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

**Card types:** Q/A, cloze (`{{answer}}`), code-output, MCQ (`choices:`), true/false, reversible

> Full `.fc` format spec, parsing rules, and config schema: **[PRODUCT.md](PRODUCT.md)**

**Your data, your files.** Plain text. Diff them, version them, share them via git. Review state lives in separate `.fc.state` files so content stays clean.

**Project-local decks.** Create a `.flashcards/` directory in any project and flash auto-discovers it — like git finds `.git/`. Falls back to `~/flashcards` when no local directory is found.

## AI Features

All AI features use OpenRouter. Core review works fully offline without an API key.

```bash
flash gen "teach me about TCP/IP"          # Generate from a topic
flash gen --from article.pdf               # Generate from a file or PDF
flash gen --from https://example.com/post  # Generate from a URL
flash learn <topic>                        # Socratic teaching mode
flash weak [--save]                        # Analyze mistakes, suggest cards
flash explain <card-id>                    # Deep explanation of a card
flash rephrase <card-id>                   # Rewrite a confusing card
flash challenge [--save]                   # Harder variants of mastered cards
flash summarize <deck>                     # Cheat sheet from a deck
```

AI grading during review evaluates semantic similarity — "the value moves" matches "ownership transfers."

## Claude Code Integration

Install includes a Claude Code plugin. Same agents, conversational interface.

```
/flash review [deck]     — Review session inside Claude Code
/flash gen "topic"       — Generate cards from conversation context
/flash weak              — Weak cards with AI explanations
/flash quiz              — Quick quiz
/flash stats             — Learning dashboard
```

## CLI Reference

```bash
# Core
flash new <name> [--template <t>]          flash add <deck>
flash edit <deck>                          flash list
flash review [deck] [--tag <t>]            flash stats [deck]
flash daily                                flash search <query>
flash merge <deck1> <deck2>                flash lint [deck]
flash fix [deck]                           flash templates

# Config
flash config                               flash config setup
flash config setup --key <k> [--model <m>] flash config set <key> <val>

# Import/Export
flash export <deck> --format csv           flash import <file.csv> [deck] [--append]

# Ecosystem
flash share <deck>                         flash follow <url>
flash sync

# Maintenance
flash update                               flash doctor
flash version
```

All commands support headless mode via flags for CI and Claude Code.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
