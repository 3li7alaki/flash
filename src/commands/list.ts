import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { parseDeck } from "../format/parser.ts";
import { getDeckStats } from "../scheduler/scheduler.ts";
import { loadState } from "../state/state.ts";
import type { Deck } from "../types.ts";

export interface LoadedDeck {
	deck: Deck;
	path: string;
}

/**
 * Scan a directory for .fc files and parse each into a Deck.
 */
export async function loadAllDecks(decksDir: string): Promise<LoadedDeck[]> {
	let files: string[];
	try {
		files = readdirSync(decksDir).filter((f) => f.endsWith(".fc"));
	} catch {
		return [];
	}

	files.sort();

	const results: LoadedDeck[] = [];
	for (const file of files) {
		const filePath = join(decksDir, file);
		const text = await Bun.file(filePath).text();
		const deck = parseDeck(text);
		deck.filePath = filePath;
		if (!deck.meta.name) {
			deck.meta.name = basename(file, ".fc");
		}
		results.push({ deck, path: filePath });
	}

	return results;
}

/**
 * List all decks with stats. Returns formatted output string.
 */
export async function listDecks(decksDir: string): Promise<string> {
	const loaded = await loadAllDecks(decksDir);

	if (loaded.length === 0) {
		return `No decks found in ${decksDir}`;
	}

	const rows: { name: string; cards: number; due: number; new_: number }[] = [];

	for (const { deck, path } of loaded) {
		const state = await loadState(path);
		const stats = getDeckStats(deck.cards, state);
		rows.push({
			name: deck.meta.name,
			cards: stats.total,
			due: stats.due,
			new_: stats.new,
		});
	}

	// Calculate column widths
	const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));
	const cardsWidth = 5;
	const dueWidth = 3;
	const newWidth = 3;

	const header = [
		"Deck".padEnd(nameWidth),
		"Cards".padStart(cardsWidth),
		"Due".padStart(dueWidth + 2),
		"New".padStart(newWidth + 2),
	].join("   ");

	const lines = [header];

	for (const row of rows) {
		lines.push(
			[
				row.name.padEnd(nameWidth),
				String(row.cards).padStart(cardsWidth),
				String(row.due).padStart(dueWidth + 2),
				String(row.new_).padStart(newWidth + 2),
			].join("   "),
		);
	}

	return lines.join("\n");
}

export async function listCommand(
	_args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const output = await listDecks(decksDir);
	console.log(output);
}
