import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	getApiKey,
	getConfigPath,
	loadConfig,
	migrateConfig,
	resolveDecksDir,
	resolveGlobalDecksDir,
	saveConfig,
} from "../config/config.ts";
import { parseDeck } from "../format/parser.ts";

interface CheckResult {
	label: string;
	status: "pass" | "warn" | "fail";
	message: string;
}

function formatResult(result: CheckResult): string {
	const icon =
		result.status === "pass"
			? "\u2713"
			: result.status === "warn"
				? "\u26A0"
				: "\u2717";
	return `${icon} ${result.label}: ${result.message}`;
}

async function checkConfig(): Promise<CheckResult> {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		return {
			label: "Config",
			status: "fail",
			message: `Not found at ${configPath}`,
		};
	}
	try {
		const raw = await readFile(configPath, "utf-8");
		JSON.parse(raw);
		return { label: "Config", status: "pass", message: "Valid JSON" };
	} catch {
		return { label: "Config", status: "fail", message: "Invalid JSON" };
	}
}

async function checkConfigVersion(): Promise<CheckResult> {
	const config = await loadConfig();
	const result = migrateConfig(config);
	if (result.migrated) {
		await saveConfig(result.config);
		const changes = result.changes.join(", ");
		return {
			label: "Config version",
			status: "pass",
			message: `Migrated (${changes})`,
		};
	}
	return {
		label: "Config version",
		status: "pass",
		message: `Current (v${config.version ?? 1})`,
	};
}

async function checkApiKey(): Promise<CheckResult> {
	const config = await loadConfig();
	const key = getApiKey(config);
	if (key) {
		return { label: "API key", status: "pass", message: "Set" };
	}
	return {
		label: "API key",
		status: "warn",
		message: "No API key (AI features disabled)",
	};
}

async function checkDecksDir(): Promise<CheckResult> {
	const config = await loadConfig();
	const dir = resolveDecksDir(config);
	const globalDir = resolveGlobalDecksDir(config);
	const isLocal = dir !== globalDir;
	if (existsSync(dir)) {
		const suffix = isLocal ? " (local)" : "";
		return { label: "Decks directory", status: "pass", message: `${dir}${suffix}` };
	}
	return {
		label: "Decks directory",
		status: "fail",
		message: `Not found: ${dir}`,
	};
}

async function checkDeckFiles(): Promise<CheckResult> {
	const config = await loadConfig();
	const dir = resolveDecksDir(config);
	if (!existsSync(dir)) {
		return {
			label: "Deck files",
			status: "fail",
			message: "Decks directory missing",
		};
	}

	let files: string[];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith(".fc"));
	} catch {
		return {
			label: "Deck files",
			status: "fail",
			message: "Cannot read decks directory",
		};
	}

	if (files.length === 0) {
		return {
			label: "Deck files",
			status: "pass",
			message: "No .fc files found",
		};
	}

	let errorCount = 0;
	let errorFiles = 0;

	for (const file of files) {
		try {
			const text = await readFile(join(dir, file), "utf-8");
			parseDeck(text);
		} catch {
			errorCount++;
			errorFiles++;
		}
	}

	if (errorCount > 0) {
		return {
			label: "Deck files",
			status: "fail",
			message: `${errorCount} errors in ${errorFiles} files`,
		};
	}

	return {
		label: "Deck files",
		status: "pass",
		message: `${files.length} decks, all valid`,
	};
}

function checkBun(): CheckResult {
	try {
		const ver = execSync("bun --version", { encoding: "utf-8" }).trim();
		return { label: "Bun", status: "pass", message: `Bun v${ver}` };
	} catch {
		return { label: "Bun", status: "fail", message: "Bun not found" };
	}
}

function checkGit(): CheckResult {
	try {
		const ver = execSync("git --version", { encoding: "utf-8" }).trim();
		return { label: "Git", status: "pass", message: ver };
	} catch {
		return {
			label: "Git",
			status: "warn",
			message: "Git not found (sync/share disabled)",
		};
	}
}

export async function doctorCommand(
	_args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const results: CheckResult[] = [];

	results.push(await checkConfig());
	results.push(await checkConfigVersion());
	results.push(await checkApiKey());
	results.push(await checkDecksDir());
	results.push(await checkDeckFiles());
	results.push(checkBun());
	results.push(checkGit());

	console.log("flash doctor\n");
	for (const result of results) {
		console.log(formatResult(result));
	}

	const hasErrors = results.some((r) => r.status === "fail");
	if (hasErrors) {
		process.exitCode = 1;
	}
}

export type { CheckResult };
// Exported for testing
export {
	checkApiKey,
	checkBun,
	checkConfig,
	checkConfigVersion,
	checkDeckFiles,
	checkDecksDir,
	checkGit,
};
