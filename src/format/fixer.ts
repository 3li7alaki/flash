import type { Card } from "../types.ts";
import { generateCardId } from "../types.ts";
import { parseDeck } from "./parser.ts";
import { serializeDeck } from "./serializer.ts";

interface FixResult {
	fixed: string;
	changes: string[];
}

/** Short label for a card, using first ~40 chars of the question. */
function cardLabel(question: string): string {
	const oneline = question.split("\n")[0] ?? "";
	return oneline.length > 40 ? `${oneline.slice(0, 40)}...` : oneline;
}

/**
 * Auto-fix common format issues in .fc file text.
 *
 * Strategy: parse → fix card objects → re-serialize.
 * Returns the fixed text and a list of human-readable change descriptions.
 */
export function fixDeck(text: string): FixResult {
	const changes: string[] = [];

	// Extract raw field values from text before parsing (parser lossy for some fields)
	const rawCardFields = extractRawCardFields(text);
	const deck = parseDeck(text);

	// Track original card count for empty-card removal messages
	const originalCards = [...deck.cards];

	const fixedCards: Card[] = [];

	for (let i = 0; i < originalCards.length; i++) {
		const card = { ...originalCards[i] } as Card;
		const raw = rawCardFields[i];
		const label = cardLabel(card.question);

		// --- Normalize whitespace in Q/A ---
		const fixedQ = normalizeWhitespace(card.question);
		const fixedA = normalizeWhitespace(card.answer);
		if (fixedQ !== card.question || fixedA !== card.answer) {
			changes.push(`Normalized whitespace on card '${label}'`);
			card.question = fixedQ;
			card.answer = fixedA;
			card.id = generateCardId(card.question);
		}

		// --- Normalize tags ---
		if (card.tags.length > 0) {
			const normalized = card.tags
				.map((t) => t.trim().toLowerCase())
				.filter(Boolean);
			const deduped = [...new Set(normalized)].sort();
			const originalJoined = card.tags.join(", ");
			const fixedJoined = deduped.join(", ");
			if (originalJoined !== fixedJoined) {
				changes.push(`Sorted tags on card '${label}'`);
				card.tags = deduped;
			}
		}

		// --- Remove unnecessary type: cloze ---
		if (
			card.type === "cloze" &&
			/\{\{.+?\}\}/.test(card.question) &&
			raw?.type === "cloze"
		) {
			changes.push(`Removed unnecessary type: cloze on card '${label}'`);
		}

		// --- Clamp difficulty ---
		// Use raw value since parser's parseInt truncates decimals
		if (raw?.difficulty !== undefined) {
			const rawVal = Number.parseFloat(raw.difficulty);
			if (!Number.isNaN(rawVal)) {
				let clamped = Math.round(rawVal);
				clamped = Math.max(1, Math.min(5, clamped));
				if (clamped !== rawVal) {
					changes.push(
						`Fixed difficulty ${raw.difficulty} → ${clamped} on card '${label}'`,
					);
				}
				card.difficulty = clamped;
			}
		}

		// --- Normalize reversible ---
		// Use raw value since parser only recognizes "true"/"false"
		if (raw?.reversible !== undefined) {
			const lower = raw.reversible.toLowerCase();
			const isTruthy = lower === "true" || lower === "yes";
			if (raw.reversible !== "true" && raw.reversible !== "false") {
				changes.push(
					`Normalized reversible '${raw.reversible}' → ${isTruthy} on card '${label}'`,
				);
			}
			card.reversible = isTruthy;
		}

		fixedCards.push(card);
	}

	// --- Remove empty cards ---
	// parseDeck already filters null cards, so we detect removals by comparing
	// the number of card blocks in the raw text vs parsed cards.
	const rawBlockCount = countRawCardBlocks(text);
	const removedCount = rawBlockCount - originalCards.length;
	if (removedCount > 0) {
		for (let i = 0; i < removedCount; i++) {
			changes.push(
				`Removed empty card at position ${findEmptyCardPosition(text, i + 1)}`,
			);
		}
	}

	deck.cards = fixedCards;
	const fixed = serializeDeck(deck);

	return { fixed, changes };
}

/** Collapse multiple spaces into one and trim trailing whitespace per line. */
function normalizeWhitespace(text: string): string {
	return text
		.split("\n")
		.map((line) => line.replace(/ {2,}/g, " ").trimEnd())
		.join("\n");
}

interface RawFields {
	type?: string;
	difficulty?: string;
	reversible?: string;
}

/**
 * Extract raw field values from card blocks before parsing.
 * The parser is lossy for some fields (parseInt truncates decimals, reversible
 * only recognizes "true"/"false"), so we grab raw strings here.
 * Returns an array parallel to parsed cards (skips empty blocks without Q:).
 */
function extractRawCardFields(text: string): RawFields[] {
	const lines = text.split("\n");
	const blocks: string[][] = [];
	let currentBlock: string[] = [];
	let pastMeta = false;

	for (const line of lines) {
		if (line.trim() === "---") {
			pastMeta = true;
			if (currentBlock.length > 0) {
				blocks.push(currentBlock);
				currentBlock = [];
			}
		} else if (pastMeta) {
			currentBlock.push(line);
		}
	}
	if (currentBlock.length > 0) {
		blocks.push(currentBlock);
	}

	const results: RawFields[] = [];
	for (const block of blocks) {
		const hasQ = block.some((l) => l.startsWith("Q:"));
		if (!hasQ) continue;

		const fields: RawFields = {};
		for (const line of block) {
			const typeMatch = line.match(/^type:\s*(.+?)\s*$/);
			if (typeMatch) fields.type = typeMatch[1];

			const diffMatch = line.match(/^difficulty:\s*(.+?)\s*$/);
			if (diffMatch) fields.difficulty = diffMatch[1];

			const revMatch = line.match(/^reversible:\s*(.+?)\s*$/);
			if (revMatch) fields.reversible = revMatch[1];
		}
		results.push(fields);
	}

	return results;
}

/** Count the number of card blocks (sections between --- separators). */
function countRawCardBlocks(text: string): number {
	const lines = text.split("\n");
	let blocks = 0;
	let inBlock = false;

	for (const line of lines) {
		if (line.trim() === "---") {
			if (inBlock) {
				blocks++;
				inBlock = false;
			}
		} else if (line.startsWith("@") || line.trim() === "") {
			// metadata or blank — don't start a block
			if (inBlock) {
				// still in block, blank lines are part of it
			}
		} else {
			inBlock = true;
		}
	}

	// Trailing block without closing ---
	if (inBlock) {
		blocks++;
	}

	return blocks;
}

/** Find the position (1-indexed) of the Nth empty card block in the raw text. */
function findEmptyCardPosition(text: string, nth: number): number {
	const lines = text.split("\n");
	let blockIndex = 0;
	let emptyCount = 0;
	let inBlock = false;
	let blockHasQ = false;

	for (const line of lines) {
		if (line.trim() === "---") {
			if (inBlock) {
				blockIndex++;
				if (!blockHasQ) {
					emptyCount++;
					if (emptyCount === nth) {
						return blockIndex;
					}
				}
				inBlock = false;
				blockHasQ = false;
			}
		} else if (!line.startsWith("@") || inBlock) {
			if (line.trim() !== "") {
				inBlock = true;
			}
			if (line.startsWith("Q:")) {
				blockHasQ = true;
			}
		}
	}

	// Trailing block
	if (inBlock) {
		blockIndex++;
		if (!blockHasQ) {
			emptyCount++;
			if (emptyCount === nth) {
				return blockIndex;
			}
		}
	}

	return blockIndex;
}
