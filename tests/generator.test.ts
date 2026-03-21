import { describe, expect, test } from "bun:test";
import {
	buildGeneratorMessage,
	detectContentSource,
	generatorAgent,
	parseGeneratorResponse,
	stripHtml,
} from "../src/agents/generator.ts";

describe("generatorAgent", () => {
	test("has balanced tier", () => {
		expect(generatorAgent.definition.tier).toBe("balanced");
	});

	test("has temperature 0.7", () => {
		expect(generatorAgent.definition.temperature).toBe(0.7);
	});

	test("has no output schema (text mode)", () => {
		expect(generatorAgent.definition.outputSchema).toBeUndefined();
	});
});

describe("buildGeneratorMessage", () => {
	test("includes content and content type", () => {
		const msg = buildGeneratorMessage({
			content: "Rust ownership",
			contentType: "topic",
		});
		expect(msg).toContain("Content type: topic");
		expect(msg).toContain("Rust ownership");
	});

	test("defaults card count to 10", () => {
		const msg = buildGeneratorMessage({
			content: "anything",
			contentType: "text",
		});
		expect(msg).toContain("Target card count: 10");
	});

	test("uses custom card count when provided", () => {
		const msg = buildGeneratorMessage({
			content: "anything",
			contentType: "file",
			cardCount: 5,
		});
		expect(msg).toContain("Target card count: 5");
	});
});

describe("parseGeneratorResponse", () => {
	test("parses raw .fc text", () => {
		const text = `@deck Test
---
Q: What is 1+1?
A: 2
tags: math
---`;
		const deck = parseGeneratorResponse(text);
		expect(deck.cards).toHaveLength(1);
		expect(deck.cards[0]?.question).toBe("What is 1+1?");
		expect(deck.meta.name).toBe("Test");
	});

	test("extracts .fc from markdown code fences", () => {
		const text = `Here are your flashcards:

\`\`\`fc
@deck Fenced
---
Q: What is closure?
A: A function capturing its environment.
---
\`\`\`

Enjoy!`;
		const deck = parseGeneratorResponse(text);
		expect(deck.cards).toHaveLength(1);
		expect(deck.meta.name).toBe("Fenced");
	});

	test("returns empty deck for unparseable response", () => {
		const deck = parseGeneratorResponse("Sorry, I cannot help.");
		expect(deck.cards).toHaveLength(0);
	});
});

describe("stripHtml", () => {
	test("removes HTML tags", () => {
		expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
	});

	test("decodes common entities", () => {
		expect(stripHtml("&amp; &lt; &gt; &quot; &#39; &nbsp;")).toBe("& < > \" '");
	});

	test("removes script and style blocks", () => {
		const html = '<script>alert("x")</script><style>.a{}</style><p>Content</p>';
		expect(stripHtml(html)).toBe("Content");
	});

	test("collapses whitespace", () => {
		expect(stripHtml("<p>  lots   of   space  </p>")).toBe("lots of space");
	});

	test("handles empty string", () => {
		expect(stripHtml("")).toBe("");
	});
});

describe("detectContentSource", () => {
	test("detects URL from --from flag", () => {
		const result = detectContentSource([], "https://example.com");
		expect(result.type).toBe("url");
		expect(result.value).toBe("https://example.com");
	});

	test("detects http URL from --from flag", () => {
		const result = detectContentSource([], "http://example.com");
		expect(result.type).toBe("url");
	});

	test("detects file from --from flag", () => {
		const result = detectContentSource([], "notes.md");
		expect(result.type).toBe("file");
		expect(result.value).toBe("notes.md");
	});

	test("detects topic from positional args", () => {
		const result = detectContentSource(["Rust", "ownership"]);
		expect(result.type).toBe("topic");
		expect(result.value).toBe("Rust ownership");
	});
});
