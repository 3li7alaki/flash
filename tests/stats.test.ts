import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDailyDashboard } from "../src/commands/daily.ts";
import { getStatsOutput } from "../src/commands/stats.ts";

const DECK_A = `@deck rust-ownership
@tags rust, memory

---
Q: What is the borrow checker?
A: It enforces ownership rules at compile time.
---
Q: What happens when you assign a variable?
A: Ownership moves to the new variable.
---
Q: When does Rust call drop()?
A: When a value goes out of scope.
---
`;

const DECK_B = `@deck javascript-async
@tags javascript

---
Q: What is a Promise?
A: An object representing eventual completion of an async operation.
---
Q: What is async/await?
A: Syntactic sugar for working with Promises.
---
`;

function makeState(
	deckName: string,
	cards: Record<
		string,
		{
			stability?: number;
			reps?: number;
			lapses?: number;
			due?: string;
		}
	>,
) {
	const result: Record<string, unknown> = {};
	for (const [id, opts] of Object.entries(cards)) {
		result[id] = {
			stability: opts.stability ?? 5,
			difficulty: 5,
			due: opts.due ?? "2020-01-01T00:00:00.000Z",
			reps: opts.reps ?? 3,
			lapses: opts.lapses ?? 0,
			lastReview: "2020-01-01T00:00:00.000Z",
			lastRating: "good",
		};
	}
	return JSON.stringify({ deck: deckName, cards: result });
}

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "fc-stats-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true });
});

describe("getStatsOutput", () => {
	test("computes correct totals for a single deck", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);
		// No state file -> all cards are new and due
		const output = await getStatsOutput(tempDir);

		expect(output).toContain("rust-ownership");
		expect(output).toContain("3"); // total cards
		expect(output).toContain("Total");
		expect(output).toContain("Retention");
	});

	test("shows retention percentage", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);

		// Two cards mastered (stability > 30), one new
		const cardId1 = "d764612601da"; // "What is the borrow checker?"
		const cardId2 = "6a84064dbb86"; // "What happens when you assign a variable?"

		const state = makeState("rust-ownership", {
			[cardId1]: { stability: 35, reps: 10 },
			[cardId2]: { stability: 40, reps: 8 },
		});
		await writeFile(join(tempDir, "rust-ownership.fc.state"), state);

		const output = await getStatsOutput(tempDir);
		expect(output).toContain("67%"); // 2 mastered out of 3
	});

	test("shows per-deck stats and totals for multiple decks", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);
		await writeFile(join(tempDir, "javascript-async.fc"), DECK_B);

		const output = await getStatsOutput(tempDir);
		expect(output).toContain("rust-ownership");
		expect(output).toContain("javascript-async");
		expect(output).toContain("Total");
	});

	test("handles empty decks directory", async () => {
		const output = await getStatsOutput(tempDir);
		expect(output).toContain("No decks found");
	});

	test("shows stats for a specific deck by name", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);
		await writeFile(join(tempDir, "javascript-async.fc"), DECK_B);

		const output = await getStatsOutput(tempDir, "rust-ownership");
		expect(output).toContain("rust-ownership");
		expect(output).not.toContain("javascript-async");
	});
});

describe("getDailyDashboard", () => {
	test("shows due card count across decks", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);
		await writeFile(join(tempDir, "javascript-async.fc"), DECK_B);

		const output = await getDailyDashboard(tempDir);
		expect(output).toContain("Daily Dashboard");
		expect(output).toContain("Due today:");
		expect(output).toContain("5 cards across 2 decks");
	});

	test("finds weak spots with high lapses", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);

		const cardId1 = "d764612601da"; // "What is the borrow checker?"
		const state = makeState("rust-ownership", {
			[cardId1]: { stability: 5, reps: 5, lapses: 3 },
		});
		await writeFile(join(tempDir, "rust-ownership.fc.state"), state);

		const output = await getDailyDashboard(tempDir);
		expect(output).toContain("Weak spots");
		expect(output).toContain("What is the borrow checker?");
		expect(output).toContain("failed 3 times");
	});

	test("suggests deck with most due cards", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);
		await writeFile(join(tempDir, "javascript-async.fc"), DECK_B);

		const output = await getDailyDashboard(tempDir);
		// rust-ownership has 3 due, javascript-async has 2 due
		expect(output).toContain("Suggested:");
		expect(output).toContain("rust-ownership");
	});

	test("handles empty decks directory", async () => {
		const output = await getDailyDashboard(tempDir);
		expect(output).toContain("No decks found");
	});

	test("shows no weak spots when no cards have high lapses", async () => {
		await writeFile(join(tempDir, "rust-ownership.fc"), DECK_A);

		const output = await getDailyDashboard(tempDir);
		// All cards are new, no lapses
		expect(output).not.toContain("Weak spots");
	});
});
