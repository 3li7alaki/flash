# Hard Blocks — What Agents Can NEVER Do

Violations trigger immediate stop and escalation to user.

## Universal
- NEVER `git push` — human reviews and pushes manually
- NEVER modify files outside declared task scope
- NEVER delete or skip tests to make gates pass
- NEVER use `any` type or `@ts-ignore` to silence type errors
- NEVER disable lint rules to make gates pass
- NEVER commit with failing gates
- NEVER fix bad output directly — reset and fix the spec
- NEVER continue after 2 failures on the same spec
- NEVER mock internal modules — only mock external services

## Context Protection
- NEVER read large files in the main orchestrator context
- NEVER run tests or linters in the main orchestrator context
- Subagents return summaries only

## Project-Specific
- NEVER mix card content and review state — `.fc` files hold content, `.fc.state` files hold scheduling data
- NEVER call AI agents without first checking `config.ai.enabled` — AI is optional, core review works offline
- NEVER use interactive prompts for paths that must work headlessly — all commands need flag-based equivalents
- NEVER use expensive models (GPT-4, Claude Opus) for AI card generation — default is DeepSeek V3
- NEVER call `flash gen` from within the codebase to generate cards — write `.fc` files directly
