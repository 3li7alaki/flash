import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { parseDeck } from "../format/parser.ts";
import { getDeckStats } from "../scheduler/scheduler.ts";
import { loadState } from "../state/state.ts";
import { loadAllDecks } from "./list.ts";
import { findDeck } from "./utils.ts";

interface DeckStatsRow {
	name: string;
	total: number;
	due: number;
	new_: number;
	learning: number;
	mastered: number;
	retention: string;
}

/**
 * Compute stats output for all decks or a specific deck.
 */
export async function getStatsOutput(
	decksDir: string,
	deckName?: string,
): Promise<string> {
	if (deckName) {
		const deckPath = findDeck(deckName, decksDir);
		const text = await Bun.file(deckPath).text();
		const deck = parseDeck(text);
		if (!deck.meta.name) {
			const base = deckPath.split("/").pop()?.replace(/\.fc$/, "");
			deck.meta.name = base ?? deckName;
		}
		const state = await loadState(deckPath);
		const stats = getDeckStats(deck.cards, state);
		const retention =
			stats.total > 0
				? `${Math.round((stats.mastered / stats.total) * 100)}%`
				: "0%";

		const row: DeckStatsRow = {
			name: deck.meta.name,
			total: stats.total,
			due: stats.due,
			new_: stats.new,
			learning: stats.learning,
			mastered: stats.mastered,
			retention,
		};

		return formatTable([row]);
	}

	const loaded = await loadAllDecks(decksDir);

	if (loaded.length === 0) {
		return `No decks found in ${decksDir}`;
	}

	const rows: DeckStatsRow[] = [];

	for (const { deck, path } of loaded) {
		const state = await loadState(path);
		const stats = getDeckStats(deck.cards, state);
		const retention =
			stats.total > 0
				? `${Math.round((stats.mastered / stats.total) * 100)}%`
				: "0%";

		rows.push({
			name: deck.meta.name,
			total: stats.total,
			due: stats.due,
			new_: stats.new,
			learning: stats.learning,
			mastered: stats.mastered,
			retention,
		});
	}

	return formatTable(rows);
}

function formatTable(rows: DeckStatsRow[]): string {
	const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));

	const header = [
		"Deck".padEnd(nameWidth),
		"Total".padStart(5),
		"Due".padStart(5),
		"New".padStart(5),
		"Learning".padStart(10),
		"Mastered".padStart(10),
		"Retention".padStart(11),
	].join("  ");

	const lines: string[] = [header];

	for (const row of rows) {
		lines.push(
			[
				row.name.padEnd(nameWidth),
				String(row.total).padStart(5),
				String(row.due).padStart(5),
				String(row.new_).padStart(5),
				String(row.learning).padStart(10),
				String(row.mastered).padStart(10),
				row.retention.padStart(11),
			].join("  "),
		);
	}

	// Add totals row if multiple decks
	if (rows.length > 1) {
		const totalTotal = rows.reduce((s, r) => s + r.total, 0);
		const totalDue = rows.reduce((s, r) => s + r.due, 0);
		const totalNew = rows.reduce((s, r) => s + r.new_, 0);
		const totalLearning = rows.reduce((s, r) => s + r.learning, 0);
		const totalMastered = rows.reduce((s, r) => s + r.mastered, 0);
		const totalRetention =
			totalTotal > 0
				? `${Math.round((totalMastered / totalTotal) * 100)}%`
				: "0%";

		const lineWidth = header.length;
		lines.push("\u2500".repeat(lineWidth));

		lines.push(
			[
				"Total".padEnd(nameWidth),
				String(totalTotal).padStart(5),
				String(totalDue).padStart(5),
				String(totalNew).padStart(5),
				String(totalLearning).padStart(10),
				String(totalMastered).padStart(10),
				totalRetention.padStart(11),
			].join("  "),
		);
	}

	return lines.join("\n");
}

export async function statsCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const deckName = args[0];
	const output = await getStatsOutput(decksDir, deckName);
	console.log(output);
}
