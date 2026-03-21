import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoNameFromUrl } from "../src/commands/follow.ts";
import { repoNameFromDeck } from "../src/commands/share.ts";
import { loadConfig, saveConfig } from "../src/config/config.ts";

// --- share: repo name generation ---

describe("repoNameFromDeck", () => {
	test("generates correct repo name from deck name", () => {
		expect(repoNameFromDeck("rust-ownership")).toBe(
			"flash-deck-rust-ownership",
		);
	});

	test("generates correct repo name from path", () => {
		expect(repoNameFromDeck("/home/user/flashcards/rust-ownership.fc")).toBe(
			"flash-deck-rust-ownership",
		);
	});

	test("handles deck name with spaces via kebab conversion", () => {
		expect(repoNameFromDeck("Rust Ownership")).toBe(
			"flash-deck-rust-ownership",
		);
	});
});

// --- follow: URL parsing ---

describe("repoNameFromUrl", () => {
	test("parses HTTPS GitHub URL", () => {
		expect(repoNameFromUrl("https://github.com/user/fc-deck-rust")).toBe(
			"fc-deck-rust",
		);
	});

	test("parses SSH GitHub URL with .git suffix", () => {
		expect(repoNameFromUrl("git@github.com:user/fc-deck-rust.git")).toBe(
			"fc-deck-rust",
		);
	});

	test("handles trailing slash", () => {
		expect(repoNameFromUrl("https://github.com/user/fc-deck-rust/")).toBe(
			"fc-deck-rust",
		);
	});
});

// --- follow: config storage ---

describe("follow config", () => {
	let tmpDir: string;
	let configPath: string;

	beforeEach(async () => {
		tmpDir = join(tmpdir(), `fc-test-ecosystem-${Date.now()}`);
		await mkdir(tmpDir, { recursive: true });
		configPath = join(tmpDir, "config.json");
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("stores follow relationship in config", async () => {
		const config = await loadConfig(configPath);
		config.followed = [
			{
				url: "https://github.com/user/fc-deck-rust",
				name: "fc-deck-rust",
				lastSync: "2026-01-01T00:00:00.000Z",
			},
		];
		await saveConfig(config, configPath);

		const loaded = await loadConfig(configPath);
		expect(loaded.followed).toHaveLength(1);
		expect(loaded.followed?.[0]?.url).toBe(
			"https://github.com/user/fc-deck-rust",
		);
		expect(loaded.followed?.[0]?.name).toBe("fc-deck-rust");
	});
});

// --- sync: no followed decks ---

describe("sync", () => {
	test("detects no followed decks from empty config", async () => {
		const tmpDir = join(tmpdir(), `fc-test-sync-${Date.now()}`);
		await mkdir(tmpDir, { recursive: true });
		const configPath = join(tmpDir, "config.json");

		const config = await loadConfig(configPath);
		const followed = config.followed ?? [];

		expect(followed).toHaveLength(0);

		await rm(tmpDir, { recursive: true, force: true });
	});
});
