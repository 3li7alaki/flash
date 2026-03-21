import { rateCard } from "../scheduler/scheduler.ts";
import type { Card, DeckState, Rating } from "../types.ts";

export interface ReviewSession {
	cards: Card[];
	currentIndex: number;
	ratings: Rating[];
	state: DeckState;
	maxCards: number;
}

export interface SessionSummary {
	reviewed: number;
	again: number;
	hard: number;
	good: number;
	easy: number;
}

/** Start a new review session with the given due cards and state. */
export function startSession(
	cards: Card[],
	state: DeckState,
	options?: { maxCards?: number },
): ReviewSession {
	const maxCards =
		options?.maxCards && options.maxCards > 0
			? Math.min(options.maxCards, cards.length)
			: cards.length;

	return {
		cards: cards.slice(0, maxCards),
		currentIndex: 0,
		ratings: [],
		state,
		maxCards,
	};
}

/** Get the next card to review, or null if session is complete. */
export function getNextCard(session: ReviewSession): Card | null {
	if (session.currentIndex >= session.cards.length) {
		return null;
	}
	return session.cards[session.currentIndex] ?? null;
}

/** Submit a rating for the current card. Returns the updated session. */
export function submitRating(
	session: ReviewSession,
	cardId: string,
	rating: Rating,
): ReviewSession {
	const newState = rateCard(cardId, rating, session.state);

	return {
		...session,
		currentIndex: session.currentIndex + 1,
		ratings: [...session.ratings, rating],
		state: newState,
	};
}

/** Get a summary of the completed session. */
export function getSessionSummary(session: ReviewSession): SessionSummary {
	let again = 0;
	let hard = 0;
	let good = 0;
	let easy = 0;

	for (const rating of session.ratings) {
		switch (rating) {
			case "again":
				again++;
				break;
			case "hard":
				hard++;
				break;
			case "good":
				good++;
				break;
			case "easy":
				easy++;
				break;
		}
	}

	return {
		reviewed: session.ratings.length,
		again,
		hard,
		good,
		easy,
	};
}
