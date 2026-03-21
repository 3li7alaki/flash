import { describe, expect, test } from "bun:test";
import { exportCsv, importCsv } from "../src/format/csv.ts";
import { parseDeck } from "../src/format/parser.ts";
import { serializeDeck } from "../src/format/serializer.ts";
import type { Card, Deck } from "../src/types.ts";
import { generateCardId } from "../src/types.ts";

function makeDeck(cards: Card[]): Deck {
	return {
		meta: { name: "", tags: [] },
		cards,
	};
}

function makeCard(overrides: Partial<Card> & { question: string }): Card {
	return {
		id: generateCardId(overrides.question),
		answer: "",
		type: "qa",
		tags: [],
		...overrides,
	};
}

describe("exportCsv", () => {
	test("exports header row", () => {
		const csv = exportCsv(makeDeck([]));
		expect(csv).toBe(
			"question,answer,tags,type,hint,difficulty,source,reversible,choices\n",
		);
	});

	test("exports basic Q/A card", () => {
		const deck = makeDeck([
			makeCard({
				question: "What is a closure?",
				answer: "A function that captures its environment.",
			}),
		]);
		const csv = exportCsv(deck);
		const lines = csv.split("\n");
		expect(lines).toHaveLength(3); // header + 1 card + trailing empty
		expect(lines[1]).toBe(
			"What is a closure?,A function that captures its environment.,,qa,,,,,",
		);
	});

	test("exports all card types", () => {
		const deck = makeDeck([
			makeCard({ question: "Basic Q/A", answer: "Answer", type: "qa" }),
			makeCard({
				question: "Rust uses the {{borrow checker}}.",
				answer: "",
				type: "cloze",
			}),
			makeCard({
				question: "What does this print?",
				answer: "42",
				type: "code-output",
			}),
		]);
		const csv = exportCsv(deck);
		const lines = csv.split("\n").filter(Boolean);
		expect(lines[1]).toContain(",qa,");
		expect(lines[2]).toContain(",cloze,");
		expect(lines[3]).toContain(",code-output,");
	});

	test("exports multiline Q/A with newlines in quoted CSV", () => {
		const deck = makeDeck([
			makeCard({
				question: "Line 1\nLine 2",
				answer: "A1\nA2",
			}),
		]);
		const csv = exportCsv(deck);
		// Multiline fields should be quoted
		expect(csv).toContain('"Line 1\nLine 2"');
		expect(csv).toContain('"A1\nA2"');
	});

	test("exports all optional fields", () => {
		const deck = makeDeck([
			makeCard({
				question: "Q",
				answer: "A",
				tags: ["tag1", "tag2"],
				type: "code-output",
				hint: "Think carefully",
				difficulty: 3,
				source: "https://example.com",
				reversible: true,
			}),
		]);
		const csv = exportCsv(deck);
		const lines = csv.split("\n").filter(Boolean);
		expect(lines[1]).toBe(
			'Q,A,"tag1, tag2",code-output,Think carefully,3,https://example.com,true,',
		);
	});

	test("quotes fields containing commas", () => {
		const deck = makeDeck([
			makeCard({
				question: "What are a, b, and c?",
				answer: "They are variables",
			}),
		]);
		const csv = exportCsv(deck);
		expect(csv).toContain('"What are a, b, and c?"');
	});

	test("escapes double quotes in fields", () => {
		const deck = makeDeck([
			makeCard({
				question: 'He said "hello"',
				answer: "Greeting",
			}),
		]);
		const csv = exportCsv(deck);
		expect(csv).toContain('"He said ""hello"""');
	});

	test("empty deck exports header only", () => {
		const csv = exportCsv(makeDeck([]));
		expect(csv).toBe(
			"question,answer,tags,type,hint,difficulty,source,reversible,choices\n",
		);
	});
});

