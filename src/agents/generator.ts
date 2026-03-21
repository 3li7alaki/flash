import { defineAgent } from "../ai/agent.ts";
import { parseDeck } from "../format/parser.ts";
import type { Deck } from "../types.ts";

export type ContentType = "topic" | "file" | "url" | "text";

export interface GeneratorInput {
	content: string;
	contentType: ContentType;
	cardCount?: number;
}

export function buildGeneratorMessage(input: GeneratorInput): string {
	const count = input.cardCount ?? 10;
	const lines = [
		`Content type: ${input.contentType}`,
		`Target card count: ${count}`,
		"",
		"Content:",
		input.content,
	];
	return lines.join("\n");
}

export function parseGeneratorResponse(text: string): Deck {
	// Extract .fc block from markdown fences if present
	const fenceMatch = text.match(/```(?:fc)?\n([\s\S]*?)```/);
	const fcText = fenceMatch ? (fenceMatch[1] ?? "") : text;
	return parseDeck(fcText);
}

/**
 * Strip HTML tags, decode common entities, collapse whitespace.
 */
export function stripHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Detect content source from CLI arguments.
 */
export function detectContentSource(
	args: string[],
	fromFlag?: string,
): { type: ContentType; value: string } {
	if (fromFlag) {
		if (fromFlag.startsWith("http://") || fromFlag.startsWith("https://")) {
			return { type: "url", value: fromFlag };
		}
		return { type: "file", value: fromFlag };
	}

	// If there are positional args, treat as topic regardless of TTY
	if (args.length > 0 && args.join(" ").trim()) {
		return { type: "topic", value: args.join(" ") };
	}

	if (!process.stdin.isTTY) {
		return { type: "text", value: "" }; // stdin — caller reads it
	}

	return { type: "topic", value: "" };
}

export const generatorAgent = defineAgent<GeneratorInput, string>({
	name: "generator",
	role: "Creates high-quality flashcards from source content",
	tier: "balanced",
	temperature: 0.7,
	systemPrompt: [
		"You are a flashcard generator. Create high-quality flashcards in .fc format from the provided content.",
		"",
		"Output format — return ONLY valid .fc format text with no other commentary:",
		"- Start with @deck and @tags metadata lines",
		"- Separate cards with --- on its own line",
		"- Each card has Q: and A: fields",
		"- Add relevant tags: per card",
		"",
		"Card quality rules:",
		"- Each card tests exactly ONE concept",
		"- Questions should be specific and unambiguous",
		"- Answers should be concise but complete",
		"- Mix card types: standard Q/A, cloze (use {{answer}} in the question), code-output (add type: code-output), mcq (add type: mcq and choices: a | b | c | d), and true-false (add type: true-false, answer is True or False)",
		"- For cloze cards, the {{hidden text}} should be the key term or concept",
		"- For MCQ cards, add a choices: field with pipe-separated options (e.g., choices: Option A | Option B | Option C | Option D). The A: field is the correct choice letter or text.",
		"- For true-false cards, the A: field should be 'True' or 'False'.",
		"- Include good, specific tags for each card",
		"",
		"Content type handling:",
		"- topic: Generate cards covering the key concepts of the topic",
		"- file: Extract the most important concepts from the file content",
		"- url: Focus on the main ideas from the page content",
		"- text: Generate cards from the provided text/notes",
	].join("\n"),
	buildUserMessage: buildGeneratorMessage,
});
