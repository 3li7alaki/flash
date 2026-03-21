import { describe, expect, test } from "bun:test";
import {
	buildGraderMessage,
	graderAgent,
	graderOutputSchema,
} from "../src/agents/grader.ts";

describe("graderAgent", () => {
	test("has tier set to fast", () => {
		expect(graderAgent.definition.tier).toBe("fast");
	});

	test("has temperature 0.2 for consistent grading", () => {
		expect(graderAgent.definition.temperature).toBe(0.2);
	});

	test("has an output schema defined", () => {
		expect(graderAgent.definition.outputSchema).toBeDefined();
	});
});

describe("buildGraderMessage", () => {
	test("includes question, correct answer, and user answer", () => {
		const message = buildGraderMessage({
			question: "What is ownership in Rust?",
			correctAnswer: "Each value has exactly one owner",
			userAnswer: "Values have a single owner",
		});

		expect(message).toContain("What is ownership in Rust?");
		expect(message).toContain("Each value has exactly one owner");
		expect(message).toContain("Values have a single owner");
	});

	test("labels each section clearly", () => {
		const message = buildGraderMessage({
			question: "Q",
			correctAnswer: "A",
			userAnswer: "U",
		});

		expect(message).toContain("Question:");
		expect(message).toContain("Correct answer:");
		expect(message).toContain("User's answer:");
	});
});

describe("graderOutputSchema", () => {
	test("accepts a valid correct response", () => {
		const result = graderOutputSchema.safeParse({
			verdict: "correct",
			feedback: "Great job!",
			suggestedRating: "good",
		});
		expect(result.success).toBe(true);
	});

	test("accepts a valid partial response", () => {
		const result = graderOutputSchema.safeParse({
			verdict: "partial",
			feedback: "You got the main idea but missed details.",
			suggestedRating: "hard",
		});
		expect(result.success).toBe(true);
	});

	test("accepts a valid incorrect response", () => {
		const result = graderOutputSchema.safeParse({
			verdict: "incorrect",
			feedback: "Not quite.",
			suggestedRating: "again",
		});
		expect(result.success).toBe(true);
	});

	test("rejects invalid verdict values", () => {
		const result = graderOutputSchema.safeParse({
			verdict: "maybe",
			feedback: "Hmm",
			suggestedRating: "good",
		});
		expect(result.success).toBe(false);
	});

	test("rejects invalid rating values", () => {
		const result = graderOutputSchema.safeParse({
			verdict: "correct",
			feedback: "Nice",
			suggestedRating: "medium",
		});
		expect(result.success).toBe(false);
	});

	test("rejects missing fields", () => {
		const result = graderOutputSchema.safeParse({
			verdict: "correct",
		});
		expect(result.success).toBe(false);
	});
});
