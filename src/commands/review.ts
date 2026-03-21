import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as prompts from "@clack/prompts";
import type { LanguageModel } from "ai";
import type { GraderOutput } from "../agents/grader.ts";
import { graderAgent } from "../agents/grader.ts";
import { createModelForTier } from "../ai/client.ts";
import { getApiKey, loadConfig, resolveDecksDir } from "../config/config.ts";
import { parseDeck } from "../format/parser.ts";
import {
	getNextCard,
	getSessionSummary,
	startSession,
	submitRating,
} from "../review/engine.ts";
import { getDueCards } from "../scheduler/scheduler.ts";
import { loadState, saveState } from "../state/state.ts";
import type { Card, Deck, DeckState, FcConfig, Rating } from "../types.ts";
import { findDeck } from "./utils.ts";

/** Try to create the AI model for grading. Returns null if unavailable. */
async function tryCreateGraderModel(
	config: FcConfig,
): Promise<LanguageModel | null> {
	if (!config.review.aiGrading) return null;

	const apiKey = getApiKey(config);
	if (!apiKey) return null;

	try {
		return await createModelForTier("fast");
	} catch {
		return null;
	}
}

/** Grade a user's answer using the AI grader agent. Returns null on failure. */
async function gradeAnswer(
	model: LanguageModel,
	question: string,
	correctAnswer: string,
	userAnswer: string,
): Promise<GraderOutput | null> {
	try {
		return await graderAgent.run(model, {
			question,
			correctAnswer,
			userAnswer,
		});
	} catch (err) {
		prompts.log.warn(
			`AI grading failed: ${(err as Error).message}. Falling back to self-grading.`,
		);
		return null;
	}
}

const VERDICT_LABELS: Record<string, string> = {
	correct: "Correct",
	partial: "Partial",
	incorrect: "Incorrect",
};

/** Format a cloze question for display: replace {{...}} with [...] */
function formatCloze(question: string): string {
	return question.replace(/\{\{(.+?)\}\}/g, "[...]");
}

/** Find the earliest due date across all cards in state. */
function getEarliestDue(state: DeckState): string | null {
	let earliest: Date | null = null;
	for (const cardState of Object.values(state.cards)) {
		const due = new Date(cardState.due);
		if (!earliest || due.getTime() < earliest.getTime()) {
			earliest = due;
		}
	}
	return earliest ? earliest.toLocaleDateString() : null;
}

/** Load all decks from the decks directory. */
async function loadAllDecks(
	decksDir: string,
): Promise<{ deck: Deck; path: string }[]> {
	let files: string[];
	try {
		files = readdirSync(decksDir).filter((f) => f.endsWith(".fc"));
	} catch {
		return [];
	}

	const results: { deck: Deck; path: string }[] = [];
	for (const file of files) {
		const deckPath = join(decksDir, file);
		const content = await readFile(deckPath, "utf-8");
		const deck = parseDeck(content);
		deck.filePath = deckPath;
		results.push({ deck, path: deckPath });
	}
	return results;
}

