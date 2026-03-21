import { describe, expect, test } from "bun:test";
import {
	getNextCard,
	getSessionSummary,
	startSession,
	submitRating,
} from "../src/review/engine.ts";
import type { Card, CardState, DeckState } from "../src/types.ts";

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

function makeState(cards: Record<string, Partial<CardState>> = {}): DeckState {
	const full: Record<string, CardState> = {};
	for (const [id, partial] of Object.entries(cards)) {
		full[id] = {
			stability: partial.stability ?? 1,
			difficulty: partial.difficulty ?? 5,
			due: partial.due ?? new Date().toISOString(),
			reps: partial.reps ?? 0,
			lapses: partial.lapses ?? 0,
			lastReview: partial.lastReview ?? new Date().toISOString(),
			lastRating: partial.lastRating ?? "good",
		};
	}
	return { deck: "test", cards: full };
}

describe("startSession", () => {
	test("creates session with all due cards", () => {
		const cards = [makeCard("a"), makeCard("b"), makeCard("c")];
		const state = makeState();
		const session = startSession(cards, state);

		expect(session.cards).toHaveLength(3);
		expect(session.currentIndex).toBe(0);
		expect(session.ratings).toHaveLength(0);
		expect(session.state).toBe(state);
	});

	test("respects maxCards limit", () => {
		const cards = [makeCard("a"), makeCard("b"), makeCard("c")];
		const state = makeState();
		const session = startSession(cards, state, { maxCards: 2 });

		expect(session.cards).toHaveLength(2);
		expect(session.cards[0]?.id).toBe("a");
		expect(session.cards[1]?.id).toBe("b");
	});

	test("maxCards of 0 means all cards", () => {
		const cards = [makeCard("a"), makeCard("b")];
		const state = makeState();
		const session = startSession(cards, state, { maxCards: 0 });

		expect(session.cards).toHaveLength(2);
	});

	test("maxCards larger than card count uses all cards", () => {
		const cards = [makeCard("a")];
		const state = makeState();
		const session = startSession(cards, state, { maxCards: 100 });

		expect(session.cards).toHaveLength(1);
	});

	test("empty cards array creates empty session", () => {
		const state = makeState();
		const session = startSession([], state);

		expect(session.cards).toHaveLength(0);
		expect(session.currentIndex).toBe(0);
	});
});

describe("getNextCard", () => {
	test("returns cards in order", () => {
		const cards = [makeCard("a"), makeCard("b"), makeCard("c")];
		const state = makeState();
		const session = startSession(cards, state);

		const first = getNextCard(session);
		expect(first?.id).toBe("a");
	});

	test("returns null when session is complete", () => {
		const cards = [makeCard("a")];
		const state = makeState();
		let session = startSession(cards, state);

		session = submitRating(session, "a", "good");
		const next = getNextCard(session);
		expect(next).toBeNull();
	});

	test("returns null for empty session", () => {
		const state = makeState();
		const session = startSession([], state);

		expect(getNextCard(session)).toBeNull();
	});

	test("advances through cards after each rating", () => {
		const cards = [makeCard("a"), makeCard("b"), makeCard("c")];
		const state = makeState();
		let session = startSession(cards, state);

		expect(getNextCard(session)?.id).toBe("a");
		session = submitRating(session, "a", "good");

		expect(getNextCard(session)?.id).toBe("b");
		session = submitRating(session, "b", "hard");

		expect(getNextCard(session)?.id).toBe("c");
		session = submitRating(session, "c", "easy");

		expect(getNextCard(session)).toBeNull();
	});
});

describe("submitRating", () => {
	test("updates state with new card state", () => {
		const cards = [makeCard("a")];
		const state = makeState();
		let session = startSession(cards, state);

		session = submitRating(session, "a", "good");
		expect(session.state.cards.a).toBeDefined();
		expect(session.state.cards.a?.lastRating).toBe("good");
	});

	test("increments session counters", () => {
		const cards = [makeCard("a"), makeCard("b")];
		const state = makeState();
		let session = startSession(cards, state);

		expect(session.currentIndex).toBe(0);
		expect(session.ratings).toHaveLength(0);

		session = submitRating(session, "a", "good");
		expect(session.currentIndex).toBe(1);
		expect(session.ratings).toHaveLength(1);

		session = submitRating(session, "b", "hard");
		expect(session.currentIndex).toBe(2);
		expect(session.ratings).toHaveLength(2);
	});

	test("records the rating in the ratings array", () => {
		const cards = [makeCard("a"), makeCard("b")];
		const state = makeState();
		let session = startSession(cards, state);

		session = submitRating(session, "a", "again");
		session = submitRating(session, "b", "easy");

		expect(session.ratings).toEqual(["again", "easy"]);
	});

	test("is immutable (does not modify original session)", () => {
		const cards = [makeCard("a")];
		const state = makeState();
		const session = startSession(cards, state);
		const originalIndex = session.currentIndex;

		submitRating(session, "a", "good");
		expect(session.currentIndex).toBe(originalIndex);
		expect(session.ratings).toHaveLength(0);
	});
});

describe("getSessionSummary", () => {
	test("counts ratings correctly", () => {
		const cards = [makeCard("a"), makeCard("b"), makeCard("c"), makeCard("d")];
		const state = makeState();
		let session = startSession(cards, state);

		session = submitRating(session, "a", "again");
		session = submitRating(session, "b", "hard");
		session = submitRating(session, "c", "good");
		session = submitRating(session, "d", "easy");

		const summary = getSessionSummary(session);
		expect(summary.reviewed).toBe(4);
		expect(summary.again).toBe(1);
		expect(summary.hard).toBe(1);
		expect(summary.good).toBe(1);
		expect(summary.easy).toBe(1);
	});

	test("returns zeros for empty session", () => {
		const state = makeState();
		const session = startSession([], state);

		const summary = getSessionSummary(session);
		expect(summary.reviewed).toBe(0);
		expect(summary.again).toBe(0);
		expect(summary.hard).toBe(0);
		expect(summary.good).toBe(0);
		expect(summary.easy).toBe(0);
	});

	test("counts multiple same ratings", () => {
		const cards = [makeCard("a"), makeCard("b"), makeCard("c")];
		const state = makeState();
		let session = startSession(cards, state);

		session = submitRating(session, "a", "good");
		session = submitRating(session, "b", "good");
		session = submitRating(session, "c", "good");

		const summary = getSessionSummary(session);
		expect(summary.reviewed).toBe(3);
		expect(summary.good).toBe(3);
		expect(summary.again).toBe(0);
		expect(summary.hard).toBe(0);
		expect(summary.easy).toBe(0);
	});
});
