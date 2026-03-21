import type { LintError } from "../types.ts";
import { generateCardId } from "../types.ts";

const KNOWN_FIELDS = [
	"Q:",
	"A:",
	"tags:",
	"type:",
	"hint:",
	"difficulty:",
	"source:",
	"reversible:",
	"choices:",
];

const VALID_TYPES = ["code-output", "mcq", "true-false"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
	if (!DATE_RE.test(value)) return false;
	const [y, m, d] = value.split("-").map(Number) as [number, number, number];
	const date = new Date(y, m - 1, d);
	return (
		date.getFullYear() === y &&
		date.getMonth() === m - 1 &&
		date.getDate() === d
	);
}

function isSeparator(line: string): boolean {
	return line.trim() === "---";
}

function matchField(line: string): [string, string] | null {
	for (const kw of KNOWN_FIELDS) {
		if (line.startsWith(kw)) {
			return [kw.slice(0, -1), line.slice(kw.length).trimStart()];
		}
	}
	return null;
}

function looksLikeField(line: string): string | null {
	const match = line.match(/^([a-zA-Z_-]+):\s/);
	if (match?.[1]) return match[1];
	// Also match "word:" at end of line
	const matchEnd = line.match(/^([a-zA-Z_-]+):$/);
	if (matchEnd?.[1]) return matchEnd[1];
	return null;
}

interface CardBlock {
	lines: string[];
	startLine: number; // 1-based line number of first line in block
}

/**
 * Lint a .fc file and return all errors and warnings with line numbers.
 */
export function lintDeck(text: string): LintError[] {
	const errors: LintError[] = [];

	if (!text.trim()) {
		errors.push({
			line: 1,
			message: "Deck is empty (no cards)",
			severity: "warning",
		});
		return errors;
	}

	const lines = text.split("\n");
	let i = 0;

	// Lint metadata lines (before first ---)
	while (i < lines.length) {
		const line = lines[i] ?? "";

		if (isSeparator(line)) break;

		if (line.startsWith("@created ")) {
			const value = line.slice("@created ".length).trim();
			if (!isValidDate(value)) {
				errors.push({
					line: i + 1,
					message: `@created is not a valid date (expected YYYY-MM-DD): "${value}"`,
					severity: "error",
				});
			}
		}

		i++;
	}

	// Collect card blocks
	const cardBlocks: CardBlock[] = [];
	let currentBlock: string[] = [];
	let blockStart = -1;

	while (i < lines.length) {
		const line = lines[i] ?? "";

		if (isSeparator(line)) {
			if (currentBlock.length > 0) {
				cardBlocks.push({ lines: currentBlock, startLine: blockStart });
				currentBlock = [];
				blockStart = -1;
			}
		} else {
			if (currentBlock.length === 0) {
				blockStart = i + 1; // 1-based
			}
			currentBlock.push(line);
		}

		i++;
	}

	// Handle trailing block without final ---
	if (currentBlock.length > 0) {
		cardBlocks.push({ lines: currentBlock, startLine: blockStart });
	}

	// Empty deck warning
	if (cardBlocks.length === 0) {
		errors.push({
			line: 1,
			message: "Deck is empty (no cards)",
			severity: "warning",
		});
		return errors;
	}

	// Track seen card IDs for duplicate detection
	const seenIds = new Map<string, number>(); // id -> first occurrence line

	for (const block of cardBlocks) {
		lintCardBlock(block, errors, seenIds);
	}

	return errors;
}

