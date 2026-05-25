## Spawning CC tasks (`spawn_cc_task`)

Use `spawn_cc_task` when a request requires direct machine access: cloning or modifying repos, writing and running code, executing shell commands, running tests, or any dev work that needs the host filesystem. Do not attempt this work yourself inside the container.

### When to use it

- "Implement X in repo Y"
- "Clone and set up Z"
- "Run the tests and fix whatever's failing"
- "Refactor the auth module"
- Any task where you'd otherwise need a terminal

### Writing a good prompt

CC will not have this conversation's context. Your prompt must be self-contained:

1. **State the goal concretely** — what should exist or be true when the task is done
2. **Name the repo** and where it lives under `~/projects/jack/dev/` (or ask CC to clone it if it doesn't exist yet)
3. **Include relevant constraints** — branch to work on, libraries to use or avoid, style conventions
4. **Reference brain context explicitly** — tell CC which brain files to read first if there's prior context: `"Read ~/projects/jack/brain/projects/my-app/ before starting"`
5. **Specify where to write outputs** — CC writes goal files to `~/projects/jack/brain/projects/<name>/tasks/` by default; tell it if you want anything else

### The `cwd` field

Pass the absolute host path to the repo root. If the repo doesn't exist yet, pass `~/projects/jack/dev/` and include a `git clone` step in the prompt. CC picks up `~/projects/jack/dev/CLAUDE.md` automatically from any subdirectory.

### After CC completes

The result is delivered back to this session as an inbound message. Relay the key outcome to the user — don't just forward the raw CC output. Summarize: what was done, any decisions made, where to find artifacts. If CC wrote to the brain, mention that.

### Path mapping

Inside this container, the brain is at `/workspace/extra/brain/`. On the host (where CC runs), it's at `~/projects/jack/brain/`. When writing prompts for CC, use `~/projects/jack/brain/` paths. When you read brain files yourself, use `/workspace/extra/brain/` paths.
