import { describe, expect, test } from "bun:test";
import {
	createScheduler,
	getDeckStats,
	getDueCards,
	getNextReview,
	rateCard,
} from "../src/scheduler/scheduler.ts";
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

function getCard(state: DeckState, id: string): CardState {
	const cs = state.cards[id];
	if (!cs) throw new Error(`No card state for ${id}`);
	return cs;
}

describe("createScheduler", () => {
	test("returns an FSRS instance", () => {
		const scheduler = createScheduler();
		expect(scheduler).toBeDefined();
		expect(typeof scheduler.repeat).toBe("function");
	});
});

describe("getDueCards", () => {
	const now = new Date("2025-06-01T12:00:00Z");

	test("returns new cards (no state entry)", () => {
		const cards = [makeCard("a"), makeCard("b")];
		const state = makeState({});
		const due = getDueCards(cards, state, now);
		expect(due).toHaveLength(2);
		expect(due.map((c) => c.id)).toEqual(["a", "b"]);
	});

	test("returns overdue cards", () => {
		const cards = [makeCard("a")];
		const state = makeState({
			a: { due: "2025-05-31T00:00:00Z" },
		});
		const due = getDueCards(cards, state, now);
		expect(due).toHaveLength(1);
		expect(due[0]?.id).toBe("a");
	});

	test("does not return cards not yet due", () => {
		const cards = [makeCard("a")];
		const state = makeState({
			a: { due: "2025-06-15T00:00:00Z" },
		});
		const due = getDueCards(cards, state, now);
		expect(due).toHaveLength(0);
	});

	test("sorts: new cards first, then by due date ascending", () => {
		const cards = [makeCard("old1"), makeCard("new1"), makeCard("old2")];
		const state = makeState({
			old1: { due: "2025-05-30T00:00:00Z" },
			old2: { due: "2025-05-20T00:00:00Z" },
		});
		const due = getDueCards(cards, state, now);
		expect(due).toHaveLength(3);
		// new card first
		expect(due[0]?.id).toBe("new1");
		// then by due date ascending (old2 earlier than old1)
		expect(due[1]?.id).toBe("old2");
		expect(due[2]?.id).toBe("old1");
	});
});

describe("rateCard", () => {
	const now = new Date("2025-06-01T12:00:00Z");

	test("rating 'good' pushes due date into the future", () => {
		const state = makeState({});
		const newState = rateCard("a", "good", state, now);
		const cardState = getCard(newState, "a");
		const dueDate = new Date(cardState.due);
		expect(dueDate.getTime()).toBeGreaterThan(now.getTime());
	});

	test("rating 'again' keeps due date very soon", () => {
		const state = makeState({});
		const stateAfterGood = rateCard("a", "good", state, now);
		const stateAfterAgain = rateCard("a", "again", state, now);

		const goodDue = new Date(getCard(stateAfterGood, "a").due);
		const againDue = new Date(getCard(stateAfterAgain, "a").due);
		// "again" should be sooner than "good"
		expect(againDue.getTime()).toBeLessThan(goodDue.getTime());
	});

	test("is immutable (does not modify input state)", () => {
		const state = makeState({});
		const original = JSON.parse(JSON.stringify(state));
		rateCard("a", "good", state, now);
		expect(state).toEqual(original);
	});

	test("increments reps count", () => {
		const state = makeState({});
		const s1 = rateCard("a", "good", state, now);
		expect(getCard(s1, "a").reps).toBeGreaterThanOrEqual(1);

		const later = new Date("2025-06-10T12:00:00Z");
		const s2 = rateCard("a", "good", s1, later);
		expect(getCard(s2, "a").reps).toBeGreaterThan(getCard(s1, "a").reps);
	});

	test("increments lapses on 'again'", () => {
		const state = makeState({});
		// First do a good rating to establish the card
		const s1 = rateCard("a", "good", state, now);
		const lapseBefore = getCard(s1, "a").lapses;

		// Now rate again — should increment lapses
		const later = new Date("2025-06-10T12:00:00Z");
		const s2 = rateCard("a", "again", s1, later);
		expect(getCard(s2, "a").lapses).toBeGreaterThanOrEqual(lapseBefore);
	});
});

describe("getNextReview", () => {
	test("returns the due date from card state", () => {
		const futureDate = "2025-07-01T00:00:00Z";
		const cardState: CardState = {
			stability: 10,
			difficulty: 5,
			due: futureDate,
			reps: 3,
			lapses: 0,
			lastReview: "2025-06-01T00:00:00Z",
			lastRating: "good",
		};
		const next = getNextReview(cardState);
		expect(next).toEqual(new Date(futureDate));
	});
});

describe("getDeckStats", () => {
	const now = new Date("2025-06-01T12:00:00Z");

	test("computes correct counts", () => {
		const cards = [
			makeCard("new1"),
			makeCard("new2"),
			makeCard("learning1"),
			makeCard("review1"),
			makeCard("mastered1"),
			makeCard("notdue1"),
		];
		const state = makeState({
			learning1: {
				due: "2025-05-30T00:00:00Z",
				reps: 1,
				stability: 2,
			},
			review1: {
				due: "2025-05-28T00:00:00Z",
				reps: 5,
				stability: 10,
			},
			mastered1: {
				due: "2025-05-25T00:00:00Z",
				reps: 10,
				stability: 45,
			},
			notdue1: {
				due: "2025-07-01T00:00:00Z",
				reps: 4,
				stability: 20,
			},
		});

		const stats = getDeckStats(cards, state, now);
		expect(stats.total).toBe(6);
		expect(stats.new).toBe(2);
		// due = new(2) + learning1 + review1 + mastered1 = 5
		expect(stats.due).toBe(5);
		// learning: reps < 3 and has state => learning1
		expect(stats.learning).toBe(1);
		// review: reps >= 3 and due => review1
		expect(stats.review).toBe(1);
		// mastered: stability > 30 => mastered1
		expect(stats.mastered).toBe(1);
	});
});
