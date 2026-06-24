# CLAUDE.md

flash is a CLI flashcard tool with FSRS-5 scheduling and AI agents. Bun runtime, TypeScript, `@clack/prompts` for interactive UI.

## Key conventions

- All commands must work headlessly via flags — Claude Code and CI can't use interactive prompts
- Card content in `.fc` files, review state in `.fc.state` — never mix them
- AI features are optional — core review works offline. Check `config.ai.enabled` before calling agents
- Deck discovery walks up from cwd looking for `.flashcards/` dirs, falls back to `~/flashcards`
- Default AI model is DeepSeek V3 (cheap). Don't suggest expensive models
- Card types: `qa`, `cloze` (auto-detected from `{{}}`), `code-output`, `mcq` (with `choices:`), `true-false` (auto-detected from True/False answer)
- When generating cards from codebase content, write `.fc` files directly — don't call `flash gen` (wastes API tokens)

## Specs and docs

- **PRODUCT.md** — `.fc` format spec, parsing rules, agent architecture, config schema
- **CONTRIBUTING.md** — commit conventions, PR guidelines
- **docs/adr/** — architecture decision records
- **skills/flash/SKILL.md** — Claude Code skill definition
- **agents/*.md** — Claude Code composite agent prompts (quiz, coach, generator)

## Testing

```bash
bun test        # 331+ tests across 22 files
bun run types   # TypeScript type check
bun run lint    # Biome linter
```

## Version bumping

Use `scripts/bump.sh [major|minor|patch]` — updates package.json + plugin.json + marketplace.json.


<!-- mint:start v2 -->
## MANDATORY: Use mint for ALL Code Changes

**For ANY task that modifies files in this repo, invoke the `mint` skill FIRST.**

This is not optional. Before writing, editing, or deleting any code:
1. Invoke `mint` with the task description
2. mint auto-routes to the right mode (quick/plan/ship/research/verify)
3. Follow mint's execution flow with gates and reviews

The only exceptions:
- Pure conversation / answering questions
- Reading files to understand context (no modifications)

If you catch yourself thinking "this is just a small fix" or "I'll just edit one file" — STOP. Invoke mint. Small fixes use quick mode. mint decides the workflow, not you.

**NEVER use Claude Code's built-in plan mode (EnterPlanMode/ExitPlanMode).** mint has its own planning flow — Claude Code plan mode is redundant and conflicts with mint's orchestration. Always stay in normal mode and let mint handle planning via its plan/ship modes.
<!-- mint:end -->
