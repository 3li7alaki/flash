import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, resolveDecksDir, saveConfig } from "../config/config.ts";
import { parseDeck } from "../format/parser.ts";

export async function syncCommand(
	_args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const config = await loadConfig();
	const followed = config.followed ?? [];

	if (followed.length === 0) {
		console.log("Nothing to sync. Use `flash follow <url>` first.");
		return;
	}

	const decksDir = resolveDecksDir(config);
	const followedDir = join(decksDir, ".followed");

	let syncedDecks = 0;
	let totalCards = 0;

	for (const entry of followed) {
		const cloneDir = join(followedDir, entry.name);

		if (!existsSync(cloneDir)) {
			console.error(`Skipping ${entry.name}: clone directory not found.`);
			continue;
		}

		// Pull latest changes
		const proc = Bun.spawn(["git", "-C", cloneDir, "pull"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		await proc.exited;

		// Copy .fc files into decks dir
		const entries = await readdir(cloneDir);
		const fcFiles = entries.filter((f) => f.endsWith(".fc"));

		let deckCards = 0;
		for (const file of fcFiles) {
			const src = join(cloneDir, file);
			const dest = join(decksDir, file);
			const content = await Bun.file(src).text();
			await Bun.write(dest, content);

			const deck = parseDeck(content);
			deckCards += deck.cards.length;
		}

		entry.lastSync = new Date().toISOString();
		totalCards += deckCards;
		syncedDecks++;
	}

	config.followed = followed;
	await saveConfig(config);

	console.log(`Synced ${syncedDecks} decks. ${totalCards} cards updated.`);
}
