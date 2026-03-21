import type { Card } from "../types.ts";

/**
 * A Card annotated with the deck it originated from,
 * used during interleaved cross-deck review.
 */
export type TaggedCard = Card & { deckName: string };

/**
 * Filter cards that have the specified tag (case-insensitive).
 * Matches both card-level and deck-wide tags (since deck-wide tags
 * are merged onto cards during loading).
 */
export function filterByTag(cards: Card[], tag: string): Card[] {
	const lower = tag.toLowerCase();
	return cards.filter((card) =>
		card.tags.some((t) => t.toLowerCase() === lower),
	);
}

/**
 * Filter cards matching ANY of the given tags (OR logic, case-insensitive).
 * A card appears at most once even if it matches multiple tags.
 */
export function filterByTags(cards: Card[], tags: string[]): Card[] {
	const lowerTags = tags.map((t) => t.toLowerCase());
	return cards.filter((card) =>
		card.tags.some((t) => lowerTags.includes(t.toLowerCase())),
	);
}

/**
 * Interleave cards from multiple decks using round-robin.
 * This avoids reviewing many cards from one deck in a row,
 * which is proven to improve retention (interleaving effect).
 *
 * Empty decks are skipped. Each output card carries a `deckName`
 * property indicating its origin.
 */
export function interleaveDecks(
	decks: Array<{ cards: Card[]; deckName: string }>,
): TaggedCard[] {
	const nonEmpty = decks.filter((d) => d.cards.length > 0);
	if (nonEmpty.length === 0) return [];

	const result: TaggedCard[] = [];
	const maxLen = Math.max(...nonEmpty.map((d) => d.cards.length));

	for (let i = 0; i < maxLen; i++) {
		for (const deck of nonEmpty) {
			const card = deck.cards[i];
			if (card) {
				result.push({ ...card, deckName: deck.deckName });
			}
		}
	}

	return result;
}
