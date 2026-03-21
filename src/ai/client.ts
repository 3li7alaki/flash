import { getApiKey, loadConfig } from "../config/config.ts";

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface ChatOptions {
	temperature?: number;
	maxTokens?: number;
}

export class OpenRouterClient {
	private apiKey: string;
	private model: string;
	private baseUrl: string;

	constructor(opts: { apiKey: string; model: string; baseUrl?: string }) {
		this.apiKey = opts.apiKey;
		this.model = opts.model;
		this.baseUrl = opts.baseUrl ?? "https://openrouter.ai/api/v1";
	}

	async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://github.com/3li7alaki/fc",
			},
			body: JSON.stringify({
				model: this.model,
				messages,
				temperature: options?.temperature,
				max_tokens: options?.maxTokens,
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			let detail = "";
			try {
				const parsed = JSON.parse(body);
				detail = parsed.error?.message ?? body;
			} catch {
				detail = body;
			}
			throw new Error(`OpenRouter API error (${response.status}): ${detail}`);
		}

		const data = (await response.json()) as {
			choices: { message: { content: string } }[];
		};

		const choice = data.choices?.[0];
		if (!choice) {
			throw new Error("No response from OpenRouter");
		}

		return choice.message.content;
	}
}

export async function createClient(
	configPath?: string,
): Promise<OpenRouterClient> {
	const config = await loadConfig(configPath);
	const apiKey = getApiKey(config);

	if (!apiKey) {
		throw new Error(
			"No API key. Run 'fc config set ai.apiKey <key>' or set FC_API_KEY",
		);
	}

	return new OpenRouterClient({
		apiKey,
		model: config.ai.model,
	});
}
