import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfigDir } from "../config/config.ts";

export interface TemplateInfo {
	name: string;
	description: string;
	builtIn: boolean;
}

/**
 * Returns the path to the built-in templates directory shipped with fc.
 */
export function getTemplatesDir(): string {
	return join(import.meta.dir, "../../templates");
}

/**
 * Returns the path to the user's custom templates directory.
 */
export function getUserTemplatesDir(): string {
	return join(getConfigDir(), "templates");
}

/**
 * Extract the deck description from the @deck metadata line in a .fc file.
 */
function extractDescription(content: string): string {
	for (const line of content.split("\n")) {
		const match = line.match(/^@deck\s+(.+)/);
		if (match?.[1]) {
			return match[1].trim();
		}
	}
	return "(no description)";
}

/**
 * Scan a directory for .fc template files and return their info.
 */
async function scanTemplateDir(
	dir: string,
	builtIn: boolean,
): Promise<TemplateInfo[]> {
	let files: string[];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith(".fc"));
	} catch {
		return [];
	}

	files.sort();

	const results: TemplateInfo[] = [];
	for (const file of files) {
		const content = await readFile(join(dir, file), "utf-8");
		const name = file.replace(/\.fc$/, "");
		const description = extractDescription(content);
		results.push({ name, description, builtIn });
	}

	return results;
}

/**
 * List all available templates from both built-in and user directories.
 */
export async function listTemplates(): Promise<TemplateInfo[]> {
	const builtIn = await scanTemplateDir(getTemplatesDir(), true);
	const user = await scanTemplateDir(getUserTemplatesDir(), false);
	return [...builtIn, ...user];
}

/**
 * Find a template by name, checking user templates first, then built-in.
 * Returns the full path to the template file, or null if not found.
 */
export function findTemplate(name: string): string | null {
	// Check user templates first (allows overriding built-in templates)
	const userPath = join(getUserTemplatesDir(), `${name}.fc`);
	if (existsSync(userPath)) {
		return userPath;
	}

	const builtInPath = join(getTemplatesDir(), `${name}.fc`);
	if (existsSync(builtInPath)) {
		return builtInPath;
	}

	return null;
}

function padEnd(str: string, len: number): string {
	return str + " ".repeat(Math.max(0, len - str.length));
}

export async function templatesCommand(
	_args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const templates = await listTemplates();
	const builtIn = templates.filter((t) => t.builtIn);
	const user = templates.filter((t) => !t.builtIn);

	const maxNameLen = Math.max(...templates.map((t) => t.name.length), 10);

	console.log("Built-in templates:");
	if (builtIn.length === 0) {
		console.log("  (none)");
	} else {
		for (const t of builtIn) {
			console.log(
				`  ${padEnd(t.name, maxNameLen)}  — ${t.description} deck structure`,
			);
		}
	}

	console.log("");
	console.log(`User templates: (~/.config/flash/templates/)`);
	if (user.length === 0) {
		console.log("  (none)");
	} else {
		for (const t of user) {
			console.log(
				`  ${padEnd(t.name, maxNameLen)}  — ${t.description} deck structure`,
			);
		}
	}

	console.log("");
	console.log('Use: fc new "My Deck" --template interview-prep');
}
