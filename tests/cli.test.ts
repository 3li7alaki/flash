import { describe, expect, test } from "bun:test";
import { parseFlags } from "../src/cli.ts";

// --- parseFlags unit tests ---

describe("parseFlags", () => {
	test("returns empty for no args", () => {
		const result = parseFlags([]);
		expect(result.positional).toEqual([]);
		expect(result.flags).toEqual({});
	});

	test("collects positional args", () => {
		const result = parseFlags(["foo", "bar", "baz"]);
		expect(result.positional).toEqual(["foo", "bar", "baz"]);
		expect(result.flags).toEqual({});
	});

	test("parses --flag value", () => {
		const result = parseFlags(["--format", "csv"]);
		expect(result.flags.format).toBe("csv");
		expect(result.positional).toEqual([]);
	});

	test("parses --flag=value", () => {
		const result = parseFlags(["--format=csv"]);
		expect(result.flags.format).toBe("csv");
	});

	test("parses boolean flag (no value)", () => {
		const result = parseFlags(["--verbose"]);
		expect(result.flags.verbose).toBe(true);
	});

	test("boolean flag when next arg is also a flag", () => {
		const result = parseFlags(["--verbose", "--format", "csv"]);
		expect(result.flags.verbose).toBe(true);
		expect(result.flags.format).toBe("csv");
	});

	test("mixes positional args and flags", () => {
		const result = parseFlags([
			"deck1",
			"--format",
			"csv",
			"deck2",
			"--verbose",
		]);
		expect(result.positional).toEqual(["deck1", "deck2"]);
		expect(result.flags.format).toBe("csv");
		expect(result.flags.verbose).toBe(true);
	});

	test("handles -- separator", () => {
		const result = parseFlags(["--verbose", "--", "--not-a-flag"]);
		expect(result.flags.verbose).toBe(true);
		expect(result.positional).toEqual(["--not-a-flag"]);
	});

	test("handles empty value with equals", () => {
		const result = parseFlags(["--key="]);
		expect(result.flags.key).toBe("");
	});
});

// --- CLI integration tests (subprocess) ---

async function runCli(
	...args: string[]
): Promise<{ stdout: string; exitCode: number }> {
	const proc = Bun.spawn(["bun", "run", "src/cli.ts", ...args], {
		cwd: import.meta.dir.replace("/tests", ""),
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	return { stdout: stdout + stderr, exitCode };
}

describe("CLI integration", () => {
	test("flash version prints version string", async () => {
		const { stdout } = await runCli("version");
		expect(stdout.trim()).toMatch(/^flash v\d+\.\d+\.\d+$/);
	});

	test("flash --version prints version string", async () => {
		const { stdout } = await runCli("--version");
		expect(stdout.trim()).toMatch(/^flash v\d+\.\d+\.\d+$/);
	});

	test("flash with no args shows help", async () => {
		const { stdout } = await runCli();
		expect(stdout).toContain("flash - Flashcard CLI");
		expect(stdout).toContain("Core");
		expect(stdout).toContain("AI-Powered");
		expect(stdout).toContain("Ecosystem");
		expect(stdout).toContain("Maintenance");
	});

	test("flash --help shows help", async () => {
		const { stdout } = await runCli("--help");
		expect(stdout).toContain("flash - Flashcard CLI");
	});

	test("help includes all command categories", async () => {
		const { stdout } = await runCli("--help");
		expect(stdout).toContain("Core");
		expect(stdout).toContain("Import/Export");
		expect(stdout).toContain("AI-Powered");
		expect(stdout).toContain("Ecosystem");
		expect(stdout).toContain("Maintenance");
	});

	test("unknown command shows error", async () => {
		const { stdout, exitCode } = await runCli("nonexistent");
		expect(stdout).toContain("Unknown command: nonexistent");
		expect(exitCode).toBe(1);
	});

	test("share without args prints usage", async () => {
		const { stdout, exitCode } = await runCli("share");
		expect(stdout).toContain("Usage: flash share");
		expect(exitCode).toBe(1);
	});
});
