import { readFile, writeFile } from "node:fs/promises";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { exportCsv } from "../format/csv.ts";
import { parseDeck } from "../format/parser.ts";
import { findDeck } from "./utils.ts";

export async function exportCommand(
	args: string[],
	flags: Record<string, string | boolean>,
): Promise<void> {
	const deckName = args[0];
	if (!deckName) {
		console.error("Usage: fc export <deck> [--format csv] [--output file]");
		process.exitCode = 1;
		return;
	}

	const format = typeof flags.format === "string" ? flags.format : "csv";
	if (format !== "csv") {
		console.error(`Unsupported format: ${format} (only csv is supported)`);
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const filePath = findDeck(deckName, decksDir);

	let text: string;
	try {
		text = await readFile(filePath, "utf-8");
	} catch {
		console.error(`Could not read: ${filePath}`);
		process.exitCode = 1;
		return;
	}

	const deck = parseDeck(text);
	const csv = exportCsv(deck);

	const output = typeof flags.output === "string" ? flags.output : null;
	if (output) {
		await writeFile(output, csv, "utf-8");
		console.log(`Exported ${deck.cards.length} cards to ${output}`);
	} else {
		process.stdout.write(csv);
	}
}
