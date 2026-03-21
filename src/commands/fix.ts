import { readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { fixDeck } from "../format/fixer.ts";
import { findDeck } from "./utils.ts";

export async function fixCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);

	let files: string[];

	if (args[0]) {
		files = [findDeck(args[0], decksDir)];
	} else {
		try {
			const entries = readdirSync(decksDir).filter((f) => f.endsWith(".fc"));
			files = entries.map((f) => join(decksDir, f));
		} catch {
			console.error(`Decks directory not found: ${decksDir}`);
			process.exitCode = 1;
			return;
		}
	}

	if (files.length === 0) {
		console.log("No .fc files found.");
		return;
	}

	let totalFixes = 0;

	for (const filePath of files) {
		let text: string;
		try {
			text = await readFile(filePath, "utf-8");
		} catch {
			console.error(`Could not read: ${filePath}`);
			continue;
		}

		const { fixed, changes } = fixDeck(text);

		if (changes.length > 0) {
			await writeFile(filePath, fixed, "utf-8");
			const name = basename(filePath);
			for (const change of changes) {
				console.log(`${name}: ${change}`);
			}
			totalFixes += changes.length;
		}
	}

	if (totalFixes > 0) {
		console.log(`Fixed ${totalFixes} issues in ${files.length} files`);
	} else {
		console.log("All files clean");
	}
}
