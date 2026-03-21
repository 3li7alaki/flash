import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getTemplatesDir,
	listTemplates,
	type TemplateInfo,
} from "../src/commands/templates.ts";
import { parseDeck } from "../src/format/parser.ts";

// --- Built-in templates ---

describe("getTemplatesDir", () => {
	test("returns a path ending in /templates", () => {
		const dir = getTemplatesDir();
		expect(dir.endsWith("/templates")).toBe(true);
	});
});

describe("listTemplates", () => {
	test("finds built-in templates", async () => {
		const templates = await listTemplates();
		const builtIn = templates.filter((t) => t.builtIn);

		expect(builtIn.length).toBeGreaterThanOrEqual(3);

		const names = builtIn.map((t) => t.name);
		expect(names).toContain("interview-prep");
		expect(names).toContain("language");
		expect(names).toContain("programming");
	});

	test("all built-in templates are marked as builtIn", async () => {
		const templates = await listTemplates();
		const builtIn = templates.filter((t) => t.builtIn);

		for (const t of builtIn) {
			expect(t.builtIn).toBe(true);
		}
	});
});

// --- Template description extraction ---

describe("template description from @deck line", () => {
	test("interview-prep has correct description", async () => {
		const templates = await listTemplates();
		const interviewPrep = templates.find((t) => t.name === "interview-prep");
		expect(interviewPrep).toBeDefined();
		expect(interviewPrep?.description).toBe("Interview Prep");
	});

	test("language has correct description", async () => {
		const templates = await listTemplates();
		const language = templates.find((t) => t.name === "language");
		expect(language).toBeDefined();
		expect(language?.description).toBe("Language Learning");
	});

	test("programming has correct description", async () => {
		const templates = await listTemplates();
		const programming = templates.find((t) => t.name === "programming");
		expect(programming).toBeDefined();
		expect(programming?.description).toBe("Programming Concepts");
	});
});

// --- Built-in template files parse without errors ---

describe("built-in templates are valid .fc format", () => {
	test("interview-prep.fc parses without errors", async () => {
		const content = await readFile(
			join(getTemplatesDir(), "interview-prep.fc"),
			"utf-8",
		);
		const deck = parseDeck(content);
		expect(deck.meta.name).toBe("Interview Prep");
		expect(deck.cards.length).toBeGreaterThan(0);
	});

	test("language.fc parses without errors", async () => {
		const content = await readFile(
			join(getTemplatesDir(), "language.fc"),
			"utf-8",
		);
		const deck = parseDeck(content);
		expect(deck.meta.name).toBe("Language Learning");
		expect(deck.cards.length).toBeGreaterThan(0);
	});

	test("programming.fc parses without errors", async () => {
		const content = await readFile(
			join(getTemplatesDir(), "programming.fc"),
			"utf-8",
		);
		const deck = parseDeck(content);
		expect(deck.meta.name).toBe("Programming Concepts");
		expect(deck.cards.length).toBeGreaterThan(0);
	});
});

// --- User templates ---

describe("listTemplates with user templates", () => {
	let tempDir: string;
	let originalEnv: string | undefined;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `fc-test-templates-${Date.now()}`);
		const userTemplatesDir = join(tempDir, "flash", "templates");
		await mkdir(userTemplatesDir, { recursive: true });
		await writeFile(
			join(userTemplatesDir, "my-custom.fc"),
			"@deck My Custom Template\n@tags custom\n@created TEMPLATE\n\n---\nQ: Custom?\nA: Yes\n---\n",
		);

		originalEnv = process.env.XDG_CONFIG_HOME;
		process.env.XDG_CONFIG_HOME = tempDir;
	});

	afterEach(async () => {
		if (originalEnv === undefined) {
			delete process.env.XDG_CONFIG_HOME;
		} else {
			process.env.XDG_CONFIG_HOME = originalEnv;
		}
		await rm(tempDir, { recursive: true, force: true });
	});

	test("finds user templates alongside built-in", async () => {
		const templates = await listTemplates();
		const user = templates.filter((t) => !t.builtIn);

		expect(user.length).toBeGreaterThanOrEqual(1);
		const names = user.map((t) => t.name);
		expect(names).toContain("my-custom");
	});

	test("user templates have correct description", async () => {
		const templates = await listTemplates();
		const custom = templates.find((t) => t.name === "my-custom");
		expect(custom).toBeDefined();
		expect(custom?.description).toBe("My Custom Template");
		expect(custom?.builtIn).toBe(false);
	});
});
