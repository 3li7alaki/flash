import { explainerAgent } from "../agents/explainer.ts";
import { createModelForTier } from "../ai/client.ts";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { loadState } from "../state/state.ts";
import { loadAllDecks } from "./list.ts";

export async function explainCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const cardId = args[0];
	if (!cardId) {
		console.error("Usage: flash explain <card-id>");
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const loaded = await loadAllDecks(decksDir);

	// Find the card across all decks
	for (const { deck, path } of loaded) {
		const card = deck.cards.find((c) => c.id === cardId);
		if (!card) continue;

		const state = await loadState(path);
		const cardState = state.cards[cardId];
		const failCount = cardState?.lapses ?? 0;

		const model = await createModelForTier(explainerAgent.definition.tier);
		const explanation = await explainerAgent.run(model, {
			card,
			mode: "explain",
			failCount,
		});

		console.log(`Card: ${card.question}\n`);
		console.log(explanation);
		return;
	}

	console.error(`Card not found: ${cardId}`);
	process.exitCode = 1;
}
