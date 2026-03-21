import { loadConfig, resolveDecksDir } from "../config/config.ts";
import { findDeck } from "./utils.ts";

/**
 * Resolve the editor command to use.
 * Priority: config.editor (if not "$EDITOR") -> $EDITOR env var -> "vi"
 */
export function resolveEditor(configEditor: string): string {
	if (configEditor && configEditor !== "$EDITOR") {
		return configEditor;
	}
	return process.env.EDITOR || "vi";
}

export async function editCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const deckNameOrPath = args[0];
	if (!deckNameOrPath) {
		console.error("Usage: fc edit <deck>");
		process.exitCode = 1;
		return;
	}

	const config = await loadConfig();
	const decksDir = resolveDecksDir(config);

	let deckPath: string;
	try {
		deckPath = findDeck(deckNameOrPath, decksDir);
	} catch (err) {
		console.error((err as Error).message);
		process.exitCode = 1;
		return;
	}

	const editor = resolveEditor(config.editor);
	const proc = Bun.spawn([editor, deckPath], {
		stdio: ["inherit", "inherit", "inherit"],
	});
	await proc.exited;
}
