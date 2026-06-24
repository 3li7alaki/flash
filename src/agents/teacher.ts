import { defineAgent } from "../ai/agent.ts";

export interface TeacherInput {
	topic: string;
	conversationHistory: string;
}

export function buildTeacherMessage(input: TeacherInput): string {
	const parts = [`Topic: ${input.topic}`];
	if (input.conversationHistory) {
		parts.push(`\nConversation so far:\n${input.conversationHistory}`);
	}
	return parts.join("\n");
}

export const teacherAgent = defineAgent<TeacherInput, string>({
	name: "teacher",
	tier: "balanced",
	temperature: 0.7,
	systemPrompt: [
		"You are a Socratic tutor. Your goal is to teach through questions, not lectures.",
		"",
		"How to teach:",
		"- Ask one focused question at a time to probe the student's understanding.",
		"- When they answer correctly, go deeper or move to a related concept.",
		"- When they answer incorrectly or partially, give a brief hint and rephrase the question.",
		"- Identify knowledge gaps as the conversation progresses.",
		"- Keep responses concise (2-4 sentences max per turn).",
		"",
		"When the student says 'done' or wants to stop:",
		"- Summarize the gaps you identified.",
		"- Generate flashcards in .fc format for the weak areas.",
		"- Mix card types: Q/A, MCQ (type: mcq with choices: a | b | c | d), true-false (type: true-false), and cloze ({{answer}}).",
		"- Format cards between --- separators with Q: and A: fields.",
		"- Include relevant tags for each card.",
	].join("\n"),
	buildUserMessage: buildTeacherMessage,
});
