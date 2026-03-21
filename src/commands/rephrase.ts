import { readFile, writeFile } from "node:fs/promises";
import { explainerAgent } from "../agents/explainer.ts";
import { createModelForTier } from "../ai/client.ts";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { parseDeck } from "../format/parser.ts";
import { serializeDeck } from "../format/serializer.ts";
import { loadState } from "../state/state.ts";
import { loadAllDecks } from "./list.ts";

export async function rephraseCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const cardId = args[0];
	if (!cardId) {
		console.error("Usage: flash rephrase <card-id>");
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const loaded = await loadAllDecks(decksDir);

	for (const { deck, path } of loaded) {
		const cardIndex = deck.cards.findIndex((c) => c.id === cardId);
		if (cardIndex === -1) continue;

		const card = deck.cards[cardIndex];
		if (!card) continue;
		const state = await loadState(path);
		const cardState = state.cards[cardId];
		const failCount = cardState?.lapses ?? 0;

		const model = await createModelForTier(explainerAgent.definition.tier);
		const rephrased = await explainerAgent.run(model, {
			card,
			mode: "rephrase",
			failCount,
		});

		console.log(`Original: ${card.question}`);
		console.log(`\nRephrased output:\n${rephrased}`);

		// Parse the rephrased output to extract Q/A if possible
		const lines = rephrased.split("\n");
		let newQuestion: string | undefined;
		let newAnswer: string | undefined;
		for (const line of lines) {
			if (line.startsWith("Q:")) {
				newQuestion = line.slice(2).trim();
			} else if (line.startsWith("A:")) {
				newAnswer = line.slice(2).trim();
			}
		}

		if (newQuestion && newAnswer) {
			// Re-read file to get fresh content, then update
			const text = await readFile(path, "utf-8");
			const freshDeck = parseDeck(text);
			freshDeck.filePath = path;
			const freshIndex = freshDeck.cards.findIndex((c) => c.id === cardId);
			if (freshIndex !== -1 && freshDeck.cards[freshIndex]) {
				freshDeck.cards[freshIndex].question = newQuestion;
				freshDeck.cards[freshIndex].answer = newAnswer;
				await writeFile(path, serializeDeck(freshDeck), "utf-8");
				console.log(`\nCard updated in ${path}`);
			}
		}
		return;
	}

	console.error(`Card not found: ${cardId}`);
	process.exitCode = 1;
}
