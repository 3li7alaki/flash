import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getApiKey,
	getConfigDir,
	getConfigPath,
	getDefaultConfig,
	loadConfig,
	migrateConfig,
	resolveDecksDir,
	saveConfig,
} from "../src/config/config.ts";
import type { FcConfig } from "../src/types.ts";

describe("getDefaultConfig", () => {
	test("returns all required fields with correct defaults", () => {
		const config = getDefaultConfig();
		expect(config.ai.provider).toBe("openrouter");
		expect(config.ai.apiKey).toBe("");
		expect(config.ai.model).toBe("deepseek/deepseek-chat-v3-0324");
		expect(config.scheduler.algorithm).toBe("fsrs-5");
		expect(config.review.aiGrading).toBe(true);
		expect(config.review.showHints).toBe(true);
		expect(config.review.cardsPerSession).toBe(0);
		expect(config.decksDir).toBe("~/flashcards");
		expect(config.editor).toBe("$EDITOR");
		expect(config.version).toBe(1);
	});
});

describe("getConfigDir", () => {
	const originalXdg = process.env.XDG_CONFIG_HOME;

	afterEach(() => {
		if (originalXdg === undefined) {
			delete process.env.XDG_CONFIG_HOME;
		} else {
			process.env.XDG_CONFIG_HOME = originalXdg;
		}
	});

	test("uses XDG_CONFIG_HOME when set", () => {
		process.env.XDG_CONFIG_HOME = "/tmp/custom-config";
		expect(getConfigDir()).toBe("/tmp/custom-config/flash");
	});

	test("falls back to ~/.config/flash when XDG_CONFIG_HOME is not set", () => {
		delete process.env.XDG_CONFIG_HOME;
		const home = process.env.HOME ?? "";
		expect(getConfigDir()).toBe(join(home, ".config", "flash"));
	});
});

describe("getConfigPath", () => {
	test("returns config.json inside config dir", () => {
		const path = getConfigPath();
		expect(path.endsWith("config.json")).toBe(true);
		expect(path).toContain("flash");
	});
});

describe("loadConfig", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "fc-config-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns defaults when file does not exist", async () => {
		const config = await loadConfig(join(tempDir, "nonexistent.json"));
		const defaults = getDefaultConfig();
		expect(config).toEqual(defaults);
	});

	test("deep merges saved config with defaults for missing fields", async () => {
		const partial = {
			ai: { provider: "custom-provider", apiKey: "my-key", model: "gpt-4" },
			decksDir: "/my/decks",
			version: 1,
		};
		const configPath = join(tempDir, "config.json");
		await writeFile(configPath, JSON.stringify(partial));

		const config = await loadConfig(configPath);
		// Saved values are preserved
		expect(config.ai.provider).toBe("custom-provider");
		expect(config.ai.apiKey).toBe("my-key");
		expect(config.decksDir).toBe("/my/decks");
		// Missing fields get defaults
		expect(config.scheduler.algorithm).toBe("fsrs-5");
		expect(config.review.aiGrading).toBe(true);
		expect(config.review.showHints).toBe(true);
		expect(config.review.cardsPerSession).toBe(0);
		expect(config.editor).toBe("$EDITOR");
	});
});

describe("saveConfig", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "fc-config-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("creates directories and writes config", async () => {
		const configPath = join(tempDir, "nested", "dir", "config.json");
		const config = getDefaultConfig();
		await saveConfig(config, configPath);

		const raw = await readFile(configPath, "utf-8");
		const loaded = JSON.parse(raw);
		expect(loaded.ai.provider).toBe("openrouter");
		expect(loaded.version).toBe(1);
	});

	test("save and load round-trips correctly", async () => {
		const configPath = join(tempDir, "config.json");
		const config = getDefaultConfig();
		config.ai.apiKey = "test-key-123";
		config.decksDir = "/custom/decks";

		await saveConfig(config, configPath);
		const loaded = await loadConfig(configPath);

		expect(loaded).toEqual(config);
	});
});

describe("migrateConfig", () => {
	test("returns unchanged for current version", () => {
		const config = getDefaultConfig();
		const result = migrateConfig(config);
		expect(result.migrated).toBe(false);
		expect(result.changes).toEqual([]);
		expect(result.config).toEqual(config);
	});

	test("adds version field if missing", () => {
		const config = getDefaultConfig();
		const noVersion = { ...config };
		delete (noVersion as Record<string, unknown>).version;

		const result = migrateConfig(noVersion as FcConfig);
		expect(result.migrated).toBe(true);
		expect(result.config.version).toBe(1);
		expect(result.changes.length).toBeGreaterThan(0);
	});
});

describe("getApiKey", () => {
	const originalKey = process.env.FLASH_API_KEY;

	afterEach(() => {
		if (originalKey === undefined) {
			delete process.env.FLASH_API_KEY;
		} else {
			process.env.FLASH_API_KEY = originalKey;
		}
	});

	test("prefers FLASH_API_KEY env var over config", () => {
		process.env.FLASH_API_KEY = "env-key-123";
		const config = getDefaultConfig();
		config.ai.apiKey = "config-key-456";

		expect(getApiKey(config)).toBe("env-key-123");
	});

	test("falls back to config value when env var is not set", () => {
		delete process.env.FLASH_API_KEY;
		const config = getDefaultConfig();
		config.ai.apiKey = "config-key-456";

		expect(getApiKey(config)).toBe("config-key-456");
	});

	test("returns empty string when neither is set", () => {
		delete process.env.FLASH_API_KEY;
		const config = getDefaultConfig();
		expect(getApiKey(config)).toBe("");
	});
});

describe("resolveDecksDir", () => {
	test("expands ~ to home directory", () => {
		const config = getDefaultConfig();
		config.decksDir = "~/flashcards";
		const resolved = resolveDecksDir(config);
		const home = process.env.HOME ?? "";
		expect(resolved).toBe(join(home, "flashcards"));
	});

	test("returns absolute paths unchanged", () => {
		const config = getDefaultConfig();
		config.decksDir = "/absolute/path/to/decks";
		const resolved = resolveDecksDir(config);
		expect(resolved).toBe("/absolute/path/to/decks");
	});
});
