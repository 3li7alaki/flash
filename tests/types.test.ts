import { describe, expect, test } from "bun:test";
import { generateCardId } from "../src/types.ts";

describe("generateCardId", () => {
	test("produces a stable hex string", () => {
		const id = generateCardId("What is a closure?");
		expect(typeof id).toBe("string");
		expect(id).toMatch(/^[0-9a-f]+$/);
		expect(id.length).toBeGreaterThan(0);
	});

	test("same question always produces same ID", () => {
		const a = generateCardId("What is a closure?");
		const b = generateCardId("What is a closure?");
		expect(a).toBe(b);
	});

	test("different questions produce different IDs", () => {
		const a = generateCardId("What is a closure?");
		const b = generateCardId("What is a monad?");
		expect(a).not.toBe(b);
	});

	test("normalizes leading and trailing whitespace", () => {
		const a = generateCardId("What is a closure?");
		const b = generateCardId("  What is a closure?  ");
		expect(a).toBe(b);
	});

	test("normalizes internal whitespace", () => {
		const a = generateCardId("What is a closure?");
		const b = generateCardId("What   is\t\ta   closure?");
		expect(a).toBe(b);
	});

	test("normalizes case", () => {
		const a = generateCardId("What is a closure?");
		const b = generateCardId("WHAT IS A CLOSURE?");
		expect(a).toBe(b);
	});

	test("handles multiline questions", () => {
		const a = generateCardId("What does this print?\n  console.log(1)");
		const b = generateCardId("what does this print?\n  console.log(1)");
		expect(a).toBe(b);
	});
});