describe("importCsv", () => {
	test("imports basic card from CSV", () => {
		const csv =
			"question,answer,tags,type,hint,difficulty,source,reversible,choices\nWhat is X?,It is Y,,qa,,,,\n";
		const cards = importCsv(csv);
		expect(cards).toHaveLength(1);
		expect(cards[0]?.question).toBe("What is X?");
		expect(cards[0]?.answer).toBe("It is Y");
		expect(cards[0]?.type).toBe("qa");
		expect(cards[0]?.tags).toEqual([]);
	});

	test("imports with missing optional fields", () => {
		const csv =
			"question,answer,tags,type,hint,difficulty,source,reversible,choices\nQ,A,,qa,,,,\n";
		const cards = importCsv(csv);
		expect(cards).toHaveLength(1);
		expect(cards[0]?.hint).toBeUndefined();
		expect(cards[0]?.difficulty).toBeUndefined();
		expect(cards[0]?.source).toBeUndefined();
		expect(cards[0]?.reversible).toBeUndefined();
	});

	test("imports all optional fields", () => {
		const csv =
			'question,answer,tags,type,hint,difficulty,source,reversible,choices\nQ,A,"tag1, tag2",code-output,Hint,3,https://ex.com,true\n';
		const cards = importCsv(csv);
		expect(cards).toHaveLength(1);
		expect(cards[0]?.tags).toEqual(["tag1", "tag2"]);
		expect(cards[0]?.type).toBe("code-output");
		expect(cards[0]?.hint).toBe("Hint");
		expect(cards[0]?.difficulty).toBe(3);
		expect(cards[0]?.source).toBe("https://ex.com");
		expect(cards[0]?.reversible).toBe(true);
	});

	test("handles header row correctly", () => {
		const csv =
			"question,answer,tags,type,hint,difficulty,source,reversible,choices\n";
		const cards = importCsv(csv);
		expect(cards).toHaveLength(0);
	});

	test("imports quoted fields with commas", () => {
		const csv =
			'question,answer,tags,type,hint,difficulty,source,reversible,choices\n"What are a, b?",Answer,,qa,,,,\n';
		const cards = importCsv(csv);
		expect(cards[0]?.question).toBe("What are a, b?");
	});

	test("imports quoted fields with newlines", () => {
		const csv =
			'question,answer,tags,type,hint,difficulty,source,reversible,choices\n"Line 1\nLine 2","A1\nA2",,qa,,,,\n';
		const cards = importCsv(csv);
		expect(cards[0]?.question).toBe("Line 1\nLine 2");
		expect(cards[0]?.answer).toBe("A1\nA2");
	});

	test("imports escaped quotes in fields", () => {
		const csv =
			'question,answer,tags,type,hint,difficulty,source,reversible,choices\n"He said ""hello""",Greeting,,qa,,,,\n';
		const cards = importCsv(csv);
		expect(cards[0]?.question).toBe('He said "hello"');
	});

	test("empty CSV returns no cards", () => {
		const csv =
			"question,answer,tags,type,hint,difficulty,source,reversible,choices\n";
		const cards = importCsv(csv);
		expect(cards).toHaveLength(0);
	});
});

describe("round-trip: .fc → parse → exportCsv → importCsv → serialize → compare", () => {
	test("round-trips a comprehensive deck with all card types", () => {
		const fcText = `@deck Test Deck
@tags test, round-trip
@created 2026-03-21

---
Q: What is a closure?
A: A function that captures its environment.
tags: basics
---
Q: Rust ensures memory safety through the {{borrow checker}}.
tags: compiler, safety
---
Q: What does this code print?
   let x = vec![1, 2, 3];
   let y = x;
   println!("{:?}", x);
A: Doesn't compile. Ownership moved to y, x is invalidated.
type: code-output
tags: ownership
hint: Think about move semantics
---
Q: What's the difference between &T and &mut T?
A: &T is a shared (immutable) borrow. &mut T is an exclusive (mutable) borrow.
tags: borrowing
reversible: true
---
Q: Simple Q with all optional fields
A: Simple answer
tags: meta
hint: A hint
difficulty: 3
source: https://example.com
---
`;

		// Step 1: Parse .fc
		const deck = parseDeck(fcText);
		expect(deck.cards).toHaveLength(5);

		// Step 2: Serialize to get canonical .fc form
		const canonicalFc = serializeDeck(deck);

		// Step 3: Export to CSV
		const csv = exportCsv(deck);

		// Step 4: Import from CSV
		const importedCards = importCsv(csv);
		expect(importedCards).toHaveLength(5);

		// Step 5: Rebuild deck with same metadata
		const rebuiltDeck: Deck = {
			meta: deck.meta,
			cards: importedCards,
		};

		// Step 6: Serialize back to .fc
		const roundTrippedFc = serializeDeck(rebuiltDeck);

		// Step 7: Compare — must be byte-identical
		expect(roundTrippedFc).toBe(canonicalFc);
	});

	test("round-trips cards with special characters", () => {
		const fcText = `---
Q: What does "foo" mean?
A: It's a placeholder, used in "examples" and "tests".
tags: basics
---
`;
		const deck = parseDeck(fcText);
		const canonical = serializeDeck(deck);
		const csv = exportCsv(deck);
		const imported = importCsv(csv);
		const rebuilt: Deck = { meta: deck.meta, cards: imported };
		const roundTripped = serializeDeck(rebuilt);
		expect(roundTripped).toBe(canonical);
	});

	test("round-trips multiline questions and answers", () => {
		const fcText = `---
Q: What does this code print?
   console.log("hello");
   console.log("world");
A: It prints:
   hello
   world
type: code-output
---
`;
		const deck = parseDeck(fcText);
		const canonical = serializeDeck(deck);
		const csv = exportCsv(deck);
		const imported = importCsv(csv);
		const rebuilt: Deck = { meta: deck.meta, cards: imported };
		const roundTripped = serializeDeck(rebuilt);
		expect(roundTripped).toBe(canonical);
	});

	test("round-trips empty deck", () => {
		const deck: Deck = { meta: { name: "", tags: [] }, cards: [] };
		const canonical = serializeDeck(deck);
		const csv = exportCsv(deck);
		const imported = importCsv(csv);
		const rebuilt: Deck = { meta: deck.meta, cards: imported };
		const roundTripped = serializeDeck(rebuilt);
		expect(roundTripped).toBe(canonical);
	});
});
