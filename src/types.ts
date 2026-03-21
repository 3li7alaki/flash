import { createHash } from "node:crypto";

// --- Card types ---

export type CardType = "qa" | "cloze" | "code-output" | "mcq" | "true-false";

export interface Card {
	id: string;
	question: string;
	answer: string;
	type: CardType;
	tags: string[];
	hint?: string;
	difficulty?: number;
	source?: string;
	reversible?: boolean;
	choices?: string[];
}

// --- Deck types ---

export interface DeckMeta {
	name: string;
	tags: string[];
	created?: string;
	template?: string;
}

export interface Deck {
	meta: DeckMeta;
	cards: Card[];
	filePath?: string;
}

// --- FSRS review state ---

export type Rating = "again" | "hard" | "good" | "easy";

export interface CardState {
	stability: number;
	difficulty: number;
	due: string;
	reps: number;
	lapses: number;
	lastReview: string;
	lastRating: Rating;
}

export interface DeckState {
	deck: string;
	cards: Record<string, CardState>;
}

// --- Config ---

export interface FcConfig {
	ai: {
		enabled: boolean;
		provider: string;
		apiKey: string;
		model: string;
	};
	scheduler: {
		algorithm: string;
	};
	review: {
		aiGrading: boolean;
		showHints: boolean;
		cardsPerSession: number;
	};
	decksDir: string;
	editor: string;
	version?: number;
	followed?: Array<{ url: string; name: string; lastSync: string }>;
}

// --- Linter ---

export type LintSeverity = "error" | "warning";

export interface LintError {
	line: number;
	message: string;
	severity: LintSeverity;
}

// --- Helpers ---

/**
 * Generate a deterministic card ID from a question string.
 * Normalizes: trim, collapse whitespace, lowercase, then SHA-256 hash (first 12 hex chars).
 */
export function generateCardId(question: string): string {
	const normalized = question.trim().replace(/\s+/g, " ").toLowerCase();
	const hash = createHash("sha256").update(normalized).digest("hex");
	return hash.slice(0, 12);
}
