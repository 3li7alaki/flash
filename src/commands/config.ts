import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as p from "@clack/prompts";
import {
	getConfigDir,
	getConfigPath,
	loadConfig,
	saveConfig,
} from "../config/config.ts";
import type { FcConfig } from "../types.ts";

// Models we recommend — shown at the top of the list
const RECOMMENDED_IDS = new Set([
	"deepseek/deepseek-chat-v3-0324",
	"deepseek/deepseek-r1",
	"google/gemini-2.5-flash",
	"anthropic/claude-sonnet-4",
	"openai/gpt-4o",
]);

interface OpenRouterModel {
	id: string;
	name: string;
	pricing: { prompt: string; completion: string };
	architecture?: { output_modalities?: string[] };
}

function formatPrice(perToken: string): string {
	const perMillion = Number.parseFloat(perToken) * 1_000_000;
	if (perMillion < 0.01) return "free";
	if (perMillion < 1) return `$${perMillion.toFixed(2)}`;
	return `$${perMillion.toFixed(1)}`;
}

function modelToOption(m: OpenRouterModel) {
	const inPrice = formatPrice(m.pricing.prompt);
	const outPrice = formatPrice(m.pricing.completion);
	return {
		value: m.id,
		label: m.name,
		hint: `${inPrice}/M in, ${outPrice}/M out`,
	};
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

async function fetchModels(): Promise<OpenRouterModel[]> {
	const cacheDir = getConfigDir();
	const cachePath = join(cacheDir, "models-cache.json");

	// Try cache first
	if (existsSync(cachePath)) {
		try {
			const raw = await readFile(cachePath, "utf-8");
			const cached = JSON.parse(raw) as {
				ts: number;
				models: OpenRouterModel[];
			};
			if (Date.now() - cached.ts < CACHE_TTL_MS) {
				return cached.models;
			}
		} catch {
			// stale or corrupt cache, re-fetch
		}
	}

	const res = await fetch("https://openrouter.ai/api/v1/models");
	if (!res.ok) throw new Error(`OpenRouter API returned ${res.status}`);
	const data = (await res.json()) as { data: OpenRouterModel[] };

	// Filter to text-output models only
	const textModels = data.data.filter((m) => {
		const out = m.architecture?.output_modalities ?? ["text"];
		return out.includes("text") && !out.includes("image");
	});

	// Cache
	await mkdir(cacheDir, { recursive: true });
	await writeFile(
		cachePath,
		JSON.stringify({ ts: Date.now(), models: textModels }),
	);

	return textModels;
}

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

async function validateApiKey(key: string): Promise<boolean> {
	try {
		const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
			headers: { Authorization: `Bearer ${key}` },
		});
		return res.ok;
	} catch {
		return false;
	}
}

async function validateModel(modelId: string): Promise<boolean> {
	try {
		const models = await fetchModels();
		return models.some((m) => m.id === modelId);
	} catch {
		return true; // can't validate offline, assume ok
	}
}

/**
 * Headless setup — validates and saves without prompts.
 * Used by Claude Code and scripts.
 */
async function setupHeadless(
	flags: Record<string, string | boolean>,
): Promise<void> {
	const key = flags.key as string | undefined;
	const modelId = flags.model as string | undefined;

	if (!key && !modelId) {
		console.error(
			"Usage: flash config setup --key <api-key> [--model <model-id>]",
		);
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();

	if (key) {
		const valid = await validateApiKey(key);
		if (!valid) {
			console.error("Invalid API key.");
			process.exitCode = 1;
			return;
		}
		config.ai.apiKey = key;
		console.log("API key validated and saved.");
	}

	if (modelId) {
		const valid = await validateModel(modelId);
		if (!valid) {
			console.error(`Model "${modelId}" not found on OpenRouter.`);
			process.exitCode = 1;
			return;
		}
		config.ai.model = modelId;
		console.log(`Model set to ${modelId}.`);
	}

	await saveConfig(config);
}

/**
 * Interactive setup wizard — prompts for key and model.
 */
async function setupInteractive(): Promise<void> {
	const config = await loadConfig();

	p.intro("flash setup");

	// Step 1: API key
	const apiKey = await p.text({
		message: "OpenRouter API key",
		placeholder: "sk-or-v1-...",
		initialValue: config.ai.apiKey || "",
		validate: (val) => {
			if (!val?.trim()) return "API key is required for AI features";
		},
	});
	if (p.isCancel(apiKey)) {
		p.cancel("Setup cancelled.");
		return;
	}

	// Step 2: Validate key
	const spinner = p.spinner();
	spinner.start("Validating API key...");
	const keyValid = await validateApiKey(apiKey);
	if (!keyValid) {
		spinner.stop("Invalid API key");
		p.log.error("API key is invalid or expired.");
		const proceed = await p.confirm({
			message: "Continue anyway?",
			initialValue: false,
		});
		if (p.isCancel(proceed) || !proceed) {
			p.cancel("Setup cancelled.");
			return;
		}
	} else {
		spinner.stop("API key valid");
	}

	// Step 3: Fetch models and let user pick
	spinner.start("Fetching available models...");
	let modelOptions: Array<{ value: string; label: string; hint: string }>;
	try {
		const models = await fetchModels();
		spinner.stop(`${models.length} models available`);

		const byPrice = (a: OpenRouterModel, b: OpenRouterModel) =>
			Number.parseFloat(a.pricing.completion) -
			Number.parseFloat(b.pricing.completion);

		const recommended = models
			.filter((m) => RECOMMENDED_IDS.has(m.id))
			.sort(byPrice);
		const rest = models.filter((m) => !RECOMMENDED_IDS.has(m.id)).sort(byPrice);

		modelOptions = [
			...recommended.map((m) => ({
				...modelToOption(m),
				label: `★ ${m.name}`,
			})),
			...rest.map(modelToOption),
		];
	} catch {
		spinner.stop("Could not fetch models — using defaults");
		modelOptions = [
			{
				value: "deepseek/deepseek-chat-v3-0324",
				label: "★ DeepSeek V3",
				hint: "$0.27/M in, $1.10/M out",
			},
			{
				value: "deepseek/deepseek-r1",
				label: "★ DeepSeek R1",
				hint: "$0.55/M in, $2.19/M out",
			},
			{
				value: "google/gemini-2.5-flash",
				label: "★ Gemini 2.5 Flash",
				hint: "$0.15/M in, $0.60/M out",
			},
			{
				value: "anthropic/claude-sonnet-4",
				label: "★ Claude Sonnet 4",
				hint: "$3/M in, $15/M out",
			},
			{
				value: "openai/gpt-4o",
				label: "★ GPT-4o",
				hint: "$2.50/M in, $10/M out",
			},
		];
	}

	const model = await p.select({
		message: "Model (★ = recommended)",
		options: modelOptions,
		initialValue: config.ai.model,
	});
	if (p.isCancel(model)) {
		p.cancel("Setup cancelled.");
		return;
	}

	config.ai.apiKey = apiKey;
	config.ai.model = model;
	await saveConfig(config);

	p.outro(`Saved to ${getConfigPath()}`);
}

export async function configCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const subcommand = args[0];

	if (subcommand === "setup") {
		if (_flags.key || _flags.model) {
			await setupHeadless(_flags);
		} else {
			await setupInteractive();
		}
		return;
	}

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
