import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import extension from "./index.ts";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

// Same setup as progress.test.ts's withFakeHelper: the helper is fixtures/fake-pi.mjs, which replies once the gate exists.
async function withFakeHelper(body: (setup: { dir: string; session: string; gate: string; helperArgs: () => string[] }) => Promise<void>): Promise<void> {
	const dir = mkdtempSync(join(tmpdir(), "pb-brief-"));
	const session = join(dir, "session.jsonl");
	writeFileSync(session, "{}\n");
	const script = process.argv[1];
	const temp = process.env.TMPDIR;
	process.argv[1] = fileURLToPath(new URL("./fixtures/fake-pi.mjs", import.meta.url));
	process.env.PI_BETTER_TEST_GATE = join(dir, "gate");
	process.env.PI_BETTER_TEST_ARGS = join(dir, "helper-args.json");
	process.env.TMPDIR = dir;
	try {
		await body({ dir, session, gate: process.env.PI_BETTER_TEST_GATE, helperArgs: () => JSON.parse(readFileSync(join(dir, "helper-args.json"), "utf8")) });
	} finally {
		process.argv[1] = script;
		delete process.env.PI_BETTER_TEST_GATE;
		delete process.env.PI_BETTER_TEST_ARGS;
		if (temp === undefined) delete process.env.TMPDIR;
		else process.env.TMPDIR = temp;
		rmSync(dir, { recursive: true, force: true });
	}
}

function load() {
	const handlers: Record<string, (event: unknown, ctx: unknown) => unknown> = {};
	const entries: Array<{ type: string; data: unknown }> = [];
	const api = { registerCommand() {}, on: (name: string, handler: (event: unknown, ctx: unknown) => unknown) => (handlers[name] = handler), appendEntry: (type: string, data: unknown) => entries.push({ type, data }) };
	extension(api as unknown as ExtensionAPI);
	return { handlers, entries };
}

const context = (dir: string, session: string) =>
	({ cwd: dir, sessionManager: { getSessionFile: () => session }, ui: { setStatus() {}, setWidget() {} } });

test("a marked flat task receives a checked brief and an isolated session fork", { timeout: 10_000 }, () =>
	withFakeHelper(async ({ dir, session, gate, helperArgs }) => {
		const { handlers, entries } = load();
		writeFileSync(gate, "");
		const input = { agent: "worker", task: "/better add a name flag", solutionSpace: "one fix" };
		const result = await handlers.tool_call({ type: "tool_call", toolName: "task", toolCallId: "c1", input }, context(dir, session));
		assert.deepEqual(result, { input: { ...input, task: "Add --name to run.sh and prove it with ./run.sh --name Ann." } });
		assert.deepEqual(entries, [{ type: "better", data: {
			prompt: "add a name flag",
			improved: "Add --name to run.sh and prove it with ./run.sh --name Ann.",
			reply: "(1) a\n(2) b\n(3) c\n(4) d\n\n<improved-prompt>\nAdd --name to run.sh and prove it with ./run.sh --name Ann.\n</improved-prompt>",
			subagent: true,
		} }]);
		const args = helperArgs();
		assert.equal(args[args.indexOf("--fork") + 1], session);
		assert.match(args[args.indexOf("-e") + 1], /index\.ts$/);
		assert.equal(args[args.indexOf("--model") + 1], "@smol");
		assert.match(args.at(-1)!, /## Brief to check\n\nadd a name flag\n/);
	}),
);

test("a batch revises marked tasks without changing unmarked tasks or shared context", { timeout: 10_000 }, () =>
	withFakeHelper(async ({ dir, session, gate }) => {
		const { handlers } = load();
		writeFileSync(gate, "");
		const input = { context: "Shared context", tasks: [
			{ task: "/better add a name flag", solutionSpace: "one fix" },
			{ task: "review the diff", agent: "reviewer", solutionSpace: "open review" },
		] };
		const result = await handlers.tool_call({ type: "tool_call", toolName: "task", toolCallId: "c1", input }, context(dir, session));
		assert.deepEqual(result, { input: { context: "Shared context", tasks: [
			{ task: "Add --name to run.sh and prove it with ./run.sh --name Ann.", solutionSpace: "one fix" },
			{ task: "review the diff", agent: "reviewer", solutionSpace: "open review" },
		] } });
	}),
);

test("switching sessions cancels a pending brief check and removes its fork", { timeout: 10_000 }, () =>
	withFakeHelper(async ({ dir, session }) => {
		const { handlers, entries } = load();
		const ctx = context(dir, session);
		const input = { agent: "worker", task: "/better add a name flag", solutionSpace: "one fix" };
		const start = Promise.resolve(handlers.tool_call({ type: "tool_call", toolName: "task", toolCallId: "c1", input }, ctx));
		assert.equal(readdirSync(dir).filter(name => name.startsWith("omp-better-")).length, 1);
		handlers.session_before_switch({ type: "session_before_switch" }, ctx);
		await assert.rejects(start, /cancelled, so the subagent didn't start/);
		assert.deepEqual(readdirSync(dir).filter(name => name.startsWith("omp-better-")), []);
		assert.deepEqual(entries, []);
	}),
);
