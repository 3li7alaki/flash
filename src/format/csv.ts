import type { Card, CardType, Deck } from "../types.ts";
import { generateCardId } from "../types.ts";

const CSV_COLUMNS = [
	"question",
	"answer",
	"tags",
	"type",
	"hint",
	"difficulty",
	"source",
	"reversible",
	"choices",
] as const;

const HEADER = CSV_COLUMNS.join(",");

// --- CSV writing ---

/**
 * Quote a CSV field if it contains commas, newlines, or double quotes.
 * Double quotes within the field are escaped as "".
 */
function csvQuote(value: string): string {
	if (value.includes(",") || value.includes("\n") || value.includes('"')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

/**
 * Export a Deck to a CSV string.
 * Deck metadata is not included (CSV is per-card only).
 */
export function exportCsv(deck: Deck): string {
	const rows: string[] = [HEADER];

	for (const card of deck.cards) {
		const fields = [
			csvQuote(card.question),
			csvQuote(card.answer),
			card.tags.length > 0 ? csvQuote(card.tags.join(", ")) : "",
			card.type,
			card.hint ? csvQuote(card.hint) : "",
			card.difficulty !== undefined ? String(card.difficulty) : "",
			card.source ? csvQuote(card.source) : "",
			card.reversible === true ? "true" : "",
			card.choices ? csvQuote(card.choices.join(" | ")) : "",
		];
		rows.push(fields.join(","));
	}

	return `${rows.join("\n")}\n`;
}

// --- CSV parsing ---

/**
 * Parse CSV text into rows of string arrays, respecting quoted fields.
 * Handles: quoted fields, escaped quotes (""), newlines within quotes.
 */
function parseCsvRows(text: string): string[][] {
	const rows: string[][] = [];
	let i = 0;

	while (i < text.length) {
		const [row, nextI] = parseCsvRow(text, i);
		if (row.length > 0 || i < text.length) {
			rows.push(row);
		}
		i = nextI;
	}

	return rows;
}

function parseCsvRow(text: string, start: number): [string[], number] {
	const fields: string[] = [];
	let i = start;

	while (i < text.length) {
		// End of row
		if (text[i] === "\n") {
			// If we haven't added any fields yet and this is a bare newline, add empty field
			if (fields.length === 0) {
				fields.push("");
			}
			return [fields, i + 1];
		}

		const [field, nextI] = parseCsvField(text, i);
		fields.push(field);
		i = nextI;

		// After a field, expect comma or newline or end
		if (i < text.length && text[i] === ",") {
			i++; // skip comma
			// If comma is followed by newline or end, there's a trailing empty field
			if (i >= text.length || text[i] === "\n") {
				fields.push("");
				if (i < text.length && text[i] === "\n") {
					i++;
				}
				return [fields, i];
			}
		} else if (i < text.length && text[i] === "\n") {
			i++;
			return [fields, i];
		}
	}

	return [fields, i];
}

function parseCsvField(text: string, start: number): [string, number] {
	if (start >= text.length) {
		return ["", start];
	}

	// Quoted field
	if (text[start] === '"') {
		let value = "";
		let i = start + 1;
		while (i < text.length) {
			if (text[i] === '"') {
				// Escaped quote ""
				if (i + 1 < text.length && text[i + 1] === '"') {
					value += '"';
					i += 2;
				} else {
					// End of quoted field
					return [value, i + 1];
				}
			} else {
				value += text[i];
				i++;
			}
		}
		// Unterminated quote — return what we have
		return [value, i];
	}

	// Unquoted field — read until comma or newline
	let value = "";
	let i = start;
	while (i < text.length && text[i] !== "," && text[i] !== "\n") {
		value += text[i];
		i++;
	}
	return [value, i];
}

/**
 * Import a CSV string into an array of Cards.
 * Expects the first row to be the header.
 */
export function importCsv(csvText: string): Card[] {
	const rows = parseCsvRows(csvText);

	if (rows.length <= 1) {
		return [];
	}

	// Skip header row (index 0)
	const cards: Card[] = [];
	for (let r = 1; r < rows.length; r++) {
		const row = rows[r];
		if (!row || row.length === 0) continue;

		// Skip rows that are effectively empty
		const question = row[0] ?? "";
		if (!question) continue;

		const answer = row[1] ?? "";
		const tagsStr = row[2] ?? "";
		const typeStr = row[3] ?? "qa";
		const hint = row[4] ?? "";
		const difficultyStr = row[5] ?? "";
		const source = row[6] ?? "";
		const reversibleStr = row[7] ?? "";
		const choicesStr = row[8] ?? "";

		// Parse tags
		const tags: string[] = [];
		if (tagsStr) {
			for (const part of tagsStr.split(",")) {
				const trimmed = part.trim();
				if (trimmed) {
					tags.push(trimmed);
				}
			}
		}

		// Parse type
		let type: CardType = "qa";
		if (
			typeStr === "cloze" ||
			typeStr === "code-output" ||
			typeStr === "qa" ||
			typeStr === "mcq" ||
			typeStr === "true-false"
		) {
			type = typeStr;
		}

		const card: Card = {
			id: generateCardId(question),
			question,
			answer,
			type,
			tags,
		};

		if (hint) {
			card.hint = hint;
		}

		if (difficultyStr) {
			const val = Number.parseInt(difficultyStr, 10);
			if (!Number.isNaN(val)) {
				card.difficulty = val;
			}
		}

		if (source) {
			card.source = source;
		}

		if (reversibleStr === "true") {
			card.reversible = true;
		}

		if (choicesStr) {
			const sep = choicesStr.includes("|") ? "|" : ",";
			card.choices = choicesStr
				.split(sep)
				.map((c) => c.trim())
				.filter(Boolean);
		}

		cards.push(card);
	}

	return cards;
}
