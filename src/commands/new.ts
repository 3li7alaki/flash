import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import * as prompts from "@clack/prompts";
import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { toKebabCase } from "./utils.ts";

function getTodayString(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function buildMinimalDeck(name: string): string {
	const lines = [
		`@deck ${name}`,
		"@tags",
		`@created ${getTodayString()}`,
		"",
		"---",
		"Q: ",
		"A: ",
		"---",
		"",
	];
	return lines.join("\n");
}

export async function newCommand(
	args: string[],
	flags: Record<string, string | boolean>,
): Promise<void> {
	let name = args[0];

	if (!name) {
		const result = await prompts.text({
			message: "Deck name:",
			validate: (value) => {
				if (!value?.trim()) return "Deck name is required";
			},
		});
		if (prompts.isCancel(result)) {
			console.log("Cancelled.");
			return;
		}
		name = result as string;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);
	const kebab = toKebabCase(name);
	const filePath = join(decksDir, `${kebab}.fc`);

	if (existsSync(filePath)) {
		console.error(`Error: Deck already exists at ${filePath}`);
		process.exitCode = 1;
		return;
	}

	await mkdir(decksDir, { recursive: true });

	const templateName = flags.template;
	if (typeof templateName === "string" && templateName) {
		const templateDir = join(homedir(), ".config", "fc", "templates");
		const templatePath = join(templateDir, `${templateName}.fc`);

		try {
			let content = await readFile(templatePath, "utf-8");
			content = content.replace(/@deck\s+.*/g, `@deck ${name}`);
			await writeFile(filePath, content, "utf-8");
		} catch {
			console.error(`Error: Template not found: ${templatePath}`);
			process.exitCode = 1;
			return;
		}
	} else {
		const content = buildMinimalDeck(name);
		await writeFile(filePath, content, "utf-8");
	}

	console.log(`Created deck: ${filePath}`);
}
