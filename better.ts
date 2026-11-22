const OPEN = "<improved-prompt>";
const CLOSE = "</improved-prompt>";
// The opening tag counts only on a line of its own; the prompt itself may mention the tag inline.
const OPEN_LINE = `\n${OPEN}\n`;

const returnSection = (last: number, what: string) => `## Return

Give answers (1) to (${last}) in your reply, each starting a new line with its number, like "(1)". Then end it with the ${what}, complete, between these two lines and nothing after them:

${OPEN}
the ${what}
${CLOSE}`;

export const HELPER_ENV = "PI_BETTER_HELPER";
// Bash is available for investigation, but is not sandboxed.
const HELPER_TOOLS = ["read", "grep", "glob", "find", "bash"];
const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max", "auto"];

// Keep the normal tool catalog for prompt caching and block other calls.
export function helperToolBlock(toolName: string, activeTools: string[]): { block: true; reason: string } | undefined {
	if (HELPER_TOOLS.includes(toolName)) return undefined;
	const usable = HELPER_TOOLS.filter((tool) => activeTools.includes(tool)).join(", ");
	return { block: true, reason: `/better's helper only reads and rewrites, so ${toolName} is off.${usable ? ` Use ${usable}.` : ""}` };
}

export function helperModelArgs(setting: unknown, _chatModel: string | undefined, _chatThinking: string | undefined): string[] {
	if (setting !== undefined && (typeof setting !== "object" || setting === null || Array.isArray(setting))) {
		throw new Error("Better configuration must be an object.");
	}
	const { model = "@smol", thinking } = (setting ?? {}) as { model?: unknown; thinking?: unknown };
	if (typeof model !== "string" || model.trim() === "") {
		throw new Error("BETTER_MODEL must be a non-empty model or role.");
	}
	if (thinking !== undefined && (typeof thinking !== "string" || !THINKING_LEVELS.includes(thinking))) {
		throw new Error(`BETTER_THINKING must be one of ${THINKING_LEVELS.join(", ")}.`);
	}
	return ["--model", model, ...(typeof thinking === "string" ? ["--thinking", thinking] : [])];
}

export function buildHelperTask(helper: string, prompt: string): string {
	return [
		helper.trim(),
		`## Prompt to deepen\n\n${prompt || "None given: deepen the task in progress in the conversation so far, including any feedback I gave on work already done."}`,
		returnSection(4, "rewritten prompt"),
	].join("\n\n");
}

// A subagent brief marked "/better" gets brief.md's check instead of Depth: an agent's brief is long and its scope
// is decided, so what it lacks is what the subagent can't see, not depth.
export const BRIEF_MARK = /^\/better(?=\s|$)/;

export function buildBriefTask(check: string, brief: string): string {
	return [
		check.trim(),
		`## Brief to check\n\n${brief}`,
		returnSection(3, "brief"),
	].join("\n\n");
}

export function parseMarkedPrompt(reply: string): string {
	const end = reply.lastIndexOf(CLOSE);
	const before = `\n${reply.slice(0, Math.max(end, 0))}`;
	const start = before.lastIndexOf(OPEN_LINE);
	if (end < 0 || start < 0) throw new Error(`The reply has no ${OPEN} … ${CLOSE} block.`);
	const prompt = before.slice(start + OPEN_LINE.length).trim();
	if (!prompt) throw new Error(`The reply's ${OPEN} block is empty.`);
	return prompt;
}

export function replyProgress(text: string): { answered: number; writingPrompt: boolean } {
	let answered = 0;
	for (const [, n] of text.matchAll(/^\W*\(([1-4])\)/gm)) answered = Math.max(answered, Number(n));
	return { answered, writingPrompt: `\n${text}`.includes(OPEN_LINE) };
}

export function helperExitError(code: number | null, signal: string | null, stderr: string): string {
	const how = code === null ? `was stopped by ${signal}` : `exited with code ${code}`;
	const tail = stderr.trim().split("\n").slice(-3).join(" ");
	return tail ? `The helper ${how}: ${tail}` : `The helper ${how} without printing an error`;
}
