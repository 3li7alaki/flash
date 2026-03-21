import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Helper: create a temp directory with a config pointing to a temp decks dir
function setupTempEnv(): {
	configDir: string;
	decksDir: string;
	cleanup: () => void;
} {
	const base = mkdtempSync(join(tmpdir(), "fc-test-"));
	const configDir = join(base, "config", "flash");
	const decksDir = join(base, "decks");
	mkdirSync(configDir, { recursive: true });
	mkdirSync(decksDir, { recursive: true });

	const config = {
		decksDir,
		ai: { provider: "openrouter", apiKey: "", model: "test" },
		scheduler: { algorithm: "fsrs-5" },
		review: { aiGrading: true, showHints: true, cardsPerSession: 0 },
		editor: "$EDITOR",
		version: 1,
	};
	writeFileSync(join(configDir, "config.json"), JSON.stringify(config));

	return {
		configDir,
		decksDir,
		cleanup: () => rmSync(base, { recursive: true, force: true }),
	};
}

function runCli(
	configDir: string,
	...args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const proc = Bun.spawn(["bun", "run", "src/cli.ts", ...args], {
		cwd: import.meta.dir.replace("/tests", ""),
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...process.env,
			XDG_CONFIG_HOME: join(configDir, ".."),
		},
	});
	return Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]).then(([stdout, stderr, exitCode]) => ({ stdout, stderr, exitCode }));
}

const CLEAN_DECK = `@deck Test
@created 2026-03-21

---
Q: What is Rust?
A: A systems programming language.
tags: programming, rust
---`;

const DECK_WITH_ERRORS = `@deck Bad Deck

---
A: An answer with no question.
tags: orphan
---
Q: What is Go?
A: A language by Google.
tags: go
---
`;

const DECK_WITH_MESSY_TAGS = `@deck Messy

---
Q: What is Rust?
A: A language.
tags: Rust, rust, Programming
---
`;

describe("fc lint", () => {
	let env: ReturnType<typeof setupTempEnv>;

	beforeEach(() => {
		env = setupTempEnv();
	});

	afterEach(() => {
		env.cleanup();
	});

	test("clean file: no errors, exit 0", async () => {
		writeFileSync(join(env.decksDir, "clean.fc"), CLEAN_DECK);
		const { stdout, exitCode } = await runCli(env.configDir, "lint", "clean");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("0 errors, 0 warnings");
	});

	test("file with errors: shows errors, exit 1", async () => {
		writeFileSync(join(env.decksDir, "bad.fc"), DECK_WITH_ERRORS);
		const { stdout, exitCode } = await runCli(env.configDir, "lint", "bad");
		expect(exitCode).toBe(1);
		expect(stdout).toContain("error:");
		expect(stdout).toContain("no Q:");
	});

	test("lint all files in directory", async () => {
		writeFileSync(join(env.decksDir, "clean.fc"), CLEAN_DECK);
		writeFileSync(join(env.decksDir, "bad.fc"), DECK_WITH_ERRORS);
		const { stdout, exitCode } = await runCli(env.configDir, "lint");
		expect(exitCode).toBe(1);
		expect(stdout).toContain("2 files");
	});
});

describe("fc fix", () => {
	let env: ReturnType<typeof setupTempEnv>;

	beforeEach(() => {
		env = setupTempEnv();
	});

	afterEach(() => {
		env.cleanup();
	});

	test("fix applies changes and saves", async () => {
		writeFileSync(join(env.decksDir, "messy.fc"), DECK_WITH_MESSY_TAGS);
		const { stdout } = await runCli(env.configDir, "fix", "messy");
		expect(stdout).toContain("Sorted tags");
		expect(stdout).toContain("Fixed");

		const content = await readFile(join(env.decksDir, "messy.fc"), "utf-8");
		expect(content).toContain("tags: programming, rust");
	});

	test("fix clean file: no changes", async () => {
		writeFileSync(join(env.decksDir, "clean.fc"), CLEAN_DECK);
		const { stdout } = await runCli(env.configDir, "fix", "clean");
		expect(stdout).toContain("All files clean");
	});
});

describe("fc export", () => {
	let env: ReturnType<typeof setupTempEnv>;

	beforeEach(() => {
		env = setupTempEnv();
	});

	afterEach(() => {
		env.cleanup();
	});

	test("export produces valid CSV to stdout", async () => {
		writeFileSync(join(env.decksDir, "test.fc"), CLEAN_DECK);
		const { stdout, exitCode } = await runCli(env.configDir, "export", "test");
		expect(exitCode).toBe(0);
		expect(stdout).toContain(
			"question,answer,tags,type,hint,difficulty,source,reversible,choices",
		);
		expect(stdout).toContain("What is Rust?");
		expect(stdout).toContain("A systems programming language.");
	});

	test("export with --output writes to file", async () => {
		writeFileSync(join(env.decksDir, "test.fc"), CLEAN_DECK);
		const outPath = join(env.decksDir, "out.csv");
		const { stdout, exitCode } = await runCli(
			env.configDir,
			"export",
			"test",
			"--output",
			outPath,
		);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Exported");
		const csv = await readFile(outPath, "utf-8");
		expect(csv).toContain("What is Rust?");
	});
});

describe("fc import", () => {
	let env: ReturnType<typeof setupTempEnv>;

	beforeEach(() => {
		env = setupTempEnv();
	});

	afterEach(() => {
		env.cleanup();
	});

	const CSV_CONTENT = `question,answer,tags,type,hint,difficulty,source,reversible,choices
What is Go?,A language by Google.,"go, programming",qa,,,,
What is Rust?,A systems language.,"rust, systems",qa,,,,
`;

	test("import creates new deck from CSV", async () => {
		const csvPath = join(env.decksDir, "languages.csv");
		writeFileSync(csvPath, CSV_CONTENT);
		const { stdout, exitCode } = await runCli(env.configDir, "import", csvPath);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Imported 2 cards into languages");

		const deckPath = join(env.decksDir, "languages.fc");
		expect(existsSync(deckPath)).toBe(true);
		const content = await readFile(deckPath, "utf-8");
		expect(content).toContain("What is Go?");
		expect(content).toContain("What is Rust?");
	});

	test("import with explicit deck name", async () => {
		const csvPath = join(env.decksDir, "data.csv");
		writeFileSync(csvPath, CSV_CONTENT);
		const { stdout, exitCode } = await runCli(
			env.configDir,
			"import",
			csvPath,
			"My Languages",
		);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Imported 2 cards into my-languages");

		const deckPath = join(env.decksDir, "my-languages.fc");
		expect(existsSync(deckPath)).toBe(true);
	});

	test("import detects existing deck and prompts", async () => {
		// Pre-create the deck
		writeFileSync(join(env.decksDir, "languages.fc"), CLEAN_DECK);
		const csvPath = join(env.decksDir, "languages.csv");
		writeFileSync(csvPath, CSV_CONTENT);

		// In non-interactive mode, clack renders the prompt to stdout
		const { stdout } = await runCli(env.configDir, "import", csvPath);
		expect(stdout).toContain("already exists");
	});
});
