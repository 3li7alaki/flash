import { defineAgent } from "../ai/agent.ts";
import type { Card } from "../types.ts";

export interface ExplainerInput {
	card: Card;
	mode: "explain" | "rephrase";
	failCount: number;
}

export function buildExplainerMessage(input: ExplainerInput): string {
	const lines = [
		`Mode: ${input.mode}`,
		`Times failed: ${input.failCount}`,
		``,
		`Card question: ${input.card.question}`,
		`Card answer: ${input.card.answer}`,
		`Tags: ${input.card.tags.join(", ") || "none"}`,
	];
	if (input.card.hint) {
		lines.push(`Hint: ${input.card.hint}`);
	}
	return lines.join("\n");
}

export const explainerAgent = defineAgent<ExplainerInput, string>({
	name: "explainer",
	tier: "balanced",
	temperature: 0.5,
	systemPrompt: [
		"You are a flashcard explanation assistant.",
		"",
		"When mode is 'explain':",
		"- Give a deeper explanation of the concept in the card.",
		"- Use examples, analogies, or step-by-step breakdowns.",
		"- The more times the student has failed, the simpler your explanation should be.",
		"- Do NOT rewrite the card, just explain it.",
		"",
		"When mode is 'rephrase':",
		"- Rewrite the card to be clearer and easier to remember.",
		"- Output ONLY the rephrased card in .fc format (Q: and A: fields).",
		"- Keep the same meaning but improve clarity.",
		"- If the original is too broad, make it more specific.",
	].join("\n"),
	buildUserMessage: buildExplainerMessage,
});
