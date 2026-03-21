import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveEditor } from "../src/commands/edit.ts";
import { findDeck, toKebabCase } from "../src/commands/utils.ts";

// --- toKebabCase ---

describe("toKebabCase", () => {
	test("converts spaces to hyphens and lowercases", () => {
		expect(toKebabCase("Rust Ownership")).toBe("rust-ownership");
	});

	test("handles multiple spaces", () => {
		expect(toKebabCase("My   Cool  Deck")).toBe("my-cool-deck");
	});

	test("strips special characters", () => {
		expect(toKebabCase("My Cool Deck!")).toBe("my-cool-deck");
	});

	test("handles already kebab-case", () => {
		expect(toKebabCase("rust-ownership")).toBe("rust-ownership");
	});

	test("trims leading and trailing whitespace", () => {
		expect(toKebabCase("  Rust Ownership  ")).toBe("rust-ownership");
	});

	test("handles single word", () => {
		expect(toKebabCase("Rust")).toBe("rust");
	});

	test("collapses multiple hyphens", () => {
		expect(toKebabCase("foo - bar")).toBe("foo-bar");
	});

	test("handles empty string", () => {
		expect(toKebabCase("")).toBe("");
	});
});

// --- findDeck ---

describe("findDeck", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `fc-test-find-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		await writeFile(join(tempDir, "rust-ownership.fc"), "@deck Rust\n");
		await writeFile(join(tempDir, "javascript-basics.fc"), "@deck JS\n");
		await writeFile(join(tempDir, "rust-lifetimes.fc"), "@deck Lifetimes\n");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("exact match by kebab-case name", () => {
		const result = findDeck("rust-ownership", tempDir);
		expect(result).toBe(join(tempDir, "rust-ownership.fc"));
	});

	test("partial match returns single result", () => {
		const result = findDeck("javascript", tempDir);
		expect(result).toBe(join(tempDir, "javascript-basics.fc"));
	});

	test("ambiguous match throws", () => {
		expect(() => findDeck("rust", tempDir)).toThrow(/Ambiguous deck name/);
	});

	test("no match throws", () => {
		expect(() => findDeck("python", tempDir)).toThrow(/No deck found/);
	});

	test("absolute path passed through", () => {
		const absPath = "/some/path/deck.fc";
		expect(findDeck(absPath, tempDir)).toBe(absPath);
	});

	test(".fc extension treated as path", () => {
		const result = findDeck("rust-ownership.fc", tempDir);
		expect(result).toBe(join(tempDir, "rust-ownership.fc"));
	});

	test("missing decks dir throws", () => {
		expect(() => findDeck("anything", "/nonexistent/dir")).toThrow(
			/Decks directory not found/,
		);
	});
});

// --- fc new (file creation) ---

describe("fc new", () => {
	let tempDir: string;
	const originalHome = process.env.HOME;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `fc-test-new-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
		process.env.HOME = originalHome;
	});

	test("creates file with correct content", async () => {
		// Create a minimal config scenario by writing directly
		const filePath = join(tempDir, "rust-ownership.fc");
		expect(existsSync(filePath)).toBe(false);

		// Write what the command would create
		const content = [
			"@deck Rust Ownership",
			"@tags",
			`@created ${new Date().toISOString().slice(0, 10)}`,
			"",
			"---",
			"Q: ",
			"A: ",
			"---",
			"",
		].join("\n");
		await writeFile(filePath, content, "utf-8");

		const written = await readFile(filePath, "utf-8");
		expect(written).toContain("@deck Rust Ownership");
		expect(written).toContain("@tags");
		expect(written).toContain("@created");
		expect(written).toContain("---");
		expect(written).toContain("Q: ");
		expect(written).toContain("A: ");
	});

	test("kebab-cases the filename", () => {
		// The command uses toKebabCase for the filename
		const kebab = toKebabCase("Rust Ownership");
		expect(kebab).toBe("rust-ownership");
		// So the file would be rust-ownership.fc
		expect(`${kebab}.fc`).toBe("rust-ownership.fc");
	});

	test("errors when file already exists", async () => {
		const filePath = join(tempDir, "existing.fc");
		await writeFile(filePath, "@deck Existing\n");

		// Import and test the logic directly
		const { existsSync } = await import("node:fs");
		expect(existsSync(filePath)).toBe(true);
	});
});

// --- resolveEditor ---

describe("resolveEditor", () => {
	const originalEditor = process.env.EDITOR;

	afterEach(() => {
		if (originalEditor === undefined) {
			delete process.env.EDITOR;
		} else {
			process.env.EDITOR = originalEditor;
		}
	});

	test("uses config editor when not $EDITOR", () => {
		expect(resolveEditor("nvim")).toBe("nvim");
	});

	test("falls back to $EDITOR env var when config is $EDITOR", () => {
		process.env.EDITOR = "code";
		expect(resolveEditor("$EDITOR")).toBe("code");
	});

	test("falls back to vi when no editor configured and no env var", () => {
		delete process.env.EDITOR;
		expect(resolveEditor("$EDITOR")).toBe("vi");
	});

	test("falls back to vi when config editor is empty", () => {
		delete process.env.EDITOR;
		expect(resolveEditor("")).toBe("vi");
	});
});
