import { readFile, writeFile } from "node:fs/promises";
import * as prompts from "@clack/prompts";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { parseDeck } from "../format/parser.ts";
import { serializeDeck } from "../format/serializer.ts";
import type { Card, CardType } from "../types.ts";
import { generateCardId } from "../types.ts";
import { findDeck } from "./utils.ts";

export async function addCommand(
	args: string[],
	flags: Record<string, string | boolean>,
): Promise<void> {
	const deckNameOrPath = args[0];
	if (!deckNameOrPath) {
		console.error("Usage: flash add <deck>");
		console.error(
			"  Headless: flash add <deck> --question '...' --answer '...' [--tags '...'] [--hint '...'] [--type qa|code-output] [--reversible]",
		);
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);

	let deckPath: string;
	try {
		deckPath = findDeck(deckNameOrPath, decksDir);
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
		return;
	}

	// Headless mode: all required fields provided via flags
	const headless = typeof flags.question === "string";

	let questionStr: string;
	let answerStr: string;
	let rawTags: string;
	let hintStr: string;
	let cardType: CardType;
	let isReversible: boolean;

	if (headless) {
		questionStr = flags.question as string;
		answerStr = (flags.answer as string) ?? "";
		rawTags = ((flags.tags as string) ?? "").trim();
		hintStr = ((flags.hint as string) ?? "").trim();
		cardType = (flags.type as CardType) ?? "qa";
		isReversible = flags.reversible === true;

		if (!questionStr.trim()) {
			console.error("--question is required");
			process.exitCode = 1;
			return;
		}
		if (!answerStr.trim()) {
			console.error("--answer is required");
			process.exitCode = 1;
			return;
		}
	} else {
		const question = await prompts.text({
			message: "Question:",
			validate: (value) => {
				if (!value?.trim()) return "Question is required";
			},
		});
		if (prompts.isCancel(question)) {
			console.log("Cancelled.");
			return;
		}

		const answer = await prompts.text({
			message: "Answer:",
			validate: (value) => {
				if (!value?.trim()) return "Answer is required";
			},
		});
		if (prompts.isCancel(answer)) {
			console.log("Cancelled.");
			return;
		}

		const tagsInput = await prompts.text({
			message: "Tags (comma-separated, optional):",
			defaultValue: "",
		});
		if (prompts.isCancel(tagsInput)) {
			console.log("Cancelled.");
			return;
		}

		const hint = await prompts.text({
			message: "Hint (optional):",
			defaultValue: "",
		});
		if (prompts.isCancel(hint)) {
			console.log("Cancelled.");
			return;
		}

		const typeSelect = await prompts.select({
			message: "Card type:",
			options: [
				{ value: "qa", label: "Q/A" },
				{ value: "code-output", label: "Code Output" },
			],
		});
		if (prompts.isCancel(typeSelect)) {
			console.log("Cancelled.");
			return;
		}

		const reversible = await prompts.confirm({
			message: "Reversible?",
			initialValue: false,
		});
		if (prompts.isCancel(reversible)) {
			console.log("Cancelled.");
			return;
		}

		questionStr = question as string;
		answerStr = answer as string;
		rawTags = ((tagsInput as string) ?? "").trim();
		hintStr = ((hint as string) ?? "").trim();
		cardType = typeSelect as CardType;
		isReversible = reversible === true;
	}

	// Auto-detect cloze
	if (/\{\{.+?\}\}/.test(questionStr)) {
		cardType = "cloze";
	}

	const tags: string[] = [];
	if (rawTags) {
		for (const part of rawTags.split(",")) {
			const trimmed = part.trim();
			if (trimmed) {
				tags.push(trimmed);
			}
		}
	}

	const card: Card = {
		id: generateCardId(questionStr),
		question: questionStr,
		answer: answerStr,
		type: cardType,
		tags,
	};

	if (hintStr) {
		card.hint = hintStr;
	}

	if (isReversible) {
		card.reversible = true;
	}

	// Parse existing deck, add card, serialize back
	const existingContent = await readFile(deckPath, "utf-8");
	const deck = parseDeck(existingContent);
	deck.cards.push(card);
	const serialized = serializeDeck(deck);
	await writeFile(deckPath, serialized, "utf-8");

	const deckName = deck.meta.name || deckNameOrPath;
	console.log(`Added card to ${deckName}`);
}
