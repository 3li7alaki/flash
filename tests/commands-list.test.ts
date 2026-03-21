import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listDecks } from "../src/commands/list.ts";
import { mergeDecks } from "../src/commands/merge.ts";
import { searchCards } from "../src/commands/search.ts";

const DECK_A = `@deck rust-ownership
@tags rust, memory

---
Q: What happens when you assign a variable to another?
A: Ownership moves to the new variable.
tags: ownership
---
Q: When does Rust automatically call drop()?
A: When a value goes out of scope.
tags: drop
---
`;

const DECK_B = `@deck javascript-async
@tags javascript, async

---
Q: What is a Promise?
A: An object representing eventual completion of an async operation.
tags: promises
---
`;

const DECK_C = `@deck merge-source
@tags rust, lifetimes

---
Q: What are lifetimes in Rust?
A: Annotations that tell the compiler how long references are valid.
tags: lifetimes
---
Q: What happens when you assign a variable to another?
A: Ownership moves to the new variable.
tags: ownership
---
`;

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "fc-cmd-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true });
});

describe("listDecks", () => {
	test("shows message when no decks found", async () => {
		const output = await listDecks(tempDir);
		expect(output).toContain("No decks found");
	});

	test("shows table with deck info", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);
		await writeFile(join(tempDir, "javascript-async.fc"), DECK_B);

		const output = await listDecks(tempDir);
		expect(output).toContain("rust-ownership");
		expect(output).toContain("javascript-async");
		expect(output).toContain("Deck");
		expect(output).toContain("Cards");
		expect(output).toContain("Due");
		expect(output).toContain("New");
	});
});

describe("searchCards", () => {
	test("finds matching cards", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);
		await writeFile(join(tempDir, "javascript-async.fc"), DECK_B);

		const output = await searchCards(tempDir, "variable");
		expect(output).toContain("rust-ownership");
		expect(output).toContain("variable");
	});

	test("search is case-insensitive", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);

		const output = await searchCards(tempDir, "RUST");
		expect(output).toContain("rust-ownership");
	});

	test("shows message when no matches", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);

		const output = await searchCards(tempDir, "quantum");
		expect(output).toContain("No cards matching");
		expect(output).toContain("quantum");
	});
});

describe("mergeDecks", () => {
	test("combines cards from two decks", async () => {
		const path1 = join(tempDir, "rust-ownership.fc");
		const path2 = join(tempDir, "merge-source.fc");
		await writeFile(path1, DECK_A);
		await writeFile(path2, DECK_C);

		const output = await mergeDecks(path1, path2, tempDir);
		expect(output).toContain("Merged");
		expect(output).toContain("merge-source");
		expect(output).toContain("rust-ownership");

		// Verify the merged file has the new card
		const merged = await Bun.file(path1).text();
		expect(merged).toContain("lifetimes");
	});

	test("skips duplicate cards", async () => {
		const path1 = join(tempDir, "rust-ownership.fc");
		const path2 = join(tempDir, "merge-source.fc");
		await writeFile(path1, DECK_A);
		await writeFile(path2, DECK_C);

		const output = await mergeDecks(path1, path2, tempDir);
		expect(output).toContain("duplicate");
	});

	test("combines tags", async () => {
		const path1 = join(tempDir, "rust-ownership.fc");
		const path2 = join(tempDir, "merge-source.fc");
		await writeFile(path1, DECK_A);
		await writeFile(path2, DECK_C);

		await mergeDecks(path1, path2, tempDir);

		const merged = await Bun.file(path1).text();
		expect(merged).toContain("lifetimes");
		expect(merged).toContain("rust");
		expect(merged).toContain("memory");
	});
});
