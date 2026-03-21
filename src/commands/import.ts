import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import * as prompts from "@clack/prompts";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { importCsv } from "../format/csv.ts";
import { parseDeck } from "../format/parser.ts";
import { serializeDeck } from "../format/serializer.ts";
import type { Deck } from "../types.ts";
import { toKebabCase } from "./utils.ts";

export async function importCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const csvPath = args[0];
	if (!csvPath) {
		console.error("Usage: flash import <csv-file> [deck-name]");
		process.exitCode = 1;
		return;
	}

	let csvText: string;
	try {
		csvText = await readFile(csvPath, "utf-8");
	} catch {
		console.error(`Could not read: ${csvPath}`);
		process.exitCode = 1;
		return;
	}

	const cards = importCsv(csvText);
	if (cards.length === 0) {
		console.log("No cards found in CSV file.");
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	await mkdir(decksDir, { recursive: true });

	// Determine deck name from arg or CSV filename
	const deckName = args[1] ?? basename(csvPath, extname(csvPath));
	const kebab = toKebabCase(deckName);
	const deckPath = join(decksDir, `${kebab}.fc`);

	if (existsSync(deckPath)) {
		const existing = await readFile(deckPath, "utf-8");
		const existingDeck = parseDeck(existing);

		let shouldAppend: boolean;
		if (_flags.append === true) {
			shouldAppend = true;
		} else {
			const result = await prompts.confirm({
				message: `Deck "${kebab}" already exists (${existingDeck.cards.length} cards). Append ${cards.length} cards?`,
			});
			if (prompts.isCancel(result) || !result) {
				console.log("Cancelled.");
				return;
			}
			shouldAppend = true;
		}

		if (shouldAppend) {
			existingDeck.cards.push(...cards);
			const serialized = serializeDeck(existingDeck);
			await writeFile(deckPath, serialized, "utf-8");
			console.log(`Imported ${cards.length} cards into ${kebab}`);
		}
	} else {
		const deck: Deck = {
			meta: { name: deckName, tags: [] },
			cards,
		};
		const serialized = serializeDeck(deck);
		await writeFile(deckPath, serialized, "utf-8");
		console.log(`Imported ${cards.length} cards into ${kebab}`);
	}
}
