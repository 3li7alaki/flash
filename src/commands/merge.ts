import { basename } from "node:path";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { parseDeck } from "../format/parser.ts";
import { serializeDeck } from "../format/serializer.ts";
import { loadState, saveState } from "../state/state.ts";
import type { DeckState } from "../types.ts";
import { findDeck } from "./utils.ts";

/**
 * Merge cards from deck2 into deck1. Skips duplicates by card ID.
 * Merges deck-wide tags (union). Saves merged result to deck1's file.
 * Also merges state files.
 *
 * Returns a formatted output string describing what was merged.
 */
export async function mergeDecks(
	deck1Path: string,
	deck2Path: string,
	_decksDir: string,
): Promise<string> {
	const text1 = await Bun.file(deck1Path).text();
	const text2 = await Bun.file(deck2Path).text();

	const deck1 = parseDeck(text1);
	const deck2 = parseDeck(text2);

	const deck1Name = deck1.meta.name || basename(deck1Path, ".fc");
	const deck2Name = deck2.meta.name || basename(deck2Path, ".fc");

	if (!deck1.meta.name) {
		deck1.meta.name = deck1Name;
	}

	// Track existing card IDs
	const existingIds = new Set(deck1.cards.map((c) => c.id));

	let added = 0;
	let duplicates = 0;

	for (const card of deck2.cards) {
		if (existingIds.has(card.id)) {
			duplicates++;
		} else {
			deck1.cards.push(card);
			existingIds.add(card.id);
			added++;
		}
	}

	// Merge tags (union)
	const tagSet = new Set([...deck1.meta.tags, ...deck2.meta.tags]);
	deck1.meta.tags = [...tagSet];

	// Save merged deck
	await Bun.write(deck1Path, serializeDeck(deck1));

	// Merge state files
	const state1 = await loadState(deck1Path);
	const state2 = await loadState(deck2Path);

	const mergedCards: DeckState["cards"] = { ...state1.cards };
	for (const [cardId, cardState] of Object.entries(state2.cards)) {
		if (!(cardId in mergedCards)) {
			mergedCards[cardId] = cardState;
		}
	}

	const mergedState: DeckState = {
		...state1,
		cards: mergedCards,
	};

	await saveState(deck1Path, mergedState);

	return `Merged ${added} cards from ${deck2Name} into ${deck1Name} (${duplicates} duplicates skipped)`;
}

export async function mergeCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const [deck1Name, deck2Name] = args;
	if (!deck1Name || !deck2Name) {
		console.error("Usage: fc merge <deck1> <deck2>");
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);

	const deck1Path = findDeck(deck1Name, decksDir);
	const deck2Path = findDeck(deck2Name, decksDir);

	const output = await mergeDecks(deck1Path, deck2Path, decksDir);
	console.log(output);
}
