## Writing to the brain (`/workspace/extra/brain/`)

All brain files are markdown. Every file begins with a frontmatter block summarising its topic:

```
---
topic: One-line description of what this file covers
---
```

---

### `memories/` — conversation log

Every file in `memories/` is a timestamped recap of one session or event. Use it to capture what happened, what was decided, and anything that might be useful to search for later. These are not active context — they are a searchable archive.

**Filename pattern:** `YYYY-MM-DD-HH-MM-<slug>.md`
- Use the current date and time (24h)
- Slug is 2–5 words describing the session topic, hyphenated

**Content:** Brief. A few sentences or short bullets covering:
- What was discussed or decided
- Any lessons learned or behaviour the agent should remember
- Nothing that already lives in a project file

Write one memories file per session, at the end of the session.

---

### `projects/` — goal files

Goal files capture units of work scoped to a project and task. They live at:

```
projects/<project>/tasks/<task>/<unit>.goal.md
```

- `<project>` — the project name, camelCase or kebab-case. If the project cannot be identified from context, use `misc`.
- `<task>` — the overarching task or feature being worked on
- `<unit>.goal.md` — one file per discrete unit of work within that task

**Content:** What this unit of work is meant to accomplish, any constraints or decisions, and the outcome once complete. Overwrite (don't append) when the goal or outcome changes.

Create the directory path if it doesn't exist.
