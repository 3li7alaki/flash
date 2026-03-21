import {
	createEmptyCard,
	FSRS,
	type Card as FSRSCard,
	Rating as FSRSRating,
	type Grade,
} from "ts-fsrs";
import type { Card, CardState, DeckState, Rating } from "../types.ts";

const RATING_MAP: Record<Rating, Grade> = {
	again: FSRSRating.Again,
	hard: FSRSRating.Hard,
	good: FSRSRating.Good,
	easy: FSRSRating.Easy,
};

/** Create a configured ts-fsrs instance with default FSRS-5 parameters. */
export function createScheduler(): FSRS {
	return new FSRS({});
}

/** Convert our CardState to a ts-fsrs Card. */
export function cardStateToFsrs(cardState: CardState): FSRSCard {
	const base = createEmptyCard(new Date(cardState.due));
	return {
		...base,
		due: new Date(cardState.due),
		stability: cardState.stability,
		difficulty: cardState.difficulty,
		reps: cardState.reps,
		lapses: cardState.lapses,
		last_review: new Date(cardState.lastReview),
	};
}

/** Convert a ts-fsrs Card result back to our CardState. */
export function fsrsToCardState(fsrsCard: FSRSCard, rating: Rating): CardState {
	return {
		stability: fsrsCard.stability,
		difficulty: fsrsCard.difficulty,
		due: fsrsCard.due.toISOString(),
		reps: fsrsCard.reps,
		lapses: fsrsCard.lapses,
		lastReview: (fsrsCard.last_review ?? new Date()).toISOString(),
		lastRating: rating,
	};
}

/** Return cards that are due for review. New cards (no state) are always due. */
export function getDueCards(
	cards: Card[],
	state: DeckState,
	now?: Date,
): Card[] {
	const currentTime = now ?? new Date();
	const newCards: Card[] = [];
	const overdueCards: { card: Card; due: Date }[] = [];

	for (const card of cards) {
		const cardState = state.cards[card.id];
		if (!cardState) {
			newCards.push(card);
		} else {
			const dueDate = new Date(cardState.due);
			if (dueDate.getTime() <= currentTime.getTime()) {
				overdueCards.push({ card, due: dueDate });
			}
		}
	}

	overdueCards.sort((a, b) => a.due.getTime() - b.due.getTime());
	return [...newCards, ...overdueCards.map((o) => o.card)];
}

/** Apply a rating to a card and return an updated (new) DeckState. */
export function rateCard(
	cardId: string,
	rating: Rating,
	state: DeckState,
	now?: Date,
): DeckState {
	const currentTime = now ?? new Date();
	const scheduler = createScheduler();
	const existingState = state.cards[cardId];

	let fsrsCard: FSRSCard;
	if (existingState) {
		fsrsCard = cardStateToFsrs(existingState);
	} else {
		fsrsCard = createEmptyCard(currentTime);
	}

	const result = scheduler.repeat(fsrsCard, currentTime);
	const fsrsRating = RATING_MAP[rating];
	const scheduled = result[fsrsRating];

	if (!scheduled) {
		throw new Error(`No scheduling result for rating: ${rating}`);
	}

	const newCardState = fsrsToCardState(scheduled.card, rating);

	return {
		...state,
		cards: {
			...state.cards,
			[cardId]: newCardState,
		},
	};
}

/** Return the next review date for a card. */
export function getNextReview(cardState: CardState): Date {
	return new Date(cardState.due);
}

/** Compute deck statistics. */
export function getDeckStats(
	cards: Card[],
	state: DeckState,
	now?: Date,
): {
	total: number;
	due: number;
	new: number;
	learning: number;
	review: number;
	mastered: number;
} {
	const currentTime = now ?? new Date();
	let newCount = 0;
	let learningCount = 0;
	let reviewCount = 0;
	let masteredCount = 0;
	let dueCount = 0;

	for (const card of cards) {
		const cardState = state.cards[card.id];
		if (!cardState) {
			newCount++;
			dueCount++;
			continue;
		}

		const isDue = new Date(cardState.due).getTime() <= currentTime.getTime();
		if (isDue) {
			dueCount++;
		}

		if (cardState.stability > 30) {
			masteredCount++;
		} else if (cardState.reps < 3) {
			learningCount++;
		} else if (isDue) {
			reviewCount++;
		}
	}

	return {
		total: cards.length,
		due: dueCount,
		new: newCount,
		learning: learningCount,
		review: reviewCount,
		mastered: masteredCount,
	};
}
