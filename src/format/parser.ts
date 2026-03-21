import type { Card, CardType, Deck, DeckMeta } from "../types.ts";
import { generateCardId } from "../types.ts";

const FIELD_KEYWORDS = [
	"Q:",
	"A:",
	"tags:",
	"type:",
	"hint:",
	"difficulty:",
	"source:",
	"reversible:",
	"choices:",
] as const;

type FieldKey =
	| "Q"
	| "A"
	| "tags"
	| "type"
	| "hint"
	| "difficulty"
	| "source"
	| "reversible"
	| "choices";

function matchFieldKeyword(line: string): [FieldKey, string] | null {
	for (const kw of FIELD_KEYWORDS) {
		if (line.startsWith(kw)) {
			return [kw.slice(0, -1) as FieldKey, line.slice(kw.length).trimStart()];
		}
	}
	return null;
}

function isSeparator(line: string): boolean {
	return line.trim() === "---";
}

function isContinuation(line: string): boolean {
	return line.length > 0 && (line.startsWith(" ") || line.startsWith("\t"));
}

function isBlankLine(line: string): boolean {
	return line.trim() === "";
}

/** Safely get first element of an array, returning empty string if missing. */
function first(arr: string[] | undefined): string {
	return arr?.[0] ?? "";
}

/**
 * Parse a single card block (array of lines between --- separators) into a Card.
 * Returns null if the block has no Q: field (empty card).
 */
export function parseCard(lines: string[]): Card | null {
	const fields: Partial<Record<FieldKey, string[]>> = {};
	let currentField: FieldKey | null = null;

	for (const line of lines) {
		const fieldMatch = matchFieldKeyword(line);
		if (fieldMatch) {
			const [key, value] = fieldMatch;
			const arr = fields[key] ?? [];
			if (!fields[key]) {
				fields[key] = arr;
			}
			if (value) {
				arr.push(value);
			}
			currentField = key;
			continue;
		}

		// Continuation lines (indented) or blank lines append to current Q/A field
		if (
			currentField &&
			(currentField === "Q" || currentField === "A") &&
			(isContinuation(line) || isBlankLine(line))
		) {
			const arr = fields[currentField] ?? [];
			if (!fields[currentField]) {
				fields[currentField] = arr;
			}
			// For indented continuation, strip leading whitespace
			arr.push(isBlankLine(line) ? "" : line.trimStart());
			continue;
		}

		// Non-continuation, non-field line resets current field tracking
		currentField = null;
	}

	// Must have a question
	const questionLines = fields.Q;
	if (!questionLines || questionLines.length === 0) {
		return null;
	}

	const question = questionLines.join("\n");
	const answer = fields.A ? fields.A.join("\n") : "";

	// Determine type: cloze auto-detection takes priority
	let type: CardType = "qa";
	if (/\{\{.+?\}\}/.test(question)) {
		type = "cloze";
	} else {
		const typeVal = first(fields.type).trim();
		if (
			typeVal === "code-output" ||
			typeVal === "cloze" ||
			typeVal === "mcq" ||
			typeVal === "true-false"
		) {
			type = typeVal;
		}
	}

	// Parse tags
	const tags: string[] = [];
	const rawTags = first(fields.tags);
	if (rawTags) {
		for (const part of rawTags.split(",")) {
			const trimmed = part.trim();
			if (trimmed) {
				tags.push(trimmed);
			}
		}
	}

	// Parse choices (comma-separated or pipe-separated)
	const choicesRaw = first(fields.choices).trim();
	let choices: string[] | undefined;
	if (choicesRaw) {
		const sep = choicesRaw.includes("|") ? "|" : ",";
		choices = choicesRaw
			.split(sep)
			.map((c) => c.trim())
			.filter(Boolean);
	}

	// Auto-detect true-false from answer
	const answerLower = answer.trim().toLowerCase();
	if (
		type === "qa" &&
		(answerLower === "true" || answerLower === "false") &&
		!choices
	) {
		type = "true-false";
	}

	// Auto-detect mcq from choices
	if (type === "qa" && choices && choices.length >= 2) {
		type = "mcq";
	}

	const card: Card = {
		id: generateCardId(question),
		question,
		answer,
		type,
		tags,
	};

	if (choices && choices.length > 0) {
		card.choices = choices;
	}

	const hintVal = first(fields.hint).trim();
	if (hintVal) {
		card.hint = hintVal;
	}

	const difficultyVal = first(fields.difficulty).trim();
	if (difficultyVal) {
		const val = Number.parseInt(difficultyVal, 10);
		if (!Number.isNaN(val)) {
			card.difficulty = val;
		}
	}

	const sourceVal = first(fields.source).trim();
	if (sourceVal) {
		card.source = sourceVal;
	}

	const reversibleVal = first(fields.reversible).trim();
	if (reversibleVal) {
		card.reversible = reversibleVal === "true";
	}

	return card;
}

/**
 * Parse .fc file text into a structured Deck object.
 */
export function parseDeck(text: string): Deck {
	const meta: DeckMeta = {
		name: "",
		tags: [],
	};

	if (!text.trim()) {
		return { meta, cards: [] };
	}

	const lines = text.split("\n");
	let i = 0;

	// Parse metadata: lines starting with @ before the first ---
	while (i < lines.length) {
		const line = lines[i] ?? "";

		if (isSeparator(line)) {
			break;
		}

		if (line.startsWith("@")) {
			const spaceIdx = line.indexOf(" ");
			if (spaceIdx !== -1) {
				const key = line.slice(1, spaceIdx);
				const value = line.slice(spaceIdx + 1).trim();

				switch (key) {
					case "deck":
						meta.name = value;
						break;
					case "tags":
						meta.tags = value
							.split(",")
							.map((t) => t.trim())
							.filter(Boolean);
						break;
					case "created":
						meta.created = value;
						break;
					case "template":
						meta.template = value;
						break;
				}
			}
		}

		i++;
	}

	// Split remaining lines into card blocks separated by ---
	const cardBlocks: string[][] = [];
	let currentBlock: string[] = [];

	while (i < lines.length) {
		const line = lines[i] ?? "";

		if (isSeparator(line)) {
			if (currentBlock.length > 0) {
				cardBlocks.push(currentBlock);
				currentBlock = [];
			}
		} else {
			currentBlock.push(line);
		}

		i++;
	}

	// Handle trailing block without final ---
	if (currentBlock.length > 0) {
		cardBlocks.push(currentBlock);
	}

	// Parse each block into a card
	const cards: Card[] = [];
	for (const block of cardBlocks) {
		const card = parseCard(block);
		if (card) {
			cards.push(card);
		}
	}

	return { meta, cards };
}
