---
name: flash
description: >
  Generate, review, and master flashcards inside Claude Code. Use when the user says
  "flash", "flashcard", "make cards", "quiz me", "review cards", "study", or invokes
  /flash commands. Generates cards from code, docs, PDFs, topics, or conversation context.
user_invocable: true
---

# flash — Flashcard CLI inside Claude Code

You have access to the `flash` CLI tool for flashcard management. Use it via Bash.

## Commands

### Generate cards from what you see

When the user asks to generate flashcards from code, docs, or context:

1. **From the current codebase** — read relevant files, understand patterns, then generate cards:
   ```bash
   flash gen "topic description"
   ```
   But better: use your codebase knowledge to build higher-quality cards. Read the files yourself, understand the concepts, then write a .fc file directly or pipe content to flash gen.

2. **From a file** (including PDFs):
   ```bash
   flash gen --from path/to/file.pdf
   flash gen --from path/to/notes.md
   flash gen --from path/to/code.ts
   ```

3. **From a URL:**
   ```bash
   flash gen --from https://example.com/article
   ```

4. **From conversation context** — if the user has been discussing a topic, summarize the key concepts and generate cards:
   ```bash
   echo "key concepts from our conversation" | flash gen
   ```

### Review cards

```bash
flash review [deck-name]         # Review due cards
flash review --tag <tag>         # Review by tag
flash review --mix               # Interleave across decks
```

For conversational review inside Claude Code — act as the Quiz Agent:
- Read the deck file and state file
- Present cards one at a time
- Accept natural language answers
- Judge answers semantically (not exact match)
- Detect confidence from phrasing ("I think..." = uncertain)
- Provide feedback and rate the card
- Update state via flash CLI after each card

### Analyze and coach

```bash
flash weak                       # Find weak areas
flash explain <card-id>          # Deeper explanation
flash rephrase <card-id>         # Rewrite confusing card
flash challenge                  # Harder variants of mastered cards
flash summarize <deck>           # Cheat sheet from a deck
```

### Study with Socratic mode

```bash
flash learn <topic>              # Interactive teaching session
```

Or do it conversationally — teach the user through questions, identify gaps, then generate targeted cards.

### Manage decks

```bash
flash new "Deck Name"            # Create deck
flash new "Name" --template X    # From template
flash add <deck>                 # Add card interactively
flash edit <deck>                # Open in editor
flash list                       # List all decks
flash stats [deck]               # Learning stats
flash daily                      # Daily dashboard
flash search <query>             # Search across decks
flash lint [deck]                # Validate format
flash fix [deck]                 # Auto-fix format issues
flash export <deck> --format csv # Export to CSV
flash import <file.csv> [deck]   # Import from CSV
```

### Share and sync

```bash
flash share <deck>               # Publish as GitHub repo
flash follow <url>               # Follow a shared deck
flash sync                       # Pull updates
```

## When generating cards from code

You have an advantage over the CLI — you can read and understand the entire codebase. Use this:

1. **Read relevant files** to understand the concepts deeply
2. **Identify key patterns** — API design, architecture decisions, idioms
3. **Generate targeted cards** that test understanding, not just memorization
4. **Mix card types** — Q/A for concepts, cloze for terminology, code-output for behavior
5. **Write cards in .fc format** and save directly, or pipe through `flash gen`

Example flow:
```
User: "make flashcards about this project's auth system"
You: [read auth-related files, understand the flow]
You: [generate cards about JWT handling, middleware, session management]
You: [save as auth-patterns.fc in the decks directory]
```

## Card format reference

Cards use the `.fc` plain text format:

```
@deck Deck Name
@tags tag1, tag2

---
Q: Question here
A: Answer here
tags: specific-tag
hint: Optional hint
---
Q: Fill in: The {{answer}} goes here.
tags: cloze-card
---
Q: What does this code output?
   const x = [1,2,3];
   console.log(x.length);
A: 3
type: code-output
tags: javascript
---
```
