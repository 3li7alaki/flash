import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { getDeckStats } from "../scheduler/scheduler.ts";
import { loadState } from "../state/state.ts";
import type { Card, DeckState } from "../types.ts";
import { loadAllDecks } from "./list.ts";

interface WeakSpot {
	question: string;
	lapses: number;
}

/**
 * Build the daily dashboard output string.
 */
export async function getDailyDashboard(decksDir: string): Promise<string> {
	const loaded = await loadAllDecks(decksDir);

	if (loaded.length === 0) {
		return `No decks found in ${decksDir}`;
	}

	const deckDueCounts: { name: string; due: number }[] = [];
	const weakSpots: WeakSpot[] = [];
	let totalDue = 0;
	let decksWithDue = 0;

	for (const { deck, path } of loaded) {
		const state = await loadState(path);
		const stats = getDeckStats(deck.cards, state);

		if (stats.due > 0) {
			deckDueCounts.push({ name: deck.meta.name, due: stats.due });
			totalDue += stats.due;
			decksWithDue++;
		}

		// Find weak spots: cards with lapses > 2
		collectWeakSpots(deck.cards, state, weakSpots);
	}

	// Sort decks by due count descending
	deckDueCounts.sort((a, b) => b.due - a.due);

	// Sort weak spots by lapses descending
	weakSpots.sort((a, b) => b.lapses - a.lapses);

	const lines: string[] = [];
	lines.push("flash \u2014 Daily Dashboard");
	lines.push("");
	lines.push(`Due today: ${totalDue} cards across ${decksWithDue} decks`);

	if (deckDueCounts.length > 0) {
		lines.push("");
		lines.push("Decks with due cards:");
		const nameWidth = Math.max(...deckDueCounts.map((d) => d.name.length));
		for (const { name, due } of deckDueCounts) {
			lines.push(`  ${name.padEnd(nameWidth)}  ${due} due`);
		}
	}

	if (weakSpots.length > 0) {
		lines.push("");
		lines.push("Weak spots: (cards failed > 2 times)");
		for (const spot of weakSpots) {
			lines.push(`  "${spot.question}" \u2014 failed ${spot.lapses} times`);
		}
	}

	if (deckDueCounts.length > 0) {
		const suggested = deckDueCounts[0];
		lines.push("");
		lines.push(`Suggested: Start with ${suggested?.name} (most due cards)`);
	}

	return lines.join("\n");
}

function collectWeakSpots(
	cards: Card[],
	state: DeckState,
	weakSpots: WeakSpot[],
): void {
	for (const card of cards) {
		const cardState = state.cards[card.id];
		if (cardState && cardState.lapses > 2) {
			weakSpots.push({
				question: card.question,
				lapses: cardState.lapses,
			});
		}
	}
}

export async function dailyCommand(
	_args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const output = await getDailyDashboard(decksDir);
	console.log(output);
}
