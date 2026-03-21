import { z } from "zod";
import { defineAgent } from "../ai/agent.ts";

export interface GraderInput {
	question: string;
	correctAnswer: string;
	userAnswer: string;
}

export const graderOutputSchema = z.object({
	verdict: z.enum(["correct", "partial", "incorrect"]),
	feedback: z.string(),
	suggestedRating: z.enum(["again", "hard", "good", "easy"]),
});

export type GraderOutput = z.infer<typeof graderOutputSchema>;

export function buildGraderMessage(input: GraderInput): string {
	return [
		`Question: ${input.question}`,
		`Correct answer: ${input.correctAnswer}`,
		`User's answer: ${input.userAnswer}`,
	].join("\n\n");
}

export const graderAgent = defineAgent<GraderInput, GraderOutput>({
	name: "grader",
	role: "Evaluates user answers against correct answers using semantic similarity",
	tier: "fast",
	temperature: 0.2,
	systemPrompt: [
		"You are a flashcard grading assistant. Compare the user's answer to the correct answer semantically, not literally.",
		"Equivalent meanings count as correct — for example, 'the value moves' matches 'ownership transfers'.",
		"Evaluate completeness: a partial answer that captures the key concept but misses details is 'partial'.",
		"Be encouraging but honest. If the answer is wrong, explain what was missed briefly.",
		"",
		"Verdict guidelines:",
		"- correct: The user's answer captures the essential meaning, even if worded differently.",
		"- partial: The answer shows understanding but is incomplete or misses important details.",
		"- incorrect: The answer is wrong, off-topic, or empty.",
		"",
		"Rating guidelines:",
		"- again: Incorrect or blank answer — needs full re-review.",
		"- hard: Partial answer with significant gaps.",
		"- good: Correct or mostly correct with minor gaps.",
		"- easy: Correct, complete, and confidently stated.",
	].join("\n"),
	outputSchema: graderOutputSchema,
	buildUserMessage: buildGraderMessage,
});
