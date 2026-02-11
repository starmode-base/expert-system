---
name: create-skill
description: Scaffold a new agent skill in .ai/skills/. Use when the user asks to create, add, or scaffold a skill.
---

# Create Skill

Scaffold a new skill inside `.ai/skills/` so it is automatically available to both Cursor and Claude Code via symlinks.

## Steps

1. **Choose a name.** Use lowercase kebab-case (e.g. `my-new-skill`). If the user didn't provide a name, derive one from the skill's purpose.

2. **Create the directory and file:**

```bash
mkdir -p .ai/skills/<skill-name>
```

Then create `.ai/skills/<skill-name>/SKILL.md`.

3. **Write the SKILL.md** using the template below.

4. **Verify** the skill is visible through both symlinks:

```bash
ls .cursor/skills/<skill-name>/SKILL.md .claude/skills/<skill-name>/SKILL.md
```

## SKILL.md template

Every skill file follows this structure:

```markdown
---
name: <skill-name>
description: <One sentence. What it does and when to use it.>
---

# <Skill Title>

<One-line summary of the skill's purpose.>

## Steps

1. **Step one** — what to do first.
2. **Step two** — what to do next.
3. ...
```

## Frontmatter rules

| Field | Required | Format |
|-------|----------|--------|
| `name` | Yes | Matches the folder name, kebab-case |
| `description` | Yes | Single sentence. Starts with a verb. Ends with a trigger phrase ("Use when ...") |

## Writing guidelines

- Keep instructions actionable — tell the agent *what to do*, not background theory.
- Include bash snippets or code examples when the correct invocation is non-obvious.
- Target 15–60 lines. Short skills are easier for agents to follow.
- Don't duplicate guidance that already exists in `AGENTS.md` or other skills.
