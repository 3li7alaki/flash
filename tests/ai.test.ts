import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineAgent } from "../src/ai/agent.ts";
import {
	type ChatMessage,
	createClient,
	OpenRouterClient,
} from "../src/ai/client.ts";

describe("OpenRouterClient", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("constructor sets defaults", () => {
		const client = new OpenRouterClient({
			apiKey: "test-key",
			model: "anthropic/claude-sonnet-4",
		});
		expect(client).toBeDefined();
	});

	test("chat sends correct request and returns response text", async () => {
		globalThis.fetch = mock(async (url: string, init: RequestInit) => {
			expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
			const body = JSON.parse(init.body as string);
			expect(body.model).toBe("test-model");
			expect(body.messages).toHaveLength(1);
			expect(body.messages[0].role).toBe("user");
			expect(body.messages[0].content).toBe("Hello");
			expect((init.headers as Record<string, string>).Authorization).toBe(
				"Bearer test-key",
			);
			expect((init.headers as Record<string, string>)["HTTP-Referer"]).toBe(
				"https://github.com/3li7alaki/fc",
			);

			return new Response(
				JSON.stringify({
					choices: [{ message: { content: "Hi there!" } }],
				}),
			);
		}) as unknown as typeof fetch;

		const client = new OpenRouterClient({
			apiKey: "test-key",
			model: "test-model",
		});
		const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
		const result = await client.chat(messages);
		expect(result).toBe("Hi there!");
	});

	test("chat passes temperature and maxTokens", async () => {
		globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			expect(body.temperature).toBe(0.5);
			expect(body.max_tokens).toBe(100);

			return new Response(
				JSON.stringify({
					choices: [{ message: { content: "response" } }],
				}),
			);
		}) as unknown as typeof fetch;

		const client = new OpenRouterClient({
			apiKey: "test-key",
			model: "test-model",
		});
		await client.chat([{ role: "user", content: "test" }], {
			temperature: 0.5,
			maxTokens: 100,
		});
	});

	test("chat uses custom baseUrl", async () => {
		globalThis.fetch = mock(async (url: string) => {
			expect(url).toBe("https://custom.api/v1/chat/completions");
			return new Response(
				JSON.stringify({
					choices: [{ message: { content: "ok" } }],
				}),
			);
		}) as unknown as typeof fetch;

		const client = new OpenRouterClient({
			apiKey: "test-key",
			model: "test-model",
			baseUrl: "https://custom.api/v1",
		});
		await client.chat([{ role: "user", content: "test" }]);
	});

	test("chat throws on HTTP error", async () => {
		globalThis.fetch = mock(async () => {
			return new Response(
				JSON.stringify({ error: { message: "Invalid API key" } }),
				{ status: 401 },
			);
		}) as unknown as typeof fetch;

		const client = new OpenRouterClient({
			apiKey: "bad-key",
			model: "test-model",
		});
		await expect(
			client.chat([{ role: "user", content: "test" }]),
		).rejects.toThrow("OpenRouter API error (401)");
	});

	test("chat throws on empty choices", async () => {
		globalThis.fetch = mock(async () => {
			return new Response(JSON.stringify({ choices: [] }));
		}) as unknown as typeof fetch;

		const client = new OpenRouterClient({
			apiKey: "test-key",
			model: "test-model",
		});
		await expect(
			client.chat([{ role: "user", content: "test" }]),
		).rejects.toThrow("No response from OpenRouter");
	});
});

