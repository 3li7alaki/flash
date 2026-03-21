import { describe, expect, test } from "bun:test";
import { serializeCard, serializeDeck } from "../src/format/serializer.ts";
import type { Card, Deck } from "../src/types.ts";

function makeCard(
	overrides: Partial<Card> & Pick<Card, "question" | "answer">,
): Card {
	return {
		id: "abc123",
		type: "qa",
		tags: [],
		...overrides,
	};
}

function makeDeck(overrides: Partial<Deck> = {}): Deck {
	return {
		meta: { name: "", tags: [] },
		cards: [],
		...overrides,
	};
}

describe("serializeCard", () => {
	test("basic Q/A card", () => {
		const card = makeCard({
			question: "What is a closure?",
			answer: "A function that captures its environment.",
		});
		const result = serializeCard(card);
		expect(result).toBe(
			"Q: What is a closure?\nA: A function that captures its environment.",
		);
	});

	test("multiline question with 3-space indent", () => {
		const card = makeCard({
			question: "What does this print?\nconsole.log(1)",
			answer: "1",
		});
		const result = serializeCard(card);
		expect(result).toBe("Q: What does this print?\n   console.log(1)\nA: 1");
	});

	test("multiline answer with 3-space indent", () => {
		const card = makeCard({
			question: "Explain ownership.",
			answer: "Ownership moves.\nThe original is invalidated.",
		});
		const result = serializeCard(card);
		expect(result).toBe(
			"Q: Explain ownership.\nA: Ownership moves.\n   The original is invalidated.",
		);
	});

	test("cloze card does not output type field", () => {
		const card = makeCard({
			question: "Rust ensures memory safety through the {{borrow checker}}.",
			answer: "borrow checker",
			type: "cloze",
		});
		const result = serializeCard(card);
		expect(result).not.toContain("type:");
		expect(result).toContain("Q: Rust ensures memory safety");
	});

	test("code-output card outputs type field", () => {
		const card = makeCard({
			question: "What does this print?",
			answer: "42",
			type: "code-output",
		});
		const result = serializeCard(card);
		expect(result).toContain("type: code-output");
	});

	test("reversible card outputs reversible: true", () => {
		const card = makeCard({
			question: "What is &T?",
			answer: "Shared borrow.",
			reversible: true,
		});
		const result = serializeCard(card);
		expect(result).toContain("reversible: true");
	});

	test("reversible false is not output", () => {
		const card = makeCard({
			question: "What is &T?",
			answer: "Shared borrow.",
			reversible: false,
		});
		const result = serializeCard(card);
		expect(result).not.toContain("reversible:");
	});

	test("all optional fields present", () => {
		const card = makeCard({
			question: "What is X?",
			answer: "Y",
			type: "code-output",
			tags: ["foo", "bar"],
			hint: "Think about it",
			difficulty: 3,
			source: "https://example.com",
			reversible: true,
		});
		const result = serializeCard(card);
		expect(result).toContain("Q: What is X?");
		expect(result).toContain("A: Y");
		expect(result).toContain("type: code-output");
		expect(result).toContain("tags: foo, bar");
		expect(result).toContain("hint: Think about it");
		expect(result).toContain("difficulty: 3");
		expect(result).toContain("source: https://example.com");
		expect(result).toContain("reversible: true");
	});

	test("minimal card — just Q and A", () => {
		const card = makeCard({
			question: "Q?",
			answer: "A.",
		});
		const result = serializeCard(card);
		expect(result).toBe("Q: Q?\nA: A.");
	});

	test("field ordering is consistent", () => {
		const card = makeCard({
			question: "X?",
			answer: "Y",
			type: "code-output",
			tags: ["a"],
			hint: "h",
			difficulty: 2,
			source: "s",
			reversible: true,
		});
		const result = serializeCard(card);
		const lines = result.split("\n");
		const fieldOrder = lines
			.map((l) => l.match(/^(\w+):/)?.[1])
			.filter(Boolean);
		expect(fieldOrder).toEqual([
			"Q",
			"A",
			"type",
			"tags",
			"hint",
			"difficulty",
			"source",
			"reversible",
		]);
	});
});

describe("serializeDeck", () => {
	test("deck with all metadata fields", () => {
		const deck = makeDeck({
			meta: {
				name: "Rust Ownership",
				tags: ["rust", "systems"],
				created: "2026-03-21",
				template: "language",
			},
			cards: [makeCard({ question: "Q?", answer: "A." })],
		});
		const result = serializeDeck(deck);
		expect(result).toContain("@deck Rust Ownership\n");
		expect(result).toContain("@tags rust, systems\n");
		expect(result).toContain("@created 2026-03-21\n");
		expect(result).toContain("@template language\n");
	});

	test("partial metadata — only @deck", () => {
		const deck = makeDeck({
			meta: { name: "My Deck", tags: [] },
			cards: [makeCard({ question: "Q?", answer: "A." })],
		});
		const result = serializeDeck(deck);
		expect(result).toContain("@deck My Deck\n");
		expect(result).not.toContain("@tags");
		expect(result).not.toContain("@created");
		expect(result).not.toContain("@template");
	});

	test("no metadata at all", () => {
		const deck = makeDeck({
			meta: { name: "", tags: [] },
			cards: [makeCard({ question: "Q?", answer: "A." })],
		});
		const result = serializeDeck(deck);
		expect(result).not.toContain("@deck");
		expect(result).toStartWith("---\n");
	});

	test("multiple cards with separators", () => {
		const deck = makeDeck({
			cards: [
				makeCard({ question: "Q1?", answer: "A1." }),
				makeCard({ question: "Q2?", answer: "A2." }),
			],
		});
		const result = serializeDeck(deck);
		expect(result).toBe("---\nQ: Q1?\nA: A1.\n---\nQ: Q2?\nA: A2.\n---\n");
	});

	test("empty line between metadata and first card", () => {
		const deck = makeDeck({
			meta: { name: "Test", tags: [] },
			cards: [makeCard({ question: "Q?", answer: "A." })],
		});
		const result = serializeDeck(deck);
		const lines = result.split("\n");
		const deckLineIdx = lines.findIndex((l) => l.startsWith("@deck"));
		const separatorIdx = lines.indexOf("---");
		// There should be an empty line between metadata and first ---
		expect(lines[deckLineIdx + 1]).toBe("");
		expect(separatorIdx).toBe(deckLineIdx + 2);
	});

	test("trailing newline at end of file", () => {
		const deck = makeDeck({
			cards: [makeCard({ question: "Q?", answer: "A." })],
		});
		const result = serializeDeck(deck);
		expect(result.endsWith("\n")).toBe(true);
	});

	test("determinism — same deck serialized twice produces identical output", () => {
		const deck = makeDeck({
			meta: {
				name: "Test",
				tags: ["a", "b"],
				created: "2026-01-01",
			},
			cards: [
				makeCard({
					question: "Q1?\nLine 2",
					answer: "A1.\nLine 2",
					tags: ["x"],
					hint: "h",
					difficulty: 3,
					source: "s",
					reversible: true,
					type: "code-output",
				}),
				makeCard({
					question: "Cloze {{test}}.",
					answer: "test",
					type: "cloze",
				}),
			],
		});
		const first = serializeDeck(deck);
		const second = serializeDeck(deck);
		expect(first).toBe(second);
	});

	test("empty deck — no cards", () => {
		const deck = makeDeck({
			meta: { name: "Empty", tags: [] },
			cards: [],
		});
		const result = serializeDeck(deck);
		expect(result).toContain("@deck Empty");
		// No card separators needed for empty deck
		expect(result).not.toContain("---");
	});
});
