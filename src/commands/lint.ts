import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { lintDeck } from "../format/linter.ts";
import { findDeck } from "./utils.ts";

export async function lintCommand(
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

	let totalErrors = 0;
	let totalWarnings = 0;

	for (const filePath of files) {
		let text: string;
		try {
			text = await readFile(filePath, "utf-8");
		} catch {
			console.error(`Could not read: ${filePath}`);
			totalErrors++;
			continue;
		}

		const issues = lintDeck(text);
		const name = basename(filePath);

		for (const issue of issues) {
			console.log(`${name}:${issue.line} ${issue.severity}: ${issue.message}`);
			if (issue.severity === "error") {
				totalErrors++;
			} else {
				totalWarnings++;
			}
		}
	}

	console.log(
		`${totalErrors} errors, ${totalWarnings} warnings in ${files.length} files`,
	);

	if (totalErrors > 0) {
		process.exitCode = 1;
	}
}