function lintCardBlock(
	block: CardBlock,
	errors: LintError[],
	seenIds: Map<string, number>,
): void {
	const { lines, startLine } = block;

	// Parse fields from the block, tracking line numbers
	let hasQ = false;
	let hasA = false;
	let hasTags = false;
	let questionText = "";
	let qLine = startLine;
	let isCloze = false;
	let hasExplicitTypeCloze = false;
	let currentField: string | null = null;
	const questionParts: string[] = [];

	for (let j = 0; j < lines.length; j++) {
		const line = lines[j] ?? "";
		const lineNum = startLine + j;
		const field = matchField(line);

		if (field) {
			const [key, value] = field;
			currentField = key;

			switch (key) {
				case "Q": {
					hasQ = true;
					qLine = lineNum;
					if (value) questionParts.push(value);
					break;
				}
				case "A": {
					hasA = true;
					break;
				}
				case "tags": {
					if (value.trim()) hasTags = true;
					break;
				}
				case "type": {
					const typeVal = value.trim();
					if (typeVal === "cloze") {
						hasExplicitTypeCloze = true;
					} else if (!VALID_TYPES.includes(typeVal)) {
						errors.push({
							line: lineNum,
							message: `Invalid type: "${typeVal}" (valid values: ${VALID_TYPES.join(", ")})`,
							severity: "error",
						});
					}
					break;
				}
				case "difficulty": {
					const raw = value.trim();
					const num = Number(raw);
					if (
						!raw ||
						Number.isNaN(num) ||
						!Number.isInteger(num) ||
						num < 1 ||
						num > 5
					) {
						errors.push({
							line: lineNum,
							message: `difficulty must be a number between 1-5, got: "${raw}"`,
							severity: "error",
						});
					}
					break;
				}
				case "reversible": {
					const val = value.trim();
					if (val !== "true" && val !== "false") {
						errors.push({
							line: lineNum,
							message: `reversible should be "true" or "false", got: "${val}"`,
							severity: "warning",
						});
					}
					break;
				}
			}
			continue;
		}

		// Check for continuation lines (indented) under Q/A
		const isIndented = line.startsWith(" ") || line.startsWith("\t");
		const isBlank = line.trim() === "";

		if (currentField === "Q" && (isIndented || isBlank)) {
			if (!isBlank) questionParts.push(line.trimStart());
			continue;
		}

		if (currentField === "A" && (isIndented || isBlank)) {
			continue;
		}

		// Non-continuation, non-field line: check if it looks like an unknown field
		if (!isBlank && !isIndented) {
			const unknownField = looksLikeField(line);
			if (unknownField) {
				const kwWithColon = `${unknownField}:`;
				const isKnown = KNOWN_FIELDS.includes(kwWithColon);
				if (!isKnown) {
					errors.push({
						line: lineNum,
						message: `Unknown field "${unknownField}:"`,
						severity: "warning",
					});
				}
			}
			currentField = null;
		}
	}

	questionText = questionParts.join("\n");

	// Error: no Q: field
	if (!hasQ) {
		errors.push({
			line: startLine,
			message: "Card has no Q: field",
			severity: "error",
		});
		return; // Can't lint further without a question
	}

	// Detect cloze
	isCloze = /\{\{.+?\}\}/.test(questionText);

	// Error: empty cloze {{}}
	if (/\{\{\}\}/.test(questionText)) {
		errors.push({
			line: qLine,
			message: "Cloze card has empty {{}} (no text inside braces)",
			severity: "error",
		});
	}

	// Warning: explicit type: cloze on a cloze card is unnecessary
	if (isCloze && hasExplicitTypeCloze) {
		errors.push({
			line: qLine,
			message: 'Cloze is auto-detected; explicit "type: cloze" is unnecessary',
			severity: "warning",
		});
	}

	// Error: explicit type: cloze on a non-cloze card is invalid
	if (!isCloze && hasExplicitTypeCloze) {
		errors.push({
			line: qLine,
			message: `Invalid type: "cloze" (cloze is auto-detected, not a valid explicit type value)`,
			severity: "error",
		});
	}

	// Warning: no A: and not cloze
	if (!hasA && !isCloze) {
		errors.push({
			line: qLine,
			message: "Card has Q: but no A: and is not a cloze card",
			severity: "warning",
		});
	}

	// Warning: no tags
	if (!hasTags) {
		errors.push({
			line: startLine,
			message: "Card has no tags",
			severity: "warning",
		});
	}

	// Duplicate card ID check
	const id = generateCardId(questionText);
	const existingLine = seenIds.get(id);
	if (existingLine !== undefined) {
		errors.push({
			line: qLine,
			message: `Duplicate card ID (same question as line ${existingLine})`,
			severity: "error",
		});
	} else {
		seenIds.set(id, qLine);
	}
}
