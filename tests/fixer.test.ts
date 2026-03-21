import { describe, expect, test } from "bun:test";
import { fixDeck } from "../src/format/fixer.ts";

/** Build .fc input text from lines, with trailing newline. */
function fc(...lines: string[]): string {
	return `${lines.join("\n")}\n`;
}

describe("fixDeck", () => {
	test("clean file returns same content with no changes", () => {
		const input = fc(
			"@deck Test",
			"",
			"---",
			"Q: What is a closure?",
			"A: A function that captures its environment.",
			"tags: javascript, programming",
			"---",
		);

		const { fixed, changes } = fixDeck(input);
		expect(fixed).toBe(input);
		expect(changes).toEqual([]);
	});

	test("normalizes whitespace in Q/A — collapses multiple spaces and trims trailing", () => {
		const input = fc(
			"---",
			"Q: What  is   a   closure?  ",
			"A: A function   that captures.  ",
			"---",
		);

		const { fixed, changes } = fixDeck(input);
		expect(fixed).toContain("Q: What is a closure?");
		expect(fixed).toContain("A: A function that captures.");
		expect(changes.length).toBeGreaterThan(0);
	});

	test("normalizes tag formatting — lowercase, trim, deduplicate, sort", () => {
		const input = fc(
			"---",
			"Q: What is X?",
			"A: Y.",
			"tags: Rust ,  rust, Systems , memory",
			"---",
		);

		const { fixed, changes } = fixDeck(input);
		expect(fixed).toContain("tags: memory, rust, systems");
		expect(changes.some((c) => c.includes("tag"))).toBe(true);
	});

	test("removes empty cards", () => {
		const input = fc(
			"---",
			"Q: Valid card?",
			"A: Yes.",
			"---",
			"A: Orphan answer without a question.",
			"---",
			"Q: Another valid card?",
			"A: Indeed.",
			"---",
		);

		const { fixed, changes } = fixDeck(input);
		const cardCount = (fixed.match(/^Q: /gm) || []).length;
		expect(cardCount).toBe(2);
		expect(changes.some((c) => c.includes("Removed empty card"))).toBe(true);
	});

	test("removes unnecessary type: cloze", () => {
		const input = fc(
			"---",
			"Q: Rust ensures memory safety through the {{borrow checker}}.",
			"A: borrow checker",
			"type: cloze",
			"---",
		);

		const { fixed, changes } = fixDeck(input);
		expect(fixed).not.toContain("type:");
		expect(changes.some((c) => c.includes("type: cloze"))).toBe(true);
	});

	test("preserves type: code-output", () => {
		const input = fc(
			"---",
			"Q: What does this print?",
			"A: 42",
			"type: code-output",
			"---",
		);

		const { fixed } = fixDeck(input);
		expect(fixed).toContain("type: code-output");
	});

	test("clamps difficulty below 1 to 1", () => {
		const input = fc("---", "Q: What is X?", "A: Y.", "difficulty: 0", "---");

		const { fixed, changes } = fixDeck(input);
		expect(fixed).toContain("difficulty: 1");
		expect(changes.some((c) => c.includes("difficulty"))).toBe(true);
	});

	test("clamps difficulty above 5 to 5", () => {
		const input = fc("---", "Q: What is X?", "A: Y.", "difficulty: 7", "---");

		const { fixed, changes } = fixDeck(input);
		expect(fixed).toContain("difficulty: 5");
		expect(changes.some((c) => c.includes("7"))).toBe(true);
	});

	test("rounds non-integer difficulty", () => {
		const input = fc("---", "Q: What is X?", "A: Y.", "difficulty: 3.7", "---");

		const { fixed } = fixDeck(input);
		expect(fixed).toContain("difficulty: 4");
	});

	test("normalizes reversible — TRUE to true", () => {
		const input = fc(
			"---",
			"Q: What is &T?",
			"A: Shared borrow.",
			"reversible: TRUE",
			"---",
		);

		const { fixed } = fixDeck(input);
		expect(fixed).toContain("reversible: true");
	});

	test("normalizes reversible — yes to true", () => {
		const input = fc(
			"---",
			"Q: What is &T?",
			"A: Shared borrow.",
			"reversible: yes",
			"---",
		);

		const { fixed } = fixDeck(input);
		expect(fixed).toContain("reversible: true");
	});

	test("normalizes reversible — False to not output reversible", () => {
		const input = fc(
			"---",
			"Q: What is &T?",
			"A: Shared borrow.",
			"reversible: False",
			"---",
		);

		const { fixed } = fixDeck(input);
		expect(fixed).not.toContain("reversible:");
	});

	test("ensures trailing newline", () => {
		const input = ["---", "Q: What is X?", "A: Y.", "---"].join("\n");

		const { fixed } = fixDeck(input);
		expect(fixed.endsWith("\n")).toBe(true);
	});

	test("multiple fixes in one file", () => {
		const input = fc(
			"@deck Messy",
			"",
			"---",
			"Q: What  is   X?",
			"A: Y.",
			"tags: Zebra,  alpha, zebra",
			"difficulty: 10",
			"reversible: YES",
			"---",
			"A: Orphan.",
			"---",
			"Q: Rust ensures safety through {{borrow checker}}.",
			"A: borrow checker",
			"type: cloze",
			"---",
		);

		const { fixed, changes } = fixDeck(input);

		expect(fixed).toContain("Q: What is X?");
		expect(fixed).toContain("tags: alpha, zebra");
		expect(fixed).toContain("difficulty: 5");
		expect(fixed).toContain("reversible: true");
		expect(fixed).not.toContain("Orphan");
		const typeMatches = fixed.match(/^type:/gm);
		expect(typeMatches).toBeNull();
		expect(changes.length).toBeGreaterThanOrEqual(4);
	});

	test("changes array describes what was fixed", () => {
		const input = fc("---", "Q: What is X?", "A: Y.", "difficulty: 7", "---");

		const { changes } = fixDeck(input);
		expect(changes.length).toBe(1);
		expect(changes[0]).toContain("difficulty");
		expect(changes[0]).toContain("7");
		expect(changes[0]).toContain("5");
	});
});
