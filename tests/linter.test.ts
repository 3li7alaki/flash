import { describe, expect, test } from "bun:test";
import { lintDeck } from "../src/format/linter.ts";

describe("lintDeck", () => {
	test("valid deck returns empty array", () => {
		const text = `@deck Test Deck
@created 2026-03-21

---
Q: What is a closure?
A: A function that captures its environment.
tags: js, functions
---`;
		expect(lintDeck(text)).toEqual([]);
	});

	test("valid cloze card (no A: needed) returns empty array", () => {
		const text = `---
Q: The {{sky}} is blue.
tags: nature
---`;
		expect(lintDeck(text)).toEqual([]);
	});

	// --- Errors ---

	test("error: card has no Q: field", () => {
		const text = `---
A: An answer with no question.
tags: orphan
---`;
		const errors = lintDeck(text);
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "error",
				message: expect.stringContaining("no Q:"),
			}),
		);
	});

	test("error: cloze card has empty {{}}", () => {
		const text = `---
Q: The {{}} is blue.
tags: nature
---`;
		const errors = lintDeck(text);
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "error",
				message: expect.stringContaining("empty"),
			}),
		);
	});

	test("error: difficulty value is not a number between 1-5", () => {
		const text = `---
Q: What is rust?
A: A language.
difficulty: 7
tags: rust
---`;
		const errors = lintDeck(text);
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "error",
				message: expect.stringContaining("difficulty"),
			}),
		);
	});

	test("error: difficulty value is not a number", () => {
		const text = `---
Q: What is rust?
A: A language.
difficulty: hard
tags: rust
---`;
		const errors = lintDeck(text);
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "error",
				message: expect.stringContaining("difficulty"),
			}),
		);
	});

	test("error: type value is invalid", () => {
		const text = `---
Q: What is rust?
A: A language.
type: multiple-choice
tags: rust
---`;
		const errors = lintDeck(text);
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "error",
				message: expect.stringContaining("type"),
			}),
		);
	});

	test("error: type: cloze is not valid (cloze is auto-detected)", () => {
		const text = `---
Q: What is rust?
A: A language.
type: cloze
tags: rust
---`;
		const errors = lintDeck(text);
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "error",
				message: expect.stringContaining("type"),
			}),
		);
	});

	test("error: duplicate card IDs", () => {
		const text = `---
Q: What is a closure?
A: First answer.
tags: js
---
Q: What is a closure?
A: Second answer.
tags: js
---`;
		const errors = lintDeck(text);
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "error",
				message: expect.stringContaining("uplicate"),
			}),
		);
	});

	test("error: @created is not a valid YYYY-MM-DD date", () => {
		const text = `@deck Test
@created not-a-date

---
Q: What?
A: Yes.
tags: test
---`;
		const errors = lintDeck(text);
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "error",
				message: expect.stringContaining("@created"),
			}),
		);
	});

	test("error: @created with invalid date values", () => {
		const text = `@deck Test
@created 2026-13-45

---
Q: What?
A: Yes.
tags: test
---`;
		const errors = lintDeck(text);
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "error",
				message: expect.stringContaining("@created"),
			}),
		);
	});

	// --- Warnings ---

	test("warning: card has Q: but no A: and is not cloze", () => {
		const text = `---
Q: What is rust?
tags: rust
---`;
		const warnings = lintDeck(text);
		expect(warnings).toContainEqual(
			expect.objectContaining({
				severity: "warning",
				message: expect.stringContaining("no A:"),
			}),
		);
	});

	test("warning: card has no tags", () => {
		const text = `---
Q: What is rust?
A: A language.
---`;
		const warnings = lintDeck(text);
		expect(warnings).toContainEqual(
			expect.objectContaining({
				severity: "warning",
				message: expect.stringContaining("tags"),
			}),
		);
	});

	test("warning: cloze card has explicit type: cloze (unnecessary)", () => {
		const text = `---
Q: The {{sky}} is blue.
type: cloze
tags: nature
---`;
		const warnings = lintDeck(text);
		expect(warnings).toContainEqual(
			expect.objectContaining({
				severity: "warning",
				message: expect.stringContaining("unnecessary"),
			}),
		);
	});

	test("warning: reversible value is not true or false", () => {
		const text = `---
Q: What is rust?
A: A language.
reversible: yes
tags: rust
---`;
		const warnings = lintDeck(text);
		expect(warnings).toContainEqual(
			expect.objectContaining({
				severity: "warning",
				message: expect.stringContaining("reversible"),
			}),
		);
	});

	test("warning: empty deck (no cards)", () => {
		const text = `@deck Empty
@created 2026-03-21`;
		const warnings = lintDeck(text);
		expect(warnings).toContainEqual(
			expect.objectContaining({
				severity: "warning",
				message: expect.stringContaining("empty"),
			}),
		);
	});

	test("warning: unknown field keyword", () => {
		const text = `---
Q: What is rust?
A: A language.
priority: high
tags: rust
---`;
		const warnings = lintDeck(text);
		expect(warnings).toContainEqual(
			expect.objectContaining({
				severity: "warning",
				message: expect.stringContaining("nknown field"),
			}),
		);
	});

	// --- Composite cases ---

	test("multiple errors in one file", () => {
		const text = `@deck Bad Deck
@created not-a-date

---
A: No question here.
tags: orphan
---
Q: The {{}} is empty cloze.
tags: bad
---
Q: What is rust?
A: A language.
difficulty: 99
tags: rust
---`;
		const errors = lintDeck(text);
		const errorItems = errors.filter((e) => e.severity === "error");
		expect(errorItems.length).toBeGreaterThanOrEqual(3);
	});

	test("mixed errors and warnings", () => {
		const text = `---
Q: What is rust?
difficulty: abc
---`;
		const results = lintDeck(text);
		const errorItems = results.filter((e) => e.severity === "error");
		const warningItems = results.filter((e) => e.severity === "warning");
		// error: difficulty not valid number
		expect(errorItems.length).toBeGreaterThanOrEqual(1);
		// warning: no tags, no A: on non-cloze
		expect(warningItems.length).toBeGreaterThanOrEqual(1);
	});

	test("line numbers are accurate", () => {
		const text = `@deck Test
@created bad-date

---
Q: What?
A: Yes.
tags: test
---
A: No question.
tags: orphan
---`;
		const errors = lintDeck(text);

		// @created error should be on line 2
		const createdError = errors.find((e) => e.message.includes("@created"));
		expect(createdError).toBeDefined();
		expect(createdError?.line).toBe(2);

		// no Q: error should point to the card block start area (line 9 area)
		const noQError = errors.find((e) => e.message.includes("no Q:"));
		expect(noQError).toBeDefined();
		expect(noQError?.line).toBeGreaterThanOrEqual(9);
	});

	test("difficulty: 0 is invalid", () => {
		const text = `---
Q: What?
A: Yes.
difficulty: 0
tags: test
---`;
		const errors = lintDeck(text);
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "error",
				message: expect.stringContaining("difficulty"),
			}),
		);
	});

	test("completely empty string returns empty deck warning", () => {
		const errors = lintDeck("");
		expect(errors).toContainEqual(
			expect.objectContaining({
				severity: "warning",
				message: expect.stringContaining("empty"),
			}),
		);
	});
});
