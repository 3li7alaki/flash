import { getConfigPath, loadConfig, saveConfig } from "../config/config.ts";
import type { FcConfig } from "../types.ts";

/**
 * Get a value from a nested object using dot notation.
 * e.g., getByPath(config, "ai.model") -> config.ai.model
 */
export function getByPath(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".");
	let current: unknown = obj;
	for (const part of parts) {
		if (
			current === null ||
			current === undefined ||
			typeof current !== "object"
		) {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

/**
 * Set a value in a nested object using dot notation.
 * e.g., setByPath(config, "ai.model", "gpt-4") sets config.ai.model = "gpt-4"
 */
export function setByPath(
	obj: Record<string, unknown>,
	path: string,
	value: unknown,
): void {
	const parts = path.split(".");
	let current: Record<string, unknown> = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i] as string;
		if (
			current[part] === undefined ||
			current[part] === null ||
			typeof current[part] !== "object"
		) {
			current[part] = {};
		}
		current = current[part] as Record<string, unknown>;
	}
	const lastPart = parts[parts.length - 1] as string;
	current[lastPart] = value;
}

/**
 * Coerce a string value to the appropriate type based on the existing value.
 */
function coerceValue(existing: unknown, value: string): unknown {
	if (typeof existing === "boolean") {
		return value === "true";
	}
	if (typeof existing === "number") {
		const num = Number(value);
		return Number.isNaN(num) ? value : num;
	}
	return value;
}

/**
 * Format config as a readable string.
 */
export function formatConfig(config: FcConfig): string {
	const lines: string[] = [];

	lines.push("ai:");
	lines.push(`  provider: ${config.ai.provider}`);
	lines.push(`  apiKey: ${config.ai.apiKey ? "***" : "(not set)"}`);
	lines.push(`  model: ${config.ai.model}`);
	lines.push("");
	lines.push("scheduler:");
	lines.push(`  algorithm: ${config.scheduler.algorithm}`);
	lines.push("");
	lines.push("review:");
	lines.push(`  aiGrading: ${config.review.aiGrading}`);
	lines.push(`  showHints: ${config.review.showHints}`);
	lines.push(`  cardsPerSession: ${config.review.cardsPerSession}`);
	lines.push("");
	lines.push(`decksDir: ${config.decksDir}`);
	lines.push(`editor: ${config.editor}`);
	lines.push("");
	lines.push(`Config file: ${getConfigPath()}`);

	return lines.join("\n");
}

export async function configCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const subcommand = args[0];

	if (subcommand === "get") {
		const key = args[1];
		if (!key) {
			console.error("Usage: flash config get <key>");
			process.exitCode = 1;
			return;
		}
		const config = await loadConfig();
		const value = getByPath(config as unknown as Record<string, unknown>, key);
		if (value === undefined) {
			console.error(`Unknown config key: ${key}`);
			process.exitCode = 1;
			return;
		}
		console.log(String(value));
		return;
	}

	if (subcommand === "set") {
		const key = args[1];
		const value = args[2];
		if (!key || value === undefined) {
			console.error("Usage: flash config set <key> <value>");
			process.exitCode = 1;
			return;
		}
		const config = await loadConfig();
		const configObj = config as unknown as Record<string, unknown>;
		const existing = getByPath(configObj, key);
		if (existing === undefined) {
			console.error(`Unknown config key: ${key}`);
			process.exitCode = 1;
			return;
		}
		const coerced = coerceValue(existing, value);
		setByPath(configObj, key, coerced);
		await saveConfig(config);
		console.log(`${key} = ${String(coerced)}`);
		return;
	}

	// Default: show current config
	const config = await loadConfig();
	console.log(formatConfig(config));
}
