import { basename } from "node:path";
import type { Card, CardState, DeckState } from "../types.ts";

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
 * Get the review state for a specific card, or undefined if not found.
 */
export function getCardState(
	state: DeckState,
	cardId: string,
): CardState | undefined {
	return state.cards[cardId];
}

/**
 * Return a new DeckState with the given card's state updated (immutable).
 */
export function setCardState(
	state: DeckState,
	cardId: string,
	cardState: CardState,
): DeckState {
	return {
		...state,
		cards: { ...state.cards, [cardId]: cardState },
	};
}

/**
 * Compute the Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;

	if (m === 0) return n;
	if (n === 0) return m;

	// Use two rows instead of full matrix for space efficiency
	let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
	let curr: number[] = new Array<number>(n + 1).fill(0);

	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				curr[j] = prev[j - 1] ?? 0;
			} else {
				curr[j] =
					1 + Math.min(prev[j - 1] ?? 0, prev[j] ?? 0, curr[j - 1] ?? 0);
			}
		}
		[prev, curr] = [curr, prev];
	}

	return prev[n] ?? 0;
}

/**
 * Migrate card IDs when questions are edited. Matches orphaned state entries
 * to new cards using Levenshtein distance.
 *
 * @param state - Current deck state
 * @param currentCards - Cards from the current deck file
 * @param oldCards - Cards from the previous version (needed for question comparison)
 * @returns Updated state and list of migration descriptions
 */
export function migrateCardIds(
	state: DeckState,
	currentCards: Card[],
	oldCards?: Card[],
): { state: DeckState; migrations: string[] } {
	const currentIds = new Set(currentCards.map((c) => c.id));
	const stateIds = new Set(Object.keys(state.cards));

	// Find orphaned state entries (IDs in state but not in current cards)
	const orphanIds = [...stateIds].filter((id) => !currentIds.has(id));

	// Find unmatched current cards (IDs in current cards but not in state)
	const unmatchedCards = currentCards.filter((c) => !stateIds.has(c.id));

	// If no orphans, no migration needed — just return state with only current card IDs
	if (orphanIds.length === 0) {
		return { state, migrations: [] };
	}

	// Build old card lookup by ID for question comparison
	const oldCardById = new Map<string, Card>();
	if (oldCards) {
		for (const card of oldCards) {
			oldCardById.set(card.id, card);
		}
	}

	const migrations: string[] = [];
	const newCards: Record<string, CardState> = {};
	const migratedOrphans = new Set<string>();

	// Try to match each unmatched current card to an orphan
	for (const card of unmatchedCards) {
		let bestOrphanId: string | undefined;
		let bestDistance = Number.POSITIVE_INFINITY;

		for (const orphanId of orphanIds) {
			if (migratedOrphans.has(orphanId)) continue;

			const oldCard = oldCardById.get(orphanId);
			if (!oldCard) continue;

			const distance = levenshteinDistance(oldCard.question, card.question);
			const threshold = Math.max(oldCard.question.length, card.question.length);

			if (distance < threshold * 0.3 && distance < bestDistance) {
				bestDistance = distance;
				bestOrphanId = orphanId;
			}
		}

		if (bestOrphanId) {
			const orphanState = state.cards[bestOrphanId];
			if (orphanState) {
				newCards[card.id] = orphanState;
				migratedOrphans.add(bestOrphanId);
				migrations.push(`${bestOrphanId} -> ${card.id}`);
			}
		}
	}

	// Build final state: keep matched current cards, add migrations, prune orphans
	const finalCards: Record<string, CardState> = {};
	for (const [id, cardState] of Object.entries(state.cards)) {
		if (currentIds.has(id)) {
			finalCards[id] = cardState;
		}
		// Orphans are dropped (pruned)
	}
	// Add migrated entries
	for (const [id, cardState] of Object.entries(newCards)) {
		finalCards[id] = cardState;
	}

	return {
		state: { ...state, cards: finalCards },
		migrations,
	};
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
