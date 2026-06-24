import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig, resolveDecksDir, saveConfig } from "../config/config.ts";
import { copyDeckFiles } from "./utils.ts";

/**
 * Extract repo name from a GitHub URL.
 * "https://github.com/user/flash-deck-rust" -> "flash-deck-rust"
 * "git@github.com:user/flash-deck-rust.git" -> "flash-deck-rust"
 */
export function repoNameFromUrl(url: string): string {
	const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "");
	const parts = cleaned.split("/");
	return parts[parts.length - 1] ?? cleaned;
}

export async function followCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const url = args[0];
	if (!url) {
		console.error("Usage: flash follow <github-url>");
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const repoName = repoNameFromUrl(url);

	// Check if already following
	const followed = config.followed ?? [];
	if (followed.some((f) => f.url === url)) {
		console.log(`Already following ${repoName}.`);
		return;
	}

	// Clone into .followed subdirectory
	const followedDir = join(decksDir, ".followed");
	await mkdir(followedDir, { recursive: true });

	const cloneDir = join(followedDir, repoName);

	if (existsSync(cloneDir)) {
		// Already cloned, just pull
		const proc = Bun.spawn(["git", "-C", cloneDir, "pull"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		await proc.exited;
	} else {
		const proc = Bun.spawn(["git", "clone", url, cloneDir], {
			stdout: "pipe",
			stderr: "pipe",
		});
		await proc.exited;
		if (proc.exitCode !== 0) {
			const err = await new Response(proc.stderr).text();
			console.error(`Failed to clone ${url}: ${err}`);
			process.exitCode = 1;
			return;
		}
	}

	// Copy .fc files from clone into decks dir
	const cardCount = await copyDeckFiles(cloneDir, decksDir);

	// Store follow relationship in config
	followed.push({
		url,
		name: repoName,
		lastSync: new Date().toISOString(),
	});
	config.followed = followed;
	await saveConfig(config);

	console.log(`Following ${repoName}. ${cardCount} cards added.`);
}
