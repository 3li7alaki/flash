import { defineAgent } from "../ai/agent.ts";
import type { Card } from "../types.ts";

export interface SummarizerInput {
	cards: Card[];
	deckName: string;
}

export function buildSummarizerMessage(input: SummarizerInput): string {
	const lines = [`Deck: ${input.deckName}\n`, `Cards:\n`];
	for (const card of input.cards) {
		lines.push(`Q: ${card.question}`);
		lines.push(`A: ${card.answer}`);
		if (card.tags.length > 0) {
			lines.push(`Tags: ${card.tags.join(", ")}`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

export const summarizerAgent = defineAgent<SummarizerInput, string>({
	name: "summarizer",
	role: "Creates a study cheat sheet from a deck of flashcards",
	tier: "fast",
	temperature: 0.3,
	systemPrompt: [
		"You are a study cheat sheet generator. You receive all cards from a flashcard deck.",
		"",
		"Your job:",
		"- Organize the cards into a concise, well-structured markdown cheat sheet.",
		"- Group related cards by topic or tags.",
		"- Use headers, bullet points, and code blocks where appropriate.",
		"- Distill key concepts — don't just list Q&A pairs verbatim.",
		"- Keep it concise enough to review in a few minutes.",
		"- Format as clean markdown suitable for terminal display.",
	].join("\n"),
	buildUserMessage: buildSummarizerMessage,
});
