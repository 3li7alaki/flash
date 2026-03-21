#!/usr/bin/env bun

import { version } from "../package.json";

// --- Flag parsing ---

export interface ParsedArgs {
	positional: string[];
	flags: Record<string, string | boolean>;
}

export function parseFlags(args: string[]): ParsedArgs {
	const positional: string[] = [];
	const flags: Record<string, string | boolean> = {};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === undefined) continue;

		if (arg === "--") {
			positional.push(...args.slice(i + 1));
			break;
		}

		if (arg.startsWith("--")) {
			const eqIndex = arg.indexOf("=");
			if (eqIndex !== -1) {
				const key = arg.slice(2, eqIndex);
				flags[key] = arg.slice(eqIndex + 1);
			} else {
				const key = arg.slice(2);
				const next = args[i + 1];
				if (next !== undefined && !next.startsWith("--")) {
					flags[key] = next;
					i++;
				} else {
					flags[key] = true;
				}
			}
		} else {
			positional.push(arg);
		}
	}

	return { positional, flags };
}

// --- Command registry ---

type CommandHandler = (
	args: string[],
	flags: Record<string, string | boolean>,
) => Promise<void>;

const COMMAND_GROUPS: Record<
	string,
	{ description: string; commands: string[] }
> = {
	Core: {
		description: "Deck management and review",
		commands: [
			"new",
			"add",
			"edit",
			"list",
			"review",
			"stats",
			"daily",
			"search",
			"merge",
			"lint",
			"fix",
			"config",
		],
	},
	"Import/Export": {
		description: "Move cards in and out",
		commands: ["export", "import"],
	},
	"AI-Powered": {
		description: "AI generation and learning",
		commands: [
			"gen",
			"learn",
			"weak",
			"explain",
			"rephrase",
			"challenge",
			"summarize",
		],
	},
	Ecosystem: {
		description: "Share and sync decks",
		commands: ["share", "follow", "sync", "templates"],
	},
	Maintenance: {
		description: "Updates and diagnostics",
		commands: ["update", "doctor", "version"],
	},
};

function stub(name: string): CommandHandler {
	return async () => {
		console.log(`${name}: Not implemented yet`);
	};
}

const commands: Record<string, CommandHandler> = {};

// Register stubs for all commands
for (const group of Object.values(COMMAND_GROUPS)) {
	for (const cmd of group.commands) {
		commands[cmd] = stub(cmd);
	}
}

// Real implementations
commands.version = async () => {
	console.log(`fc v${version}`);
};

// --- Help ---

function printHelp(): void {
	console.log("fc - Flashcard CLI with AI superpowers\n");
	console.log(`Usage: fc <command> [args...] [--flags]\n`);

	for (const [groupName, group] of Object.entries(COMMAND_GROUPS)) {
		console.log(`${groupName} — ${group.description}`);
		for (const cmd of group.commands) {
			console.log(`  ${cmd}`);
		}
		console.log();
	}

	console.log(`Run fc <command> --help for command-specific help.`);
}

// --- Main ---

async function main(): Promise<void> {
	const rawArgs = process.argv.slice(2);
	const { positional, flags } = parseFlags(rawArgs);
	const commandName = positional[0];

	if (flags.version) {
		await commands.version?.([], {});
		return;
	}

	if (!commandName || flags.help) {
		printHelp();
		return;
	}

	const handler = commands[commandName];
	if (!handler) {
		console.error(`Unknown command: ${commandName}\n`);
		printHelp();
		process.exitCode = 1;
		return;
	}

	await handler(positional.slice(1), flags);
}

main();
