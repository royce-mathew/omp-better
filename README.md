# omp-better

Put `/better` in front of a prompt and omp-better rewrites it into a deeper, more actionable request grounded in your project. The result goes into your input box for you to review and edit before sending.

This is an OMP port of [pi-better](https://github.com/nicobailon/pi-better), built on the "Depth" prompt from Felix Rieseberg's [How to be more ambitious: A tutorial for humans with models](https://felixrieseberg.com/how-to-be-more-ambitious-a-tutorial-for-humans-with-models/#depth). It asks what a top professional would do, which raw material and methods they would use, and what would independently show the result is right. The helper first examines relevant project material and is instructed not to do the task itself.

## Install

Install from npm:

```bash
omp install npm:omp-better
```

Run `/reload` or restart OMP. The helper explicitly loads the extension, including when the parent loads it with `-e`.

`/better` uses OMP's `@smol` model role by default. Configure that role for the helper's environment, for example with `PI_SMOL_MODEL`, or set `BETTER_MODEL` to override the helper's model. Set `BETTER_THINKING` to override its thinking level:

```bash
export BETTER_MODEL="provider/model"
export BETTER_THINKING="high"
```

These environment variables must be available to the OMP process running the extension.

## Commands

| Command | Effect |
|---|---|
| `/better <prompt>` | Research and deepen a prompt in a background helper. |
| `/better` | Deepen the current task using the saved conversation. |
| `/better-cancel` | Stop the background helper. |
| `/better-boomerang <prompt>` | Rewrite in the current chat, then return to the previous point and put the prompt in the editor. Omit the prompt to deepen the current task. |

While `/better` runs, progress shows its current step and recent tools. Escape cancels the helper; a subsequent Escape can stop the main agent. Only one interactive helper runs at a time. When the rewrite is ready, anything already typed remains below it; nothing is sent automatically. In non-interactive modes, the result is posted instead of being placed in an editor.

An agent can also start an OMP `task` brief with `/better` to have the brief checked against the project before the child starts. The check preserves the brief's scope and addresses gaps a child could not resolve on its own. OMP's 30-second tool-call handler timeout can prevent a longer brief check from completing. See [how it works](docs/how-it-works.md#subagent-briefs).

## Safety

The helper is instructed to read and rewrite, not implement. It blocks tools other than `read`, `grep`, `glob`, `find`, and `bash`, but **the shell is not sandboxed**: bash commands can modify files or have other side effects. Do not treat the helper as a security boundary. `/better-boomerang` runs in the current chat and uses that chat's tools and permissions.

See [how it works](docs/how-it-works.md) for the helper process, cancellation, subagent briefs and limitations.
