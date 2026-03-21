import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as prompts from "@clack/prompts";
import { challengerAgent } from "../agents/challenger.ts";
import { createModelForTier } from "../ai/client.ts";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { parseDeck } from "../format/parser.ts";
import { loadState } from "../state/state.ts";
import type { Card } from "../types.ts";
import { loadAllDecks } from "./list.ts";

export async function challengeCommand(
	_args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const loaded = await loadAllDecks(decksDir);

	if (loaded.length === 0) {
		console.log("No decks found.");
		return;
	}

	// Find mastered cards (stability > 30)
	const masteredCards: Card[] = [];
	for (const { deck, path } of loaded) {
		const state = await loadState(path);
		for (const card of deck.cards) {
			const cardState = state.cards[card.id];
			if (cardState && cardState.stability > 30) {
				masteredCards.push(card);
			}
		}
	}

	if (masteredCards.length === 0) {
		console.log("No mastered cards found (stability > 30). Keep reviewing!");
		return;
	}

	console.log(`Found ${masteredCards.length} mastered cards.\n`);

	const model = await createModelForTier(challengerAgent.definition.tier);
	const result = await challengerAgent.run(model, { masteredCards });

	console.log("Generated challenge cards:\n");
	console.log(result);

	const save = await prompts.confirm({
		message: "Save challenge cards to a new deck?",
	});

	if (prompts.isCancel(save) || !save) {
		return;
	}

	// Parse the generated .fc format text
	const deck = parseDeck(result);
	if (deck.cards.length === 0) {
		console.log("No valid cards could be parsed from the output.");
		return;
	}

	deck.meta.name = "challenges";
	deck.meta.tags = ["ai-generated", "challenge"];

	const outPath = join(decksDir, "challenges.fc");
	const { serializeDeck } = await import("../format/serializer.ts");
	await writeFile(outPath, serializeDeck(deck), "utf-8");
	console.log(`Saved ${deck.cards.length} challenge cards to ${outPath}`);
}
