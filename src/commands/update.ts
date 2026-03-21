import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Detect the flash install directory by walking up from the source file.
 */
function findInstallDir(): string | null {
	// Start from the directory containing this source file
	let dir = resolve(dirname(import.meta.dir));

	// Walk up to find a directory with a .git folder and package.json
	for (let i = 0; i < 10; i++) {
		if (
			existsSync(join(dir, ".git")) &&
			existsSync(join(dir, "package.json"))
		) {
			return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

export async function updateCommand(
	_args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const installDir = findInstallDir();

	if (!installDir) {
		console.log("Running in dev mode, use git pull to update");
		return;
	}

	console.log("Checking for updates...");

	// Read current version before update
	let oldVersion = "unknown";
	try {
		const pkg = await Bun.file(join(installDir, "package.json")).json();
		oldVersion = pkg.version ?? "unknown";
	} catch {
		// ignore
	}

	try {
		// Ensure LF line endings (WSL with Windows git may default to CRLF)
		execSync("git config core.autocrlf input", {
			cwd: installDir,
			stdio: "pipe",
		});
		execSync("git fetch origin", { cwd: installDir, stdio: "pipe" });

		// Check if there are updates
		const localHash = execSync("git rev-parse HEAD", {
			cwd: installDir,
			encoding: "utf-8",
		}).trim();
		const remoteHash = execSync("git rev-parse origin/main", {
			cwd: installDir,
			encoding: "utf-8",
		}).trim();

		if (localHash === remoteHash) {
			console.log(`Already up to date (v${oldVersion})`);
			return;
		}

		execSync("git reset --hard origin/main", {
			cwd: installDir,
			stdio: "pipe",
		});
		execSync("bun install", { cwd: installDir, stdio: "pipe" });

		// Read new version after update
		let newVersion = "unknown";
		try {
			const pkg = await Bun.file(join(installDir, "package.json")).json();
			newVersion = pkg.version ?? "unknown";
		} catch {
			// ignore
		}

		console.log(`Updated: v${oldVersion} -> v${newVersion}`);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Update failed: ${message}`);
		process.exitCode = 1;
	}
}