export async function reviewCommand(
	args: string[],
	flags: Record<string, string | boolean>,
): Promise<void> {
	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const tagFilter = typeof flags.tag === "string" ? flags.tag : undefined;

	let deckPath: string;
	let deck: Deck;

	const deckNameOrPath = args[0];
	if (deckNameOrPath) {
		try {
			deckPath = findDeck(deckNameOrPath, decksDir);
		} catch (err) {
			console.error((err as Error).message);
			process.exitCode = 1;
			return;
		}
		const content = await readFile(deckPath, "utf-8");
		deck = parseDeck(content);
		deck.filePath = deckPath;
	} else {
		// Load all decks, pick the one with the most due cards
		const allDecks = await loadAllDecks(decksDir);
		if (allDecks.length === 0) {
			console.log("No decks found.");
			return;
		}

		const deckDueCounts: { deck: Deck; path: string; dueCount: number }[] = [];
		for (const entry of allDecks) {
			const state = await loadState(entry.path);
			const due = getDueCards(entry.deck.cards, state);
			deckDueCounts.push({
				deck: entry.deck,
				path: entry.path,
				dueCount: due.length,
			});
		}

		// Sort by most due cards
		deckDueCounts.sort((a, b) => b.dueCount - a.dueCount);

		if (deckDueCounts.length === 1) {
			const single = deckDueCounts[0];
			if (!single) {
				console.log("No decks found.");
				return;
			}
			deck = single.deck;
			deckPath = single.path;
		} else {
			const options = deckDueCounts.map((d) => ({
				value: d.path,
				label: `${d.deck.meta.name || d.path} (${d.dueCount} due)`,
			}));

			const selected = await prompts.select({
				message: "Select a deck to review:",
				options,
			});

			if (prompts.isCancel(selected)) {
				console.log("Cancelled.");
				return;
			}

			const match = deckDueCounts.find((d) => d.path === selected);
			if (!match) {
				console.error("Deck not found.");
				process.exitCode = 1;
				return;
			}
			deck = match.deck;
			deckPath = match.path;
		}
	}

	const state = await loadState(deckPath);
	let cards: Card[] = deck.cards;

	// Apply tag filter
	if (tagFilter) {
		cards = cards.filter((c) => c.tags.includes(tagFilter));
	}

	const dueCards = getDueCards(cards, state);

	if (dueCards.length === 0) {
		console.log("No cards due for review!");
		return;
	}

	const maxCards =
		config.review.cardsPerSession > 0
			? config.review.cardsPerSession
			: undefined;

	// Try to set up AI grading
	const graderModel = await tryCreateGraderModel(config);
	const useAiGrading = graderModel !== null;

	let session = startSession(dueCards, state, { maxCards });
	const totalCards = session.cards.length;

	// Review loop
	let card = getNextCard(session);
	while (card) {
		const cardNum = session.currentIndex + 1;
		console.log(`\nCard ${cardNum}/${totalCards}`);

		// Display question
		let displayQuestion = card.question;
		if (card.type === "cloze") {
			displayQuestion = formatCloze(card.question);
		}

		prompts.note(displayQuestion, "Question");

		// Show hint if enabled and available
		if (config.review.showHints && card.hint) {
			console.log(`Hint: ${card.hint}`);
		}

		// Get the correct answer for display/grading
		let correctAnswer = card.answer;
		if (card.type === "cloze") {
			const match = card.question.match(/\{\{(.+?)\}\}/);
			if (match?.[1]) {
				correctAnswer = match[1];
			}
		}

		// Collect user answer
		const userAnswer = await prompts.text({
			message: useAiGrading
				? "Your answer:"
				: "Your answer (press Enter to reveal):",
			defaultValue: "",
		});

		if (prompts.isCancel(userAnswer)) {
			await saveState(deckPath, session.state);
			console.log("\nSession interrupted. Progress saved.");
			return;
		}

		// AI grading path
		let suggestedRating: Rating | null = null;

		if (useAiGrading && userAnswer && userAnswer.trim() !== "") {
			const result = await gradeAnswer(
				graderModel,
				card.question,
				correctAnswer,
				userAnswer,
			);

			if (result) {
				const verdictLabel = VERDICT_LABELS[result.verdict] ?? result.verdict;
				prompts.note(`${verdictLabel}: ${result.feedback}`, "AI Grading");
				suggestedRating = result.suggestedRating as Rating;
			}
		}

		// Reveal the answer
		prompts.note(correctAnswer, "Answer");

		// Rating selection — pre-select AI suggestion if available
		const ratingOptions = [
			{ value: "again", label: "Again (1) - Forgot completely" },
			{ value: "hard", label: "Hard (2) - Took a while to recall" },
			{ value: "good", label: "Good (3) - Recalled with some effort" },
			{ value: "easy", label: "Easy (4) - Knew it instantly" },
		];

		const ratingMessage = suggestedRating
			? `How did you do? (AI suggests: ${suggestedRating})`
			: "How did you do?";

		const rating = await prompts.select({
			message: ratingMessage,
			options: ratingOptions,
			initialValue: suggestedRating ?? undefined,
		});

		if (prompts.isCancel(rating)) {
			await saveState(deckPath, session.state);
			console.log("\nSession interrupted. Progress saved.");
			return;
		}

		session = submitRating(session, card.id, rating as Rating);
		card = getNextCard(session);
	}

	// Save final state
	await saveState(deckPath, session.state);

	// Show summary
	const summary = getSessionSummary(session);
	console.log("\n--- Session Complete ---");
	console.log(`Reviewed ${summary.reviewed} cards.`);
	console.log(
		`  Again: ${summary.again}  Hard: ${summary.hard}  Good: ${summary.good}  Easy: ${summary.easy}`,
	);

	const nextDue = getEarliestDue(session.state);
	if (nextDue) {
		console.log(`Next review: ${nextDue}`);
	}
}
