import * as prompts from "@clack/prompts";
import { teacherAgent } from "../agents/teacher.ts";
import { createModelForTier } from "../ai/client.ts";

export async function learnCommand(
	args: string[],
	_flags: Record<string, string | boolean>,
): Promise<void> {
	const topic = args.join(" ");
	if (!topic) {
		console.error("Usage: flash learn <topic>");
		process.exitCode = 1;
		return;
	}

	const model = await createModelForTier(teacherAgent.definition.tier);
	const history: Array<{ role: "ai" | "user"; text: string }> = [];

	prompts.intro(`Learning: ${topic}`);

	// Initial question from the teacher
	const initial = await teacherAgent.run(model, {
		topic,
		conversationHistory: "",
	});
	history.push({ role: "ai", text: initial });
	prompts.note(initial);

	// Conversation loop
	while (true) {
		const answer = await prompts.text({
			message: "Your answer (type 'done' to finish):",
		});

		if (prompts.isCancel(answer)) {
			break;
		}

		const userText = String(answer).trim();
		if (userText.toLowerCase() === "done") {
			// Ask teacher to summarize gaps and generate cards
			history.push({ role: "user", text: "done" });
			const conversationHistory = history
				.map((h) => `${h.role === "ai" ? "Teacher" : "Student"}: ${h.text}`)
				.join("\n\n");

			const summary = await teacherAgent.run(model, {
				topic,
				conversationHistory: `${conversationHistory}\n\nThe student is done. Summarize the knowledge gaps and generate .fc cards for weak areas.`,
			});
			prompts.note(summary, "Session Summary & Generated Cards");
			break;
		}

		history.push({ role: "user", text: userText });
		const conversationHistory = history
			.map((h) => `${h.role === "ai" ? "Teacher" : "Student"}: ${h.text}`)
			.join("\n\n");

		const response = await teacherAgent.run(model, {
			topic,
			conversationHistory,
		});
		history.push({ role: "ai", text: response });
		prompts.note(response);
	}

	prompts.outro("Learning session complete.");
}
