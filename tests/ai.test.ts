import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineAgent } from "../src/ai/agent.ts";

describe("defineAgent", () => {
	test("creates agent with accessible definition", () => {
		const agent = defineAgent({
			name: "test-agent",
			role: "A test agent",
			systemPrompt: "You are a test agent.",
			buildUserMessage: (input: string) => `Process: ${input}`,
		});

		expect(agent.definition.name).toBe("test-agent");
		expect(agent.definition.role).toBe("A test agent");
		expect(agent.run).toBeFunction();
	});

	test("agent with Zod schema stores structured output definition", () => {
		const schema = z.object({
			score: z.number(),
			grade: z.string(),
		});

		const agent = defineAgent({
			name: "grader",
			role: "Grades answers",
			systemPrompt: "Grade the answer",
			buildUserMessage: (input: string) => input,
			outputSchema: schema,
			temperature: 0.3,
		});

		expect(agent.definition.outputSchema).toBe(schema);
		expect(agent.definition.temperature).toBe(0.3);
	});

	test("buildUserMessage transforms input correctly", () => {
		const agent = defineAgent({
			name: "test",
			role: "Test",
			systemPrompt: "System",
			buildUserMessage: (input: { topic: string; count: number }) =>
				`Generate ${input.count} cards about ${input.topic}`,
		});

		const message = agent.definition.buildUserMessage({
			topic: "Rust",
			count: 5,
		});
		expect(message).toBe("Generate 5 cards about Rust");
	});
});
