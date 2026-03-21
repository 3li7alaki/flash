import { readFile } from "node:fs/promises";
import { summarizerAgent } from "../agents/summarizer.ts";
import { createModelForTier } from "../ai/client.ts";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { parseDeck } from "../format/parser.ts";
import { findDeck } from "./utils.ts";

export async function summarizeCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const deckName = args[0];
	if (!deckName) {
		console.error("Usage: fc summarize <deck>");
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);

	let deckPath: string;
	try {
		deckPath = findDeck(deckName, decksDir);
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
		return;
	}

	const text = await readFile(deckPath, "utf-8");
	const deck = parseDeck(text);

	if (deck.cards.length === 0) {
		console.log("Deck has no cards to summarize.");
		return;
	}

	const deckDisplayName = deck.meta.name || deckName;

	const model = await createModelForTier(summarizerAgent.definition.tier);
	const cheatSheet = await summarizerAgent.run(model, {
		cards: deck.cards,
		deckName: deckDisplayName,
	});

	console.log(cheatSheet);
}
