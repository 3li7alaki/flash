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

**Important:** All commands support headless (non-interactive) mode via flags. Never rely on interactive prompts — always pass flags directly so commands work in piped/automated contexts.

**Deck discovery:** flash auto-discovers decks by walking up from cwd looking for a `.flashcards/` directory. If found, it uses that instead of the global `~/flashcards`. This means project-local decks work automatically — just create a `.flashcards/` dir in the repo. When writing .fc files directly, use the project's `.flashcards/` if it exists, otherwise `~/flashcards/`.

## Commands

### Generate cards from what you see

When the user asks to generate flashcards from code, docs, or context:

1. **From the current codebase (preferred — free, no API cost):** Read the relevant files yourself, understand the patterns/concepts, then write a `.fc` file directly or use `flash add` with flags. Do NOT call `flash gen` for codebase content — you already have the context, so writing cards directly is faster, higher quality, and costs nothing.

   ```bash
   # Write a .fc file directly
   cat > ~/flashcards/auth-patterns.fc << 'EOF'
   @deck Auth Patterns
   @tags auth, middleware

   ---
   Q: What middleware validates JWT tokens in this project?
   A: The authMiddleware in src/auth/middleware.ts — it checks the Authorization header and validates against the JWKS endpoint.
   tags: jwt, middleware
   ---
   EOF

   # Or add cards one at a time
   flash add auth-patterns --question 'What happens on token expiry?' --answer 'Returns 401 and sets WWW-Authenticate header' --tags 'jwt,auth'
   ```

2. **From a file or PDF (uses API):** Only use `flash gen --from` for external content you haven't read — PDFs, articles, files outside the codebase.
   ```bash
   flash gen --from path/to/file.pdf
   flash gen --from path/to/notes.md
   ```

3. **From a URL (uses API):**
   ```bash
   flash gen --from https://example.com/article
   ```

4. **From a topic (uses API):** When the user wants cards on a general topic, not codebase-specific.
   ```bash
   flash gen "TCP/IP fundamentals"
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
flash weak [--save]              # Find weak areas (--save to auto-save cards)
flash explain <card-id>          # Deeper explanation
flash rephrase <card-id>         # Rewrite confusing card
flash challenge [--save]         # Harder variants of mastered cards (--save to auto-save)
flash summarize <deck>           # Cheat sheet from a deck
flash config setup --key <key> [--model <id>]  # Headless config setup
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
flash add <deck> --question '...' --answer '...' [--tags '...'] [--hint '...'] [--type qa|code-output] [--reversible]
flash edit <deck>                # Open in editor
flash list                       # List all decks
flash stats [deck]               # Learning stats
flash daily                      # Daily dashboard
flash search <query>             # Search across decks
flash lint [deck]                # Validate format
flash fix [deck]                 # Auto-fix format issues
flash export <deck> --format csv # Export to CSV
flash import <file.csv> [deck] [--append]  # Import from CSV
```

### Share and sync

```bash
flash share <deck>               # Publish as GitHub repo
flash follow <url>               # Follow a shared deck
flash sync                       # Pull updates
```

## When generating cards from code

You have full codebase access — **always write .fc files directly instead of calling `flash gen`**. This is free (no API cost), faster, and produces better cards because you understand the code semantically.

1. **Read relevant files** to understand the concepts deeply
2. **Identify key patterns** — API design, architecture decisions, idioms
3. **Generate targeted cards** that test understanding, not just memorization
4. **Mix card types** — Q/A for concepts, MCQ for exam prep, true-false for misconceptions, cloze for terminology, code-output for behavior
5. **Write the .fc file directly** or use `flash add` with `--question`/`--answer` flags

Never call `flash gen` for codebase content — that sends the text to an external LLM when you already have the understanding.

Example flow:
```
User: "make flashcards about this project's auth system"
You: [read auth-related files, understand the flow]
You: [write auth-patterns.fc directly with targeted cards]
You: [run `flash lint auth-patterns` to validate the format]
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
Q: How many tools should an agent ideally have?
A: b
type: mcq
choices: 1-2 | 4-5 | 10-15 | As many as needed
tags: agent-design
---
Q: Subagents inherit the coordinator's conversation history.
A: False
type: true-false
tags: multi-agent
---
```
