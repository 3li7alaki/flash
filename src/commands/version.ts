import { version } from "../../package.json";

export async function versionCommand(
	_args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	console.log(`fc v${version}`);
}
