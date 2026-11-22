# How omp-better works

Both commands send [helper.md](../helper.md), a version of Felix Rieseberg's Depth prompt that first asks the model to inspect relevant material and not do the task. The response ends with the rewritten prompt between `<improved-prompt>` and `</improved-prompt>`. The last marked block supplies the result.

## `/better`

The extension starts a separate OMP process in the background. When the current session has been saved, the helper forks it into a temporary session directory; otherwise it starts fresh and needs an explicit prompt. Messages sent after the fork are not included. The temporary session is removed after the helper finishes or is cancelled.

The helper defaults to the `@smol` model role, rather than the current chat's model. Set `BETTER_MODEL` to select another model and `BETTER_THINKING` to select a thinking level. The helper inherits environment variables from the OMP process. Because its model may differ from the chat's, do not assume it reuses the chat's prompt cache.

The helper loads OMP's normal extensions and settings and explicitly loads omp-better for its tool-call restrictions. Session-start effects of other extensions may also occur in the helper.

The helper is instructed to read and rewrite without performing the requested work. Its extension blocks calls to tools other than `read`, `grep`, `glob`, `find`, and `bash`. **This is not a sandbox:** bash can write files, execute commands and otherwise change the environment. Prompt instructions and tool-call filtering are not a security boundary.

Compact progress is the default, displaying a six-step meter based on the numbered answers and the marked prompt, along with recent tool calls. While the helper runs, `/better-activity` toggles an expanded live view of recent tool commands, arguments and text results. Use `/better-activity next` and `/better-activity prev` to navigate its 12-line pages. The view retains the latest 50 tools and truncates individual argument and result fields at 2,000 characters. It is sanitized but can still contain sensitive information; take care when sharing your screen. It disappears when the helper finishes. On success, the full reply is saved as a `better` session entry and the extracted prompt is placed in the editor above any existing draft. The user must send it. In print, JSON and RPC modes, where an editor draft cannot safely be preserved, the result is posted instead; print and JSON mode wait for the helper.

Only one interactive `/better` runs at a time. Escape or `/better-cancel` stops it; switching sessions or shutting down also cancels it. The helper has a 20-minute limit. If its response is missing the marked block or the block is empty, the response is retained and an error identifies where to find it.

## `/better-boomerang`

The current chat answers the same Depth task as a hidden message. Once the turn ends, the extension extracts the prompt and navigates back to the prior session entry without a summary. The rewrite remains reachable in the session tree, while the prompt is handed back to the user. If the rewrite cannot be parsed or the jump is cancelled, the rewrite remains available in the chat.

Unlike `/better`, this uses the current chat's model, tools and permissions; the helper's tool restrictions do not apply. The model is instructed to research and rewrite rather than implement, but that instruction does not enforce read-only behavior.

## Subagent briefs

When an OMP `task` call starts a brief with `/better`, the extension checks the brief before starting the child, for both single and batch calls. [brief.md](../brief.md) asks the helper to read the brief from the child's perspective, check relevant paths and commands, and fill gaps without expanding the assigned scope. A brief that needs no changes can be returned unchanged.

The check runs in the child's working directory and uses the same helper model and tool restrictions as `/better`. If the check is cancelled, times out or fails, the affected child is not started with an unchecked brief. The status shows how many briefs are being checked.

OMP limits tool-call handlers to 30 seconds, so a brief check that takes longer can time out before the helper's own 20-minute limit.

## Limitations

- The helper cannot ask questions interactively; it works from the prompt, copied session and available material.
- Its shell is not sandboxed, and the boomerang command has the current chat's permissions.
- The helper gets its own OMP process configuration, not necessarily every flag passed to the parent.
- A saved-session copy reflects the session at the time the helper starts, not messages that arrive later.
- Running several brief checks can start several helpers; each consumes its own model and tool resources.
