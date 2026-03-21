import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { loadAllDecks } from "./list.ts";

/**
 * Search all decks for cards matching a query. Returns formatted output string.
 * Performs case-insensitive substring match on question and answer fields.
 */
export async function searchCards(
	decksDir: string,
	query: string,
): Promise<string> {
	const loaded = await loadAllDecks(decksDir);
	const queryLower = query.toLowerCase();
	const matches: string[] = [];

	for (const { deck } of loaded) {
		for (const card of deck.cards) {
			const inQuestion = card.question.toLowerCase().includes(queryLower);
			const inAnswer = card.answer.toLowerCase().includes(queryLower);

			if (inQuestion || inAnswer) {
				const preview =
					card.question.length > 60
						? `${card.question.slice(0, 60)}...`
						: card.question;
				matches.push(`${deck.meta.name}: ${preview}`);
			}
		}
	}

	if (matches.length === 0) {
		return `No cards matching '${query}'`;
	}

	return matches.join("\n");
}

export async function searchCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const query = args[0];
	if (!query) {
		console.error("Usage: fc search <query>");
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const output = await searchCards(decksDir, query);
	console.log(output);
}
