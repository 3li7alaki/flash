import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { getApiKey, loadConfig } from "../config/config.ts";

export function createProvider(apiKey: string, model: string): LanguageModel {
	const openrouter = createOpenAI({
		apiKey,
		baseURL: "https://openrouter.ai/api/v1",
		headers: {
			"HTTP-Referer": "https://github.com/3li7alaki/fc",
		},
	});
	return openrouter(model);
}

export async function createModel(
	configPath?: string,
): Promise<LanguageModel> {
	const config = await loadConfig(configPath);
	const apiKey = getApiKey(config);

	if (!apiKey) {
		throw new Error(
			"No API key. Run 'fc config set ai.apiKey <key>' or set FC_API_KEY",
		);
	}

	return createProvider(apiKey, config.ai.model);
}
