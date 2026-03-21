import { z } from "zod";
import { defineAgent } from "../ai/agent.ts";
import type { Card, CardState } from "../types.ts";

export interface AnalyzerInput {
	weakCards: Array<{
		card: Card;
		state: CardState;
	}>;
}

export const analyzerOutputSchema = z.object({
	weakAreas: z.array(
		z.object({
			topic: z.string(),
			reason: z.string(),
		}),
	),
	suggestedCards: z.array(
		z.object({
			question: z.string(),
			answer: z.string(),
			tags: z.array(z.string()),
		}),
	),
});

export type AnalyzerOutput = z.infer<typeof analyzerOutputSchema>;

export function buildAnalyzerMessage(input: AnalyzerInput): string {
	const lines = ["Cards with frequent lapses:\n"];
	for (const { card, state } of input.weakCards) {
		lines.push(`Card: ${card.question}`);
		lines.push(`Answer: ${card.answer}`);
		lines.push(`Tags: ${card.tags.join(", ") || "none"}`);
		lines.push(
			`Lapses: ${state.lapses}, Reps: ${state.reps}, Stability: ${state.stability}`,
		);
		lines.push("");
	}
	return lines.join("\n");
}

export const analyzerAgent = defineAgent<AnalyzerInput, AnalyzerOutput>({
	name: "analyzer",
	role: "Analyzes review patterns to find weak areas and suggest targeted cards",
	tier: "fast",
	temperature: 0.3,
	systemPrompt: [
		"You are a study pattern analyzer. You receive flashcard review data for cards the student struggles with.",
		"",
		"Your job:",
		"- Identify weak areas by grouping cards with high lapse counts by topic or concept.",
		"- Explain why each area is weak based on the review patterns.",
		"- Suggest new flashcards that target the gaps from different angles.",
		"- Suggested cards should break down complex topics into smaller, more focused questions.",
		"- Include relevant tags on each suggested card.",
	].join("\n"),
	outputSchema: analyzerOutputSchema,
	buildUserMessage: buildAnalyzerMessage,
});
