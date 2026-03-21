import { describe, expect, test } from "bun:test";
import {
	filterByTag,
	filterByTags,
	interleaveDecks,
	type TaggedCard,
} from "../src/review/filters.ts";
import type { Card } from "../src/types.ts";

function makeCard(id: string, overrides?: Partial<Card>): Card {
	return {
		id,
		question: `Question ${id}`,
		answer: `Answer ${id}`,
		type: "qa",
		tags: [],
		...overrides,
	};
}

describe("filterByTag", () => {
	test("returns cards matching the given tag", () => {
		const cards = [
			makeCard("1", { tags: ["math", "algebra"] }),
			makeCard("2", { tags: ["science"] }),
			makeCard("3", { tags: ["math"] }),
		];
		const result = filterByTag(cards, "math");
		expect(result).toHaveLength(2);
		expect(result.map((c) => c.id)).toEqual(["1", "3"]);
	});

	test("is case-insensitive", () => {
		const cards = [
			makeCard("1", { tags: ["Math"] }),
			makeCard("2", { tags: ["MATH"] }),
			makeCard("3", { tags: ["science"] }),
		];
		const result = filterByTag(cards, "math");
		expect(result).toHaveLength(2);
		expect(result.map((c) => c.id)).toEqual(["1", "2"]);
	});

	test("returns empty array when no cards match", () => {
		const cards = [
			makeCard("1", { tags: ["science"] }),
			makeCard("2", { tags: ["history"] }),
		];
		const result = filterByTag(cards, "math");
		expect(result).toHaveLength(0);
	});

	test("matches deck-wide tags passed on the card", () => {
		const cards = [
			makeCard("1", { tags: ["deck-tag", "card-tag"] }),
			makeCard("2", { tags: ["other"] }),
		];
		const result = filterByTag(cards, "deck-tag");
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("1");
	});
});

describe("filterByTags", () => {
	test("matches cards with any of the given tags (OR logic)", () => {
		const cards = [
			makeCard("1", { tags: ["math"] }),
			makeCard("2", { tags: ["science"] }),
			makeCard("3", { tags: ["history"] }),
		];
		const result = filterByTags(cards, ["math", "science"]);
		expect(result).toHaveLength(2);
		expect(result.map((c) => c.id)).toEqual(["1", "2"]);
	});

	test("does not duplicate cards matching multiple tags", () => {
		const cards = [
			makeCard("1", { tags: ["math", "science"] }),
			makeCard("2", { tags: ["history"] }),
		];
		const result = filterByTags(cards, ["math", "science"]);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe("1");
	});

	test("returns empty when no tags match", () => {
		const cards = [makeCard("1", { tags: ["math"] })];
		const result = filterByTags(cards, ["science", "history"]);
		expect(result).toHaveLength(0);
	});
});

describe("interleaveDecks", () => {
	test("alternates cards between decks", () => {
		const decks = [
			{ cards: [makeCard("a1"), makeCard("a2")], deckName: "A" },
			{ cards: [makeCard("b1"), makeCard("b2")], deckName: "B" },
		];
		const result = interleaveDecks(decks);
		expect(result.map((c) => c.deckName)).toEqual(["A", "B", "A", "B"]);
		expect(result.map((c) => c.id)).toEqual(["a1", "b1", "a2", "b2"]);
	});

	test("handles unequal deck sizes", () => {
		const decks = [
			{
				cards: [makeCard("a1"), makeCard("a2"), makeCard("a3")],
				deckName: "A",
			},
			{ cards: [makeCard("b1")], deckName: "B" },
		];
		const result = interleaveDecks(decks);
		expect(result).toHaveLength(4);
		expect(result.map((c) => c.id)).toEqual(["a1", "b1", "a2", "a3"]);
		expect(result.map((c) => c.deckName)).toEqual(["A", "B", "A", "A"]);
	});

	test("single deck returns same order", () => {
		const decks = [{ cards: [makeCard("a1"), makeCard("a2")], deckName: "A" }];
		const result = interleaveDecks(decks);
		expect(result.map((c) => c.id)).toEqual(["a1", "a2"]);
		expect(result.every((c) => c.deckName === "A")).toBe(true);
	});

	test("skips empty decks", () => {
		const decks = [
			{ cards: [makeCard("a1")], deckName: "A" },
			{ cards: [], deckName: "B" },
			{ cards: [makeCard("c1")], deckName: "C" },
		];
		const result = interleaveDecks(decks);
		expect(result).toHaveLength(2);
		expect(result.map((c) => c.deckName)).toEqual(["A", "C"]);
	});

	test("returns empty array for no decks", () => {
		const result = interleaveDecks([]);
		expect(result).toHaveLength(0);
	});
});

describe("TaggedCard", () => {
	test("has deckName property alongside Card properties", () => {
		const decks = [
			{ cards: [makeCard("1", { tags: ["math"] })], deckName: "MyDeck" },
		];
		const result = interleaveDecks(decks);
		const tagged = result[0] as TaggedCard;
		expect(tagged.deckName).toBe("MyDeck");
		expect(tagged.id).toBe("1");
		expect(tagged.question).toBe("Question 1");
		expect(tagged.tags).toEqual(["math"]);
	});
});
