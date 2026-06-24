import { generateObject, generateText, type LanguageModel } from "ai";
import type { ZodType } from "zod";
import type { ModelTier } from "./client.ts";

export interface AgentDefinition<TInput, TOutput> {
	name: string;
	tier: ModelTier;
	systemPrompt: string;
	buildUserMessage: (input: TInput) => string;
	outputSchema?: ZodType<TOutput>;
	temperature?: number;
}

export interface Agent<TInput, TOutput> {
	run: (model: LanguageModel, input: TInput) => Promise<TOutput>;
	definition: AgentDefinition<TInput, TOutput>;
}

export function defineAgent<TInput, TOutput>(
	def: AgentDefinition<TInput, TOutput>,
): Agent<TInput, TOutput> {
	return {
		definition: def,
		async run(model: LanguageModel, input: TInput): Promise<TOutput> {
			const prompt = def.buildUserMessage(input);

			if (def.outputSchema) {
				const { object } = await generateObject({
					model,
					system: def.systemPrompt,
					prompt,
					schema: def.outputSchema,
					temperature: def.temperature,
				});
				return object;
			}

			const { text } = await generateText({
				model,
				system: def.systemPrompt,
				prompt,
				temperature: def.temperature,
			});
			return text as TOutput;
		},
	};
}
