import { basename } from "node:path";
import type { CardState, DeckState } from "../types.ts";

/**
 * Given a deck file path, return the corresponding state file path.
 * e.g. /path/to/deck.fc -> /path/to/deck.fc.state
 */
export function getStatePath(deckPath: string): string {
	return `${deckPath}.state`;
}

/**
 * Load review state from the .fc.state file. Returns empty state if file doesn't exist.
 */
export async function loadState(deckPath: string): Promise<DeckState> {
	const statePath = getStatePath(deckPath);
	const file = Bun.file(statePath);
	const exists = await file.exists();
	if (!exists) {
		const name = basename(deckPath, ".fc");
		return { deck: name, cards: {} };
	}
	const text = await file.text();
	return JSON.parse(text) as DeckState;
}

/**
 * Write review state to the .fc.state file.
 */
export async function saveState(
	deckPath: string,
	state: DeckState,
): Promise<void> {
	const statePath = getStatePath(deckPath);
	await Bun.write(statePath, JSON.stringify(state, null, 2));
}

/**
 * Return the initial review state for a new card.
 */
export function newCardState(): CardState {
	const today = new Date().toISOString().split("T")[0] ?? "";
	return {
		stability: 0,
		difficulty: 0,
		due: today,
		reps: 0,
		lapses: 0,
		lastReview: "",
		lastRating: "again",
	};
}
