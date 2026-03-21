import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { getApiKey, loadConfig } from "../config/config.ts";
import type { FcConfig } from "../types.ts";

export type ModelTier = "fast" | "balanced" | "heavy";

const DEFAULT_MODELS: Record<ModelTier, string> = {
	fast: "anthropic/claude-haiku",
	balanced: "anthropic/claude-sonnet-4",
	heavy: "anthropic/claude-sonnet-4",
};

export function createProvider(apiKey: string, modelId: string): LanguageModel {
	const openrouter = createOpenAI({
		apiKey,
		baseURL: "https://openrouter.ai/api/v1",
		headers: {
			"HTTP-Referer": "https://github.com/3li7alaki/flash",
		},
	});
	return openrouter(modelId);
}

export function resolveModel(tier: ModelTier, config: FcConfig): string {
	// User override in config takes precedence
	if (config.ai.model) return config.ai.model;
	return DEFAULT_MODELS[tier];
}

export async function createModelForTier(
	tier: ModelTier,
	configPath?: string,
): Promise<LanguageModel> {
	const config = await loadConfig(configPath);
	const apiKey = getApiKey(config);

	if (!apiKey) {
		throw new Error(
			"No API key. Run 'flash config set ai.apiKey <key>' or set FLASH_API_KEY",
		);
	}

	const modelId = resolveModel(tier, config);
	return createProvider(apiKey, modelId);
}
