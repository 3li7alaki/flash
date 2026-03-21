# ADR-002: Unified agent architecture for CLI and Claude Code

## Status
Accepted

## Context
flash has AI features (generation, grading, analysis) that need to work in two contexts:
1. CLI — user runs `flash gen`, `flash review`, etc. in the terminal
2. Claude Code — user runs `/flash gen`, `/flash review` as skills inside their editor

Option A: Build separate implementations for each context.
Option B: Define agents (role + prompt + schema) once, run them in both contexts.

## Decision
Option B — agent-first architecture. Each AI capability is an agent with a defined role, system prompt, input schema, and output schema. The same agent runs via OpenRouter in CLI mode and as a native subagent in Claude Code mode.

## Reasoning
- One set of prompts to maintain, not two
- Behavior is identical regardless of interface
- Testing is simpler — test the agent once, it works everywhere
- Adding a new AI feature means adding one agent, not two implementations
- Claude Code agents compose base agents (e.g., Quiz Agent wraps Grader Agent) rather than reimplementing

## Agents
- **Grader** — evaluates answer similarity
- **Generator** — creates cards from content
- **Teacher** — Socratic learning mode
- **Analyzer** — weak spot analysis
- **Explainer** — deeper explanations and rephrasing
- **Challenger** — harder variants of mastered cards
- **Summarizer** — cheat sheet generation

## Consequences
- Agent prompts must be well-structured enough for both structured (CLI) and conversational (Claude Code) output
- OpenRouter client needs to handle the same prompt format as Claude Code skill definitions
- Agent definitions live in `src/agents/` as TypeScript modules
