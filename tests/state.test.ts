import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getStatePath,
	loadState,
	newCardState,
	saveState,
} from "../src/state/state.ts";
import type { DeckState } from "../src/types.ts";

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
