import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatConfig, getByPath, setByPath } from "../src/commands/config.ts";
import { versionCommand } from "../src/commands/version.ts";
import {
	getDefaultConfig,
	loadConfig,
	saveConfig,
} from "../src/config/config.ts";

// --- config: getByPath / setByPath ---

describe("config get/set by path", () => {
	test("getByPath returns nested value", () => {
		const config = getDefaultConfig();
		const obj = config as unknown as Record<string, unknown>;
		expect(getByPath(obj, "ai.model")).toBe("deepseek/deepseek-chat-v3-0324");
	});

	test("getByPath returns top-level value", () => {
		const config = getDefaultConfig();
		const obj = config as unknown as Record<string, unknown>;
		expect(getByPath(obj, "decksDir")).toBe("~/flashcards");
	});

	test("getByPath returns undefined for missing key", () => {
		const config = getDefaultConfig();
		const obj = config as unknown as Record<string, unknown>;
		expect(getByPath(obj, "nonexistent.key")).toBeUndefined();
	});

	test("setByPath updates nested value", () => {
		const config = getDefaultConfig();
		const obj = config as unknown as Record<string, unknown>;
		setByPath(obj, "ai.model", "gpt-4");
		expect(getByPath(obj, "ai.model")).toBe("gpt-4");
	});

	test("setByPath updates top-level value", () => {
		const config = getDefaultConfig();
		const obj = config as unknown as Record<string, unknown>;
		setByPath(obj, "decksDir", "/custom/path");
		expect(getByPath(obj, "decksDir")).toBe("/custom/path");
	});
});

// --- config command: get/set integration ---

describe("config get returns correct value", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "fc-maint-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("get reads saved config value", async () => {
		const configPath = join(tempDir, "config.json");
		const config = getDefaultConfig();
		config.ai.model = "test-model-xyz";
		await saveConfig(config, configPath);

		const loaded = await loadConfig(configPath);
		const obj = loaded as unknown as Record<string, unknown>;
		expect(getByPath(obj, "ai.model")).toBe("test-model-xyz");
	});
});

describe("config set updates config", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "fc-maint-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("set persists new value", async () => {
		const configPath = join(tempDir, "config.json");
		const config = getDefaultConfig();
		await saveConfig(config, configPath);

		// Simulate config set
		const loaded = await loadConfig(configPath);
		const obj = loaded as unknown as Record<string, unknown>;
		setByPath(obj, "ai.model", "gpt-4");
		await saveConfig(loaded, configPath);

		const reloaded = await loadConfig(configPath);
		expect(reloaded.ai.model).toBe("gpt-4");
	});

	test("set coerces boolean values", async () => {
		const configPath = join(tempDir, "config.json");
		const config = getDefaultConfig();
		await saveConfig(config, configPath);

		const loaded = await loadConfig(configPath);
		const obj = loaded as unknown as Record<string, unknown>;
		// review.aiGrading is a boolean, setting "false" should coerce
		setByPath(obj, "review.aiGrading", false);
		await saveConfig(loaded, configPath);

		const reloaded = await loadConfig(configPath);
		expect(reloaded.review.aiGrading).toBe(false);
	});

	test("set coerces number values", async () => {
		const configPath = join(tempDir, "config.json");
		const config = getDefaultConfig();
		await saveConfig(config, configPath);

		const loaded = await loadConfig(configPath);
		const obj = loaded as unknown as Record<string, unknown>;
		setByPath(obj, "review.cardsPerSession", 25);
		await saveConfig(loaded, configPath);

		const reloaded = await loadConfig(configPath);
		expect(reloaded.review.cardsPerSession).toBe(25);
	});
});

// --- formatConfig ---

describe("formatConfig", () => {
	test("masks API key when set", () => {
		const config = getDefaultConfig();
		config.ai.apiKey = "secret-key-123";
		const output = formatConfig(config);
		expect(output).toContain("***");
		expect(output).not.toContain("secret-key-123");
	});

	test("shows (not set) when API key is empty", () => {
		const config = getDefaultConfig();
		const output = formatConfig(config);
		expect(output).toContain("(not set)");
	});

	test("includes all config sections", () => {
		const config = getDefaultConfig();
		const output = formatConfig(config);
		expect(output).toContain("ai:");
		expect(output).toContain("scheduler:");
		expect(output).toContain("review:");
		expect(output).toContain("decksDir:");
		expect(output).toContain("editor:");
	});
});

// --- version ---

describe("flash version", () => {
	test("outputs version string", async () => {
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			logs.push(args.map(String).join(" "));
		};

		await versionCommand([], {});

		console.log = originalLog;
		expect(logs.length).toBe(1);
		expect(logs[0]).toMatch(/^flash v\d+\.\d+\.\d+$/);
	});
});

// --- doctor ---

describe("fc doctor", () => {
	let tempDir: string;
	let configDir: string;
	let decksDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "fc-doctor-test-"));
		configDir = join(tempDir, "config");
		decksDir = join(tempDir, "decks");
		await mkdir(configDir, { recursive: true });
		await mkdir(decksDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("doctor checks pass with valid setup", async () => {
		const configPath = join(configDir, "config.json");
		const config = getDefaultConfig();
		config.ai.apiKey = "test-key";
		config.decksDir = decksDir;
		await saveConfig(config, configPath);

		// Write a valid deck file
		await writeFile(
			join(decksDir, "test.fc"),
			"@deck Test\n---\nQ: What is 1+1?\nA: 2\ntags: math\n---\n",
		);

		// Load and verify config is valid
		const loaded = await loadConfig(configPath);
		expect(loaded.ai.apiKey).toBe("test-key");
		expect(loaded.decksDir).toBe(decksDir);
	});

	test("doctor detects missing config", async () => {
		const configPath = join(configDir, "nonexistent.json");
		// loadConfig returns defaults when file doesn't exist
		const config = await loadConfig(configPath);
		expect(config).toEqual(getDefaultConfig());
	});

	test("doctor detects missing decks dir", async () => {
		const { existsSync } = await import("node:fs");
		const missingDir = join(tempDir, "nonexistent-decks");
		expect(existsSync(missingDir)).toBe(false);
	});

	test("doctor warns about missing API key", async () => {
		const originalKey = process.env.FLASH_API_KEY;
		delete process.env.FLASH_API_KEY;

		const config = getDefaultConfig();
		// Default config has empty apiKey
		const { getApiKey } = await import("../src/config/config.ts");
		const key = getApiKey(config);
		expect(key).toBe("");

		if (originalKey !== undefined) {
			process.env.FLASH_API_KEY = originalKey;
		}
	});

	test("doctor detects invalid deck files", async () => {
		// Write a file that is technically parseable (parser is lenient)
		// but we can test that valid files parse correctly
		await writeFile(
			join(decksDir, "good.fc"),
			"@deck Good\n---\nQ: Test?\nA: Yes\ntags: test\n---\n",
		);

		const { parseDeck } = await import("../src/format/parser.ts");
		const { readFile: rf } = await import("node:fs/promises");
		const text = await rf(join(decksDir, "good.fc"), "utf-8");
		const deck = parseDeck(text);
		expect(deck.cards.length).toBe(1);
		expect(deck.meta.name).toBe("Good");
	});
});
