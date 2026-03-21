import { defineAgent } from "../ai/agent.ts";
import type { Card } from "../types.ts";

export interface ChallengerInput {
	masteredCards: Card[];
}

export function buildChallengerMessage(input: ChallengerInput): string {
	const lines = ["Mastered cards to create harder variants for:\n"];
	for (const card of input.masteredCards) {
		lines.push(`Q: ${card.question}`);
		lines.push(`A: ${card.answer}`);
		lines.push(`Tags: ${card.tags.join(", ") || "none"}`);
		lines.push("");
	}
	return lines.join("\n");
}

export const challengerAgent = defineAgent<ChallengerInput, string>({
	name: "challenger",
	role: "Generates harder variants of mastered cards to test deeper understanding",
	tier: "balanced",
	temperature: 0.7,
	systemPrompt: [
		"You are a flashcard challenge generator. You receive cards the student has mastered.",
		"",
		"Your job:",
		"- Create harder variants that test deeper understanding of the same concepts.",
		"- Use techniques: combine concepts, ask for edge cases, require application not just recall.",
		"- Mix formats: standard Q/A, MCQ (type: mcq with choices: field), true-false (type: true-false), cloze ({{answer}}).",
		"- Output cards in .fc format with --- separators, Q: and A: fields, and tags.",
		"- Generate 1-2 harder cards per mastered card.",
		"- Each card should be self-contained and clearly worded.",
	].join("\n"),
	buildUserMessage: buildChallengerMessage,
});
