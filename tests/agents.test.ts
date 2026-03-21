import { describe, expect, test } from "bun:test";
import type { AnalyzerInput } from "../src/agents/analyzer.ts";
import {
	analyzerAgent,
	analyzerOutputSchema,
	buildAnalyzerMessage,
} from "../src/agents/analyzer.ts";
import {
	buildChallengerMessage,
	challengerAgent,
} from "../src/agents/challenger.ts";
import {
	buildExplainerMessage,
	explainerAgent,
} from "../src/agents/explainer.ts";
import {
	buildSummarizerMessage,
	summarizerAgent,
} from "../src/agents/summarizer.ts";
import { buildTeacherMessage, teacherAgent } from "../src/agents/teacher.ts";
import type { Card, CardState } from "../src/types.ts";

const sampleCard: Card = {
	id: "abc123",
	question: "What is a closure?",
	answer: "A function that captures its environment.",
	type: "qa",
	tags: ["javascript", "functions"],
};

const sampleCardState: CardState = {
	stability: 5,
	difficulty: 0.3,
	due: "2026-03-25",
	reps: 10,
	lapses: 3,
	lastReview: "2026-03-21",
	lastRating: "again",
};

describe("Teacher Agent", () => {
	test("has correct tier", () => {
		expect(teacherAgent.definition.tier).toBe("balanced");
	});

	test("buildUserMessage includes topic", () => {
		const msg = buildTeacherMessage({
			topic: "closures",
			conversationHistory: "",
		});
		expect(msg).toContain("closures");
	});

	test("buildUserMessage includes conversation history when provided", () => {
		const msg = buildTeacherMessage({
			topic: "closures",
			conversationHistory:
				"Teacher: What is a closure?\nStudent: I don't know.",
		});
		expect(msg).toContain("closures");
		expect(msg).toContain("Teacher: What is a closure?");
		expect(msg).toContain("Student: I don't know.");
	});

	test("buildUserMessage omits history section when empty", () => {
		const msg = buildTeacherMessage({
			topic: "closures",
			conversationHistory: "",
		});
		expect(msg).not.toContain("Conversation so far");
	});
});

describe("Analyzer Agent", () => {
	test("has correct tier", () => {
		expect(analyzerAgent.definition.tier).toBe("fast");
	});

	test("has output schema", () => {
		expect(analyzerAgent.definition.outputSchema).toBeDefined();
	});

	test("output schema validates correct data", () => {
		const valid = {
			weakAreas: [{ topic: "closures", reason: "High lapse count" }],
			suggestedCards: [
				{
					question: "What captures variables in a closure?",
					answer: "The lexical environment at the time of creation.",
					tags: ["javascript"],
				},
			],
		};
		const result = analyzerOutputSchema.safeParse(valid);
		expect(result.success).toBe(true);
	});

	test("output schema rejects invalid data", () => {
		const invalid = {
			weakAreas: "not an array",
			suggestedCards: [],
		};
		const result = analyzerOutputSchema.safeParse(invalid);
		expect(result.success).toBe(false);
	});

	test("output schema rejects missing fields", () => {
		const result = analyzerOutputSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	test("buildUserMessage includes card details and state", () => {
		const input: AnalyzerInput = {
			weakCards: [{ card: sampleCard, state: sampleCardState }],
		};
		const msg = buildAnalyzerMessage(input);
		expect(msg).toContain("What is a closure?");
		expect(msg).toContain("Lapses: 3");
		expect(msg).toContain("Stability: 5");
		expect(msg).toContain("javascript, functions");
	});
});

describe("Explainer Agent", () => {
	test("has correct tier", () => {
		expect(explainerAgent.definition.tier).toBe("balanced");
	});

	test("buildUserMessage handles explain mode", () => {
		const msg = buildExplainerMessage({
			card: sampleCard,
			mode: "explain",
			failCount: 3,
		});
		expect(msg).toContain("Mode: explain");
		expect(msg).toContain("Times failed: 3");
		expect(msg).toContain("What is a closure?");
	});

	test("buildUserMessage handles rephrase mode", () => {
		const msg = buildExplainerMessage({
			card: sampleCard,
			mode: "rephrase",
			failCount: 1,
		});
		expect(msg).toContain("Mode: rephrase");
		expect(msg).toContain("Times failed: 1");
	});

	test("buildUserMessage includes hint when present", () => {
		const cardWithHint: Card = { ...sampleCard, hint: "Think about scope" };
		const msg = buildExplainerMessage({
			card: cardWithHint,
			mode: "explain",
			failCount: 0,
		});
		expect(msg).toContain("Hint: Think about scope");
	});

	test("buildUserMessage omits hint when absent", () => {
		const msg = buildExplainerMessage({
			card: sampleCard,
			mode: "explain",
			failCount: 0,
		});
		expect(msg).not.toContain("Hint:");
	});
});

describe("Challenger Agent", () => {
	test("has correct tier", () => {
		expect(challengerAgent.definition.tier).toBe("balanced");
	});

	test("buildUserMessage lists mastered cards", () => {
		const msg = buildChallengerMessage({ masteredCards: [sampleCard] });
		expect(msg).toContain("What is a closure?");
		expect(msg).toContain("A function that captures its environment.");
		expect(msg).toContain("javascript, functions");
	});

	test("buildUserMessage handles multiple cards", () => {
		const card2: Card = {
			id: "def456",
			question: "What is hoisting?",
			answer: "Variable declarations moved to top of scope.",
			type: "qa",
			tags: ["javascript"],
		};
		const msg = buildChallengerMessage({ masteredCards: [sampleCard, card2] });
		expect(msg).toContain("What is a closure?");
		expect(msg).toContain("What is hoisting?");
	});
});

describe("Summarizer Agent", () => {
	test("has correct tier", () => {
		expect(summarizerAgent.definition.tier).toBe("fast");
	});

	test("buildUserMessage includes deck name and cards", () => {
		const msg = buildSummarizerMessage({
			cards: [sampleCard],
			deckName: "JavaScript Basics",
		});
		expect(msg).toContain("Deck: JavaScript Basics");
		expect(msg).toContain("What is a closure?");
		expect(msg).toContain("javascript, functions");
	});

	test("buildUserMessage handles cards without tags", () => {
		const noTagCard: Card = { ...sampleCard, tags: [] };
		const msg = buildSummarizerMessage({
			cards: [noTagCard],
			deckName: "Test",
		});
		expect(msg).toContain("What is a closure?");
		expect(msg).not.toContain("Tags:");
	});
});
