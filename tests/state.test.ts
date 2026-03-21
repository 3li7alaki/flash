import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getCardState,
	getStatePath,
	levenshteinDistance,
	loadState,
	migrateCardIds,
	newCardState,
	saveState,
	setCardState,
} from "../src/state/state.ts";
import type { Card, CardState, DeckState } from "../src/types.ts";

describe("getStatePath", () => {
	test("converts .fc path to .fc.state", () => {
		expect(getStatePath("/path/to/deck.fc")).toBe("/path/to/deck.fc.state");
	});

	test("appends .state to any path", () => {
		expect(getStatePath("/foo/bar.fc")).toBe("/foo/bar.fc.state");
	});
});

describe("loadState", () => {
	test("returns empty state when file does not exist", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "fc-test-"));
		const deckPath = join(tempDir, "test.fc");
		const state = await loadState(deckPath);
		expect(state.deck).toBe("test");
		expect(state.cards).toEqual({});
		await rm(tempDir, { recursive: true });
	});
});

describe("saveState and loadState round-trip", () => {
	test("saves and loads state correctly", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "fc-test-"));
		const deckPath = join(tempDir, "mydeck.fc");
		const state: DeckState = {
			deck: "mydeck",
			cards: {
				abc123: {
					stability: 4.5,
					difficulty: 0.3,
					due: "2026-03-25",
					reps: 7,
					lapses: 1,
					lastReview: "2026-03-21",
					lastRating: "good",
				},
			},
		};
		await saveState(deckPath, state);
		const loaded = await loadState(deckPath);
		expect(loaded).toEqual(state);
		await rm(tempDir, { recursive: true });
	});
});

describe("getCardState", () => {
	const state: DeckState = {
		deck: "test",
		cards: {
			abc123: {
				stability: 1,
				difficulty: 0.5,
				due: "2026-03-21",
				reps: 1,
				lapses: 0,
				lastReview: "2026-03-20",
				lastRating: "good",
			},
		},
	};

	test("returns card state for existing card", () => {
		const cs = getCardState(state, "abc123");
		expect(cs).toBeDefined();
		expect(cs?.stability).toBe(1);
	});

	test("returns undefined for missing card", () => {
		expect(getCardState(state, "missing")).toBeUndefined();
	});
});

describe("setCardState", () => {
	test("returns new state with updated card", () => {
		const original: DeckState = { deck: "test", cards: {} };
		const cardState: CardState = {
			stability: 2,
			difficulty: 0.4,
			due: "2026-03-22",
			reps: 1,
			lapses: 0,
			lastReview: "2026-03-21",
			lastRating: "good",
		};
		const updated = setCardState(original, "card1", cardState);
		expect(updated.cards.card1).toEqual(cardState);
	});

	test("is immutable — does not modify original", () => {
		const original: DeckState = {
			deck: "test",
			cards: {
				existing: {
					stability: 1,
					difficulty: 0.5,
					due: "2026-03-21",
					reps: 1,
					lapses: 0,
					lastReview: "2026-03-20",
					lastRating: "good",
				},
			},
		};
		const cardState: CardState = {
			stability: 2,
			difficulty: 0.4,
			due: "2026-03-22",
			reps: 1,
			lapses: 0,
			lastReview: "2026-03-21",
			lastRating: "good",
		};
		const updated = setCardState(original, "new", cardState);
		expect(original.cards.new).toBeUndefined();
		expect(updated.cards.new).toEqual(cardState);
		expect(updated.cards.existing).toEqual(original.cards.existing);
	});
});

describe("levenshteinDistance", () => {
	test("identical strings have distance 0", () => {
		expect(levenshteinDistance("hello", "hello")).toBe(0);
	});

	test("single edit has distance 1", () => {
		expect(levenshteinDistance("cat", "bat")).toBe(1);
		expect(levenshteinDistance("cat", "cats")).toBe(1);
		expect(levenshteinDistance("cat", "at")).toBe(1);
	});

	test("completely different strings", () => {
		expect(levenshteinDistance("abc", "xyz")).toBe(3);
	});

	test("empty strings", () => {
		expect(levenshteinDistance("", "")).toBe(0);
		expect(levenshteinDistance("abc", "")).toBe(3);
		expect(levenshteinDistance("", "abc")).toBe(3);
	});
});

describe("migrateCardIds", () => {
	const makeCard = (question: string, id: string): Card => ({
		id,
		question,
		answer: "test answer",
		type: "qa",
		tags: [],
	});

	const makeCardState = (reps: number): CardState => ({
		stability: 4.5,
		difficulty: 0.3,
		due: "2026-03-25",
		reps,
		lapses: 0,
		lastReview: "2026-03-21",
		lastRating: "good",
	});

	test("no orphans = no changes", () => {
		const state: DeckState = {
			deck: "test",
			cards: { id1: makeCardState(5) },
		};
		const cards = [makeCard("What is a closure?", "id1")];
		const result = migrateCardIds(state, cards);
		expect(result.migrations).toHaveLength(0);
		expect(result.state.cards.id1).toEqual(makeCardState(5));
	});

	test("similar question (< 30% distance) migrates when old cards provided", () => {
		const oldQuestion = "What is a closure in JavaScript?";
		const newQuestion = "What is a closure in TypeScript?";
		const oldCard = makeCard(oldQuestion, "oldid");
		const newCard = makeCard(newQuestion, "newid");

		const state: DeckState = {
			deck: "test",
			cards: { oldid: makeCardState(5) },
		};

		const result = migrateCardIds(state, [newCard], [oldCard]);
		expect(result.migrations).toHaveLength(1);
		expect(result.state.cards.newid).toEqual(makeCardState(5));
		expect(result.state.cards.oldid).toBeUndefined();
	});

	test("dissimilar question (> 30% distance) does not migrate", () => {
		const oldQuestion = "What is a closure?";
		const newQuestion = "Explain the entire history of computing";
		const oldCard = makeCard(oldQuestion, "oldid");
		const newCard = makeCard(newQuestion, "newid");

		const state: DeckState = {
			deck: "test",
			cards: { oldid: makeCardState(5) },
		};

		const result = migrateCardIds(state, [newCard], [oldCard]);
		expect(result.migrations).toHaveLength(0);
		expect(result.state.cards.oldid).toBeUndefined();
		expect(result.state.cards.newid).toBeUndefined();
	});

	test("prunes unmatched orphans", () => {
		const state: DeckState = {
			deck: "test",
			cards: {
				orphan1: makeCardState(3),
				orphan2: makeCardState(7),
				kept: makeCardState(1),
			},
		};
		const cards = [makeCard("Some question", "kept")];
		const result = migrateCardIds(state, cards);
		expect(result.state.cards.kept).toEqual(makeCardState(1));
		expect(result.state.cards.orphan1).toBeUndefined();
		expect(result.state.cards.orphan2).toBeUndefined();
	});
});

describe("newCardState", () => {
	test("returns valid initial state", () => {
		const cs = newCardState();
		expect(cs.stability).toBe(0);
		expect(cs.difficulty).toBe(0);
		expect(cs.reps).toBe(0);
		expect(cs.lapses).toBe(0);
		expect(cs.lastReview).toBe("");
		expect(cs.lastRating).toBe("again");
		const today = new Date().toISOString().split("T")[0] ?? "";
		expect(cs.due).toBe(today);
	});
});
