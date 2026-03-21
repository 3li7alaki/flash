import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as prompts from "@clack/prompts";
import type { AnalyzerInput } from "../agents/analyzer.ts";
import { analyzerAgent } from "../agents/analyzer.ts";
import { createModelForTier } from "../ai/client.ts";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { serializeDeck } from "../format/serializer.ts";
import { loadState } from "../state/state.ts";
import type { Card, Deck } from "../types.ts";
import { generateCardId } from "../types.ts";
import { loadAllDecks } from "./list.ts";

export async function weakCommand(
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

	// Find cards with lapses > 1 across all decks
	const weakCards: AnalyzerInput["weakCards"] = [];
	for (const { deck, path } of loaded) {
		const state = await loadState(path);
		for (const card of deck.cards) {
			const cardState = state.cards[card.id];
			if (cardState && cardState.lapses > 1) {
				weakCards.push({ card, state: cardState });
			}
		}
	}

	if (weakCards.length === 0) {
		console.log("No weak areas found. Keep reviewing!");
		return;
	}

	console.log(`Found ${weakCards.length} cards with frequent lapses.\n`);

	const model = await createModelForTier(analyzerAgent.definition.tier);
	const result = await analyzerAgent.run(model, { weakCards });

	// Display weak areas
	console.log("Weak Areas:");
	for (const area of result.weakAreas) {
		console.log(`  - ${area.topic}: ${area.reason}`);
	}

	// Display and optionally save suggested cards
	if (result.suggestedCards.length > 0) {
		console.log(`\nSuggested Cards (${result.suggestedCards.length}):`);
		for (const card of result.suggestedCards) {
			console.log(`  Q: ${card.question}`);
			console.log(`  A: ${card.answer}`);
			console.log(`  Tags: ${card.tags.join(", ")}`);
			console.log();
		}

		const save = await prompts.confirm({
			message: "Save suggested cards to a new deck?",
		});

		if (prompts.isCancel(save) || !save) {
			return;
		}

		const cards: Card[] = result.suggestedCards.map((c) => ({
			id: generateCardId(c.question),
			question: c.question,
			answer: c.answer,
			type: "qa" as const,
			tags: c.tags,
		}));

		const deck: Deck = {
			meta: { name: "weak-areas", tags: ["ai-generated", "weak-areas"] },
			cards,
		};

		const outPath = join(decksDir, "weak-areas.fc");
		await writeFile(outPath, serializeDeck(deck), "utf-8");
		console.log(`Saved ${cards.length} cards to ${outPath}`);
	}
}
