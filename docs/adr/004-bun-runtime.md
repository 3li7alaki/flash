# ADR-004: Bun over Node.js for CLI runtime

## Status
Accepted

## Context
flash is a CLI tool that users run frequently (daily reviews). Startup time matters. Options:
- Node.js — universal, rock-solid, needs build step for TypeScript
- Bun — fast startup, native TypeScript, built-in test runner
- Deno — native TypeScript, different module system, smaller ecosystem

## Decision
Bun.

## Reasoning
- ~3x faster startup than Node.js — noticeable for a CLI you run multiple times a day
- Zero-config TypeScript — run `.ts` files directly, no build step during development
- Built-in test runner — no jest/vitest dependency
- The install script handles Bun installation automatically (same pattern as mint)
- npm ecosystem compatibility — all packages we need (ts-fsrs, @clack/prompts) work with Bun

## Consequences
- Users need Bun installed (handled by install script)
- Some npm packages may have edge cases with Bun (unlikely for our deps)
- Contributors need Bun for development
