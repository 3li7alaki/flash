import type { Card, Deck } from "../types.ts";

/**
 * Serialize a single card to .fc format lines (without separators).
 *
 * Field order: Q:, A:, type: (code-output only), tags:, hint:, difficulty:, source:, reversible:
 * Multiline Q/A: first line on same line as Q:/A:, subsequent lines indented with 3 spaces.
 */
export function serializeCard(card: Card): string {
	const lines: string[] = [];

	lines.push(serializeMultiline("Q:", card.question));
	lines.push(serializeMultiline("A:", card.answer));

	if (
		card.type === "code-output" ||
		card.type === "mcq" ||
		card.type === "true-false"
	) {
		lines.push(`type: ${card.type}`);
	}

	if (card.choices && card.choices.length > 0) {
		lines.push(`choices: ${card.choices.join(" | ")}`);
	}

	if (card.tags.length > 0) {
		lines.push(`tags: ${card.tags.join(", ")}`);
	}

	if (card.hint) {
		lines.push(`hint: ${card.hint}`);
	}

	if (card.difficulty !== undefined) {
		lines.push(`difficulty: ${card.difficulty}`);
	}

	if (card.source) {
		lines.push(`source: ${card.source}`);
	}

	if (card.reversible === true) {
		lines.push("reversible: true");
	}

	return lines.join("\n");
}

/**
 * Serialize a Deck to .fc format text.
 *
 * Output is deterministic: same input always produces the same string.
 * Trailing newline at end of file.
 */
export function serializeDeck(deck: Deck): string {
	const sections: string[] = [];

	const metaLines = serializeMeta(deck.meta);
	if (metaLines.length > 0) {
		sections.push(metaLines.join("\n"));
		sections.push(""); // empty line between metadata and cards
	}

	for (const card of deck.cards) {
		sections.push("---");
		sections.push(serializeCard(card));
	}

	if (deck.cards.length > 0) {
		sections.push("---");
	}

	return `${sections.join("\n")}\n`;
}

function serializeMeta(meta: Deck["meta"]): string[] {
	const lines: string[] = [];

	if (meta.name) {
		lines.push(`@deck ${meta.name}`);
	}

	if (meta.tags.length > 0) {
		lines.push(`@tags ${meta.tags.join(", ")}`);
	}

	if (meta.created) {
		lines.push(`@created ${meta.created}`);
	}

	if (meta.template) {
		lines.push(`@template ${meta.template}`);
	}

	return lines;
}

function serializeMultiline(prefix: string, text: string): string {
	const lines = text.split("\n");
	const first = `${prefix} ${lines[0]}`;
	if (lines.length === 1) {
		return first;
	}
	const rest = lines.slice(1).map((line) => `   ${line}`);
	return [first, ...rest].join("\n");
}