describe("createClient", () => {
	let tempDir: string;
	const originalKey = process.env.FC_API_KEY;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "fc-ai-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
		if (originalKey === undefined) {
			delete process.env.FC_API_KEY;
		} else {
			process.env.FC_API_KEY = originalKey;
		}
	});

	test("throws when no API key is configured", async () => {
		delete process.env.FC_API_KEY;
		const configPath = join(tempDir, "config.json");
		await writeFile(
			configPath,
			JSON.stringify({ ai: { apiKey: "", model: "test" } }),
		);

		await expect(createClient(configPath)).rejects.toThrow("No API key");
	});

	test("creates client with config API key", async () => {
		delete process.env.FC_API_KEY;
		const configPath = join(tempDir, "config.json");
		await writeFile(
			configPath,
			JSON.stringify({
				ai: {
					apiKey: "my-key",
					model: "anthropic/claude-sonnet-4",
					provider: "openrouter",
				},
			}),
		);

		const client = await createClient(configPath);
		expect(client).toBeInstanceOf(OpenRouterClient);
	});

	test("creates client with env var API key", async () => {
		process.env.FC_API_KEY = "env-key";
		const configPath = join(tempDir, "config.json");
		await writeFile(
			configPath,
			JSON.stringify({ ai: { apiKey: "", model: "test" } }),
		);

		const client = await createClient(configPath);
		expect(client).toBeInstanceOf(OpenRouterClient);
	});
});

describe("defineAgent", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("creates an agent with accessible definition", () => {
		const agent = defineAgent({
			name: "test-agent",
			role: "A test agent",
			systemPrompt: "You are a test agent.",
			buildUserMessage: (input: string) => `Process: ${input}`,
			parseResponse: (response: string) => response.toUpperCase(),
		});

		expect(agent.definition.name).toBe("test-agent");
		expect(agent.definition.role).toBe("A test agent");
	});

	test("run builds correct messages and calls client", async () => {
		let capturedMessages: ChatMessage[] = [];

		globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(init.body as string);
			capturedMessages = body.messages;
			return new Response(
				JSON.stringify({
					choices: [{ message: { content: "test response" } }],
				}),
			);
		}) as unknown as typeof fetch;

		const agent = defineAgent({
			name: "test-agent",
			role: "A test agent",
			systemPrompt: "You are a test agent.",
			buildUserMessage: (input: string) => `Process: ${input}`,
			parseResponse: (response: string) => response.toUpperCase(),
			temperature: 0.3,
			maxTokens: 500,
		});

		const client = new OpenRouterClient({
			apiKey: "test-key",
			model: "test-model",
		});
		const result = await agent.run(client, "hello");

		expect(capturedMessages).toHaveLength(2);
		expect(capturedMessages[0]?.role).toBe("system");
		expect(capturedMessages[0]?.content).toBe("You are a test agent.");
		expect(capturedMessages[1]?.role).toBe("user");
		expect(capturedMessages[1]?.content).toBe("Process: hello");
		expect(result).toBe("TEST RESPONSE");
	});

	test("run uses agent temperature and maxTokens", async () => {
		let capturedBody: Record<string, unknown> = {};

		globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
			capturedBody = JSON.parse(init.body as string);
			return new Response(
				JSON.stringify({
					choices: [{ message: { content: "ok" } }],
				}),
			);
		}) as unknown as typeof fetch;

		const agent = defineAgent({
			name: "test-agent",
			role: "A test agent",
			systemPrompt: "System prompt",
			buildUserMessage: (input: string) => input,
			parseResponse: (response: string) => response,
			temperature: 0.7,
			maxTokens: 1000,
		});

		const client = new OpenRouterClient({
			apiKey: "test-key",
			model: "test-model",
		});
		await agent.run(client, "test");

		expect(capturedBody.temperature).toBe(0.7);
		expect(capturedBody.max_tokens).toBe(1000);
	});

	test("parseResponse transforms the raw response", async () => {
		globalThis.fetch = mock(async () => {
			return new Response(
				JSON.stringify({
					choices: [
						{
							message: {
								content: JSON.stringify({ score: 95, grade: "A" }),
							},
						},
					],
				}),
			);
		}) as unknown as typeof fetch;

		const agent = defineAgent<string, { score: number; grade: string }>({
			name: "parser-agent",
			role: "Parses JSON responses",
			systemPrompt: "Return JSON",
			buildUserMessage: (input: string) => input,
			parseResponse: (response: string) => JSON.parse(response),
		});

		const client = new OpenRouterClient({
			apiKey: "test-key",
			model: "test-model",
		});
		const result = await agent.run(client, "grade me");

		expect(result.score).toBe(95);
		expect(result.grade).toBe("A");
	});
});
