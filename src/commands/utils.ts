import { readdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, extname, isAbsolute, join } from "node:path";
import { parseDeck } from "../format/parser.ts";

/**
 * Convert a deck name to a kebab-case filename (without extension).
 *
 * "Rust Ownership" -> "rust-ownership"
 * "My   Cool  Deck!" -> "my-cool-deck"
 */
export function toKebabCase(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Find a .fc file by name (fuzzy: "rust" matches "rust-ownership.fc") or by exact path.
 * Throws if not found or if the match is ambiguous (multiple matches).
 */
export function findDeck(nameOrPath: string, decksDir: string): string {
	// If it looks like an absolute path or has .fc extension, treat as exact path
	if (isAbsolute(nameOrPath) || nameOrPath.endsWith(".fc")) {
		const resolved = isAbsolute(nameOrPath)
			? nameOrPath
			: join(decksDir, nameOrPath);
		return resolved;
	}

	// List .fc files in decks dir
	let files: string[];
	try {
		files = readdirSync(decksDir).filter((f) => f.endsWith(".fc"));
	} catch {
		throw new Error(`Decks directory not found: ${decksDir}`);
	}

	// Exact filename match (without extension)
	const kebab = toKebabCase(nameOrPath);
	const exactMatch = files.find(
		(f) =>
			basename(f, extname(f)) === kebab ||
			basename(f, extname(f)) === nameOrPath,
	);
	if (exactMatch) {
		return join(decksDir, exactMatch);
	}

	// Fuzzy: find files whose basename (without .fc) contains the search term
	const searchLower = nameOrPath.toLowerCase();
	const matches = files.filter((f) =>
		basename(f, extname(f)).toLowerCase().includes(searchLower),
	);

	if (matches.length === 0) {
		throw new Error(`No deck found matching "${nameOrPath}" in ${decksDir}`);
	}

	if (matches.length > 1) {
		const names = matches.map((f) => basename(f, ".fc")).join(", ");
		throw new Error(
			`Ambiguous deck name "${nameOrPath}" matches multiple decks: ${names}`,
		);
	}

	return join(decksDir, matches[0] as string);
}

/**
 * Copy all .fc files from a cloned repo directory into decksDir,
 * parsing each to accumulate a total card count.
 * Returns the total number of cards across the copied decks.
 */
export async function copyDeckFiles(
	cloneDir: string,
	decksDir: string,
): Promise<number> {
	let cardCount = 0;
	const entries = await readdir(cloneDir);
	const fcFiles = entries.filter((f) => f.endsWith(".fc"));

	for (const file of fcFiles) {
		const src = join(cloneDir, file);
		const dest = join(decksDir, file);
		const content = await Bun.file(src).text();
		await Bun.write(dest, content);

		const deck = parseDeck(content);
		cardCount += deck.cards.length;
	}

	return cardCount;
}
