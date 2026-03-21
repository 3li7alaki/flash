import { describe, expect, test } from "bun:test";
import { parseCard, parseDeck } from "../src/format/parser.ts";
import { generateCardId } from "../src/types.ts";

// biome-ignore lint/style/noNonNullAssertion: test assertions after length checks
type _IgnoreBiome = never;

function card(deck: ReturnType<typeof parseDeck>, index: number) {
	const c = deck.cards[index];
	if (!c) throw new Error(`No card at index ${index}`);
	return c;
}

describe("parseDeck", () => {
	test("parses basic Q/A card", () => {
		const text = `---
Q: What is a closure?
A: A function that captures its environment.
---`;
		const deck = parseDeck(text);
		expect(deck.cards).toHaveLength(1);
		expect(card(deck, 0).question).toBe("What is a closure?");
		expect(card(deck, 0).answer).toBe(
			"A function that captures its environment.",
		);
		expect(card(deck, 0).type).toBe("qa");
	});

	test("parses multiline Q and A with indented continuation", () => {
		const text = `---
Q: What does this code print?
   console.log(1);
   console.log(2);
A: It prints:
   1
   2
---`;
		const deck = parseDeck(text);
		expect(card(deck, 0).question).toBe(
			"What does this code print?\nconsole.log(1);\nconsole.log(2);",
		);
		expect(card(deck, 0).answer).toBe("It prints:\n1\n2");
	});

	test("auto-detects cloze from {{}} in question", () => {
		const text = `---
Q: Rust ensures memory safety through the {{borrow checker}}.
---`;
		const deck = parseDeck(text);
		expect(card(deck, 0).type).toBe("cloze");
	});

	test("cloze auto-detection overrides explicit type field", () => {
		const text = `---
Q: The {{sky}} is blue.
type: code-output
---`;
		const deck = parseDeck(text);
		expect(card(deck, 0).type).toBe("cloze");
	});

	test("parses code-output type", () => {
		const text = `---
Q: What does this code print?
A: 42
type: code-output
---`;
		const deck = parseDeck(text);
		expect(card(deck, 0).type).toBe("code-output");
	});

	test("parses reversible cards", () => {
		const text = `---
Q: What is &T?
A: A shared borrow.
reversible: true
---`;
		const deck = parseDeck(text);
		expect(card(deck, 0).reversible).toBe(true);
	});

	test("parses all optional fields: tags, hint, difficulty, source", () => {
		const text = `---
Q: What is ownership?
A: A memory management concept.
tags: rust, memory
hint: Think about who owns the data
difficulty: 3
source: The Rust Book
---`;
		const deck = parseDeck(text);
		const c = card(deck, 0);
		expect(c.tags).toEqual(["rust", "memory"]);
		expect(c.hint).toBe("Think about who owns the data");
		expect(c.difficulty).toBe(3);
		expect(c.source).toBe("The Rust Book");
	});

	test("parses deck metadata (@deck, @tags, @created, @template)", () => {
		const text = `@deck Rust Ownership
@tags rust, systems-programming
@created 2026-03-21
@template basic

---
Q: What is ownership?
A: A concept.
---`;
		const deck = parseDeck(text);
		expect(deck.meta.name).toBe("Rust Ownership");
		expect(deck.meta.tags).toEqual(["rust", "systems-programming"]);
		expect(deck.meta.created).toBe("2026-03-21");
		expect(deck.meta.template).toBe("basic");
	});

	test("missing @deck defaults to empty name", () => {
		const text = `@tags misc

---
Q: Hello?
A: World.
---`;
		const deck = parseDeck(text);
		expect(deck.meta.name).toBe("");
	});

	test("handles field order independence", () => {
		const text = `---
tags: ordering
hint: This tests order
Q: Does field order matter?
difficulty: 2
A: No, it does not.
source: spec
reversible: true
---`;
		const deck = parseDeck(text);
		const c = card(deck, 0);
		expect(c.question).toBe("Does field order matter?");
		expect(c.answer).toBe("No, it does not.");
		expect(c.tags).toEqual(["ordering"]);
		expect(c.hint).toBe("This tests order");
		expect(c.difficulty).toBe(2);
		expect(c.source).toBe("spec");
		expect(c.reversible).toBe(true);
	});

	test("skips empty cards (no Q: field)", () => {
		const text = `---
A: An answer with no question.
tags: orphan
---
Q: A real card.
A: Yes.
---`;
		const deck = parseDeck(text);
		expect(deck.cards).toHaveLength(1);
		expect(card(deck, 0).question).toBe("A real card.");
	});

	test("parses multiple cards in one deck", () => {
		const text = `@deck Multi

---
Q: Card one?
A: One.
---
Q: Card two?
A: Two.
---
Q: Card three?
A: Three.
---`;
		const deck = parseDeck(text);
		expect(deck.cards).toHaveLength(3);
		expect(card(deck, 0).question).toBe("Card one?");
		expect(card(deck, 1).question).toBe("Card two?");
		expect(card(deck, 2).question).toBe("Card three?");
	});

	test("preserves blank lines in Q/A blocks", () => {
		const text = `---
Q: First paragraph.

   Second paragraph.
A: Answer here.
---`;
		const deck = parseDeck(text);
		expect(card(deck, 0).question).toBe(
			"First paragraph.\n\nSecond paragraph.",
		);
	});

	test("field keywords mid-sentence in answers don't break parsing", () => {
		const text = `---
Q: How are tags useful?
A: In fc, tags: are useful for organizing cards. The hint: field helps too.
---`;
		const deck = parseDeck(text);
		expect(card(deck, 0).answer).toBe(
			"In fc, tags: are useful for organizing cards. The hint: field helps too.",
		);
		expect(card(deck, 0).tags).toEqual([]);
	});

	test("generates deterministic card IDs from question text", () => {
		const text = `---
Q: What is a closure?
A: A function that captures variables.
---`;
		const deck = parseDeck(text);
		const expectedId = generateCardId("What is a closure?");
		expect(card(deck, 0).id).toBe(expectedId);
	});

	test("card ID is stable across whitespace variations", () => {
		const text1 = `---
Q: What is a closure?
A: Answer.
---`;
		const text2 = `---
Q:   What   is  a   closure?
A: Answer.
---`;
		const deck1 = parseDeck(text1);
		const deck2 = parseDeck(text2);
		expect(card(deck1, 0).id).toBe(card(deck2, 0).id);
	});

	test("card with only Q: (no A:) for cloze", () => {
		const text = `---
Q: The {{sun}} rises in the east.
---`;
		const deck = parseDeck(text);
		expect(deck.cards).toHaveLength(1);
		expect(card(deck, 0).type).toBe("cloze");
		expect(card(deck, 0).answer).toBe("");
	});

	test("completely empty file returns empty deck", () => {
		const deck = parseDeck("");
		expect(deck.meta.name).toBe("");
		expect(deck.meta.tags).toEqual([]);
		expect(deck.cards).toHaveLength(0);
	});

	test("file with only metadata and no cards returns empty deck", () => {
		const text = `@deck Empty Deck
@tags test`;
		const deck = parseDeck(text);
		expect(deck.meta.name).toBe("Empty Deck");
		expect(deck.cards).toHaveLength(0);
	});

	test("parses the full example from PRODUCT.md", () => {
		const text = `@deck Rust Ownership
@tags rust, systems-programming
@created 2026-03-21

---
Q: What happens when you assign a variable to another in Rust?
A: Ownership moves (for non-Copy types). The original variable
   is invalidated and can no longer be used.
tags: ownership, move-semantics
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
---`;
		const deck = parseDeck(text);
		expect(deck.meta.name).toBe("Rust Ownership");
		expect(deck.meta.tags).toEqual(["rust", "systems-programming"]);
		expect(deck.meta.created).toBe("2026-03-21");
		expect(deck.cards).toHaveLength(4);

		// Card 1: standard Q/A with multiline answer
		expect(card(deck, 0).type).toBe("qa");
		expect(card(deck, 0).answer).toContain("is invalidated");
		expect(card(deck, 0).tags).toEqual(["ownership", "move-semantics"]);

		// Card 2: cloze auto-detected
		expect(card(deck, 1).type).toBe("cloze");
		expect(card(deck, 1).tags).toEqual(["compiler", "safety"]);

		// Card 3: code-output with multiline question
		expect(card(deck, 2).type).toBe("code-output");
		expect(card(deck, 2).question).toContain("let x = vec![1, 2, 3];");
		expect(card(deck, 2).hint).toBe("Think about move semantics");

		// Card 4: reversible
		expect(card(deck, 3).reversible).toBe(true);
		expect(card(deck, 3).tags).toEqual(["borrowing"]);
	});
});

describe("parseCard", () => {
	test("returns null for empty lines", () => {
		const result = parseCard([]);
		expect(result).toBeNull();
	});

	test("returns null for lines with no Q: field", () => {
		const result = parseCard(["A: Just an answer.", "tags: orphan"]);
		expect(result).toBeNull();
	});

	test("parses a simple card from lines", () => {
		const c = parseCard(["Q: What is 2+2?", "A: 4"]);
		expect(c).not.toBeNull();
		expect(c?.question).toBe("What is 2+2?");
		expect(c?.answer).toBe("4");
	});
});
