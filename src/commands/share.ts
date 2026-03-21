import { basename, join } from "node:path";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { findDeck, toKebabCase } from "./utils.ts";

/**
 * Derive the GitHub repo name from a deck name or path.
 * "Rust Ownership" -> "fc-deck-rust-ownership"
 */
export function repoNameFromDeck(deckNameOrPath: string): string {
	const name = basename(deckNameOrPath, ".fc");
	return `fc-deck-${toKebabCase(name)}`;
}

/**
 * Check if the `gh` CLI is available.
 */
async function ghAvailable(): Promise<boolean> {
	try {
		const proc = Bun.spawn(["gh", "--version"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		await proc.exited;
		return proc.exitCode === 0;
	} catch {
		return false;
	}
}

export async function shareCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const deckName = args[0];
	if (!deckName) {
		console.error("Usage: fc share <deck>");
		process.exitCode = 1;
		return;
	}

	if (!(await ghAvailable())) {
		console.error(
			"GitHub CLI (gh) is required but not installed.\nInstall it: https://cli.github.com/",
		);
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const deckPath = findDeck(deckName, decksDir);

	const repoName = repoNameFromDeck(deckPath);

	// Create a temp directory for the repo
	const tmpDir = join(decksDir, ".share-tmp", repoName);
	await Bun.spawn(["rm", "-rf", tmpDir]).exited;
	await Bun.spawn(["mkdir", "-p", tmpDir]).exited;

	try {
		// Copy the .fc file (NOT .fc.state)
		const deckFile = basename(deckPath);
		const deckContent = await Bun.file(deckPath).text();
		await Bun.write(join(tmpDir, deckFile), deckContent);

		// Write a README
		const readme = `# ${repoName}

Flashcard deck for [fc](https://github.com/ahalaki/fc).

## Usage

\`\`\`bash
fc follow <this-repo-url>
\`\`\`
`;
		await Bun.write(join(tmpDir, "README.md"), readme);

		// Initialize git repo and push
		const run = async (cmd: string[], cwd: string) => {
			const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
			await proc.exited;
			if (proc.exitCode !== 0) {
				const err = await new Response(proc.stderr).text();
				throw new Error(`Command failed: ${cmd.join(" ")}\n${err}`);
			}
		};

		await run(["git", "init"], tmpDir);
		await run(["git", "add", "."], tmpDir);
		await run(["git", "commit", "-m", "Initial deck upload"], tmpDir);

		// Create repo on GitHub (public)
		await run(
			[
				"gh",
				"repo",
				"create",
				repoName,
				"--public",
				"--source",
				tmpDir,
				"--push",
			],
			tmpDir,
		);

		// Get the repo URL
		const urlProc = Bun.spawn(
			["gh", "repo", "view", repoName, "--json", "url", "-q", ".url"],
			{ cwd: tmpDir, stdout: "pipe", stderr: "pipe" },
		);
		await urlProc.exited;
		const repoUrl = (await new Response(urlProc.stdout).text()).trim();

		console.log(`Shared! ${repoUrl}`);
	} finally {
		// Clean up temp dir
		await Bun.spawn(["rm", "-rf", join(decksDir, ".share-tmp")]).exited;
	}
}
