import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { FcConfig } from "../types.ts";

const CURRENT_VERSION = 1;

export function getDefaultConfig(): FcConfig {
	return {
		ai: {
			enabled: true,
			provider: "openrouter",
			apiKey: "",
			model: "deepseek/deepseek-chat-v3-0324",
		},
		scheduler: {
			algorithm: "fsrs-5",
		},
		review: {
			aiGrading: true,
			showHints: true,
			cardsPerSession: 0,
		},
		decksDir: "~/flashcards",
		editor: "$EDITOR",
		version: CURRENT_VERSION,
	};
}

export function getConfigDir(): string {
	const xdg = process.env.XDG_CONFIG_HOME;
	if (xdg) {
		return join(xdg, "flash");
	}
	return join(homedir(), ".config", "flash");
}

export function getConfigPath(): string {
	return join(getConfigDir(), "config.json");
}

/**
 * Deep merge source into target. Source values override target values.
 * For nested objects, merges recursively. For primitives/arrays, source wins.
 */
function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...target };
	for (const key of Object.keys(source)) {
		const sourceVal = source[key];
		const targetVal = target[key];
		if (
			sourceVal !== null &&
			typeof sourceVal === "object" &&
			!Array.isArray(sourceVal) &&
			targetVal !== null &&
			typeof targetVal === "object" &&
			!Array.isArray(targetVal)
		) {
			result[key] = deepMerge(
				targetVal as Record<string, unknown>,
				sourceVal as Record<string, unknown>,
			);
		} else {
			result[key] = sourceVal;
		}
	}
	return result;
}

export async function loadConfig(configPath?: string): Promise<FcConfig> {
	const path = configPath ?? getConfigPath();
	const defaults = getDefaultConfig();

	try {
		const raw = await readFile(path, "utf-8");
		const saved = JSON.parse(raw) as Record<string, unknown>;
		return deepMerge(
			defaults as unknown as Record<string, unknown>,
			saved,
		) as unknown as FcConfig;
	} catch {
		return defaults;
	}
}

export async function saveConfig(
	config: FcConfig,
	configPath?: string,
): Promise<void> {
	const path = configPath ?? getConfigPath();
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

type Migration = {
	from: number;
	to: number;
	migrate: (config: FcConfig) => { config: FcConfig; description: string };
};

const migrations: Migration[] = [
	// Future migrations go here, e.g.:
	// { from: 1, to: 2, migrate: (config) => ({ config: { ...config, newField: "default" }, description: "Added newField" }) }
];

export function migrateConfig(config: FcConfig): {
	config: FcConfig;
	migrated: boolean;
	changes: string[];
} {
	let current = { ...config };
	const changes: string[] = [];
	let migrated = false;

	// Handle missing version field (pre-versioning config)
	if (current.version === undefined || current.version === null) {
		current.version = CURRENT_VERSION;
		changes.push("Added version field (set to v1)");
		migrated = true;
	}

	// Run sequential migrations
	let safetyCounter = 0;
	while (
		current.version !== undefined &&
		current.version < CURRENT_VERSION &&
		safetyCounter < 100
	) {
		const migration = migrations.find((m) => m.from === current.version);
		if (!migration) {
			break;
		}
		const result = migration.migrate(current);
		current = result.config;
		current.version = migration.to;
		changes.push(result.description);
		migrated = true;
		safetyCounter++;
	}

	return { config: current, migrated, changes };
}

export function resolveDecksDir(config: FcConfig): string {
	const dir = config.decksDir;
	if (dir.startsWith("~/")) {
		return join(homedir(), dir.slice(2));
	}
	if (dir === "~") {
		return homedir();
	}
	return dir;
}

export function getApiKey(config: FcConfig): string {
	const envKey = process.env.FLASH_API_KEY;
	if (envKey) {
		return envKey;
	}
	return config.ai.apiKey;
}
