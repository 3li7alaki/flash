import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LanguageModel } from "ai";
import type { ContentType } from "../agents/generator.ts";
import {
	detectContentSource,
	generatorAgent,
	parseGeneratorResponse,
	stripHtml,
} from "../agents/generator.ts";
import { createModelForTier } from "../ai/client.ts";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { serializeDeck } from "../format/serializer.ts";
import { toKebabCase } from "./utils.ts";

async function readStdin(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk as Buffer);
	}
	return Buffer.concat(chunks).toString("utf-8");
}

async function fetchUrl(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${url}: ${response.status} ${response.statusText}`,
		);
	}
	const html = await response.text();
	return stripHtml(html);
}

export async function genCommand(
	args: string[],
	flags: Record<string, string | boolean>,
): Promise<void> {
	const fromFlag = typeof flags.from === "string" ? flags.from : undefined;
	const countFlag =
		typeof flags.count === "string"
			? Number.parseInt(flags.count, 10)
			: undefined;
	const deckName = typeof flags.deck === "string" ? flags.deck : undefined;

	const source = detectContentSource(args, fromFlag);

	// Resolve content
	let content: string;
	let inferredName: string;

	switch (source.type) {
		case "url": {
			console.log(`Fetching ${source.value}...`);
			content = await fetchUrl(source.value);
			inferredName = deckName ?? "generated";
			break;
		}
		case "file": {
			content = await readFile(source.value, "utf-8");
			inferredName =
				deckName ?? source.value.replace(/\.[^.]+$/, "").replace(/.*\//, "");
			break;
		}
		case "text": {
			content = await readStdin();
			if (!content.trim()) {
				console.error("No input received from stdin.");
				process.exitCode = 1;
				return;
			}
			inferredName = deckName ?? "generated";
			break;
		}
		case "topic": {
			if (!source.value.trim()) {
				console.error("Usage: fc gen <topic> or fc gen --from <file|url>");
				process.exitCode = 1;
				return;
			}
			content = source.value;
			inferredName = deckName ?? source.value;
			break;
		}
	}

	// Create model and run agent
	let model: LanguageModel;
	try {
		model = await createModelForTier("balanced");
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
		return;
	}

	console.log("Generating flashcards...");

	const contentType: ContentType = source.type;
	const responseText = await generatorAgent.run(model, {
		content,
		contentType,
		cardCount: countFlag,
	});

	const deck = parseGeneratorResponse(responseText);

	if (deck.cards.length === 0) {
		console.error(
			"No cards were generated. Try different content or a more specific topic.",
		);
		process.exitCode = 1;
		return;
	}

	// Set deck name if not already set by the LLM
	if (!deck.meta.name) {
		deck.meta.name = inferredName;
	}

	// Save to decks directory
	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	await mkdir(decksDir, { recursive: true });

	const filename = `${toKebabCase(deck.meta.name || inferredName)}.fc`;
	const filePath = join(decksDir, filename);

	const serialized = serializeDeck(deck);
	await writeFile(filePath, serialized, "utf-8");

	console.log(`Generated ${deck.cards.length} cards -> ${filePath}`);

	// Preview first 3 cards
	const preview = deck.cards.slice(0, 3);
	for (const card of preview) {
		const q =
			card.question.length > 80
				? `${card.question.slice(0, 77)}...`
				: card.question;
		console.log(`  ${card.type === "cloze" ? "[cloze]" : "[Q/A]"} ${q}`);
	}

	if (deck.cards.length > 3) {
		console.log(`  ... and ${deck.cards.length - 3} more`);
	}
}
