import type { ChatMessage, ChatOptions, OpenRouterClient } from "./client.ts";

export interface AgentDefinition<TInput, TOutput> {
	name: string;
	role: string;
	systemPrompt: string;
	buildUserMessage: (input: TInput) => string;
	parseResponse: (response: string) => TOutput;
	temperature?: number;
	maxTokens?: number;
}

export interface Agent<TInput, TOutput> {
	run: (client: OpenRouterClient, input: TInput) => Promise<TOutput>;
	definition: AgentDefinition<TInput, TOutput>;
}

export function defineAgent<TInput, TOutput>(
	def: AgentDefinition<TInput, TOutput>,
): Agent<TInput, TOutput> {
	return {
		definition: def,
		async run(client: OpenRouterClient, input: TInput): Promise<TOutput> {
			const messages: ChatMessage[] = [
				{ role: "system", content: def.systemPrompt },
				{ role: "user", content: def.buildUserMessage(input) },
			];

			const options: ChatOptions = {
				temperature: def.temperature,
				maxTokens: def.maxTokens,
			};

			const response = await client.chat(messages, options);
			return def.parseResponse(response);
		},
	};
}
