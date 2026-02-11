# `.ai/` — Shared AI Skills

Single source of truth for agent skills used by **Cursor** and **Claude Code**.

## How it works

```mermaid
graph LR
    subgraph Create
        D["mkdir .ai/skills/my-skill"] --> E["Write SKILL.md"]
    end
    E --> A
    A[".ai/skills/"] -- symlink --> B[".cursor/skills/"]
    A -- symlink --> C[".claude/skills/"]
```

Both tools resolve their expected paths through symlinks, so every skill is defined once and visible everywhere.

## Directory layout

```
.ai/
└── skills/
    ├── check/SKILL.md
    ├── create-skill/SKILL.md
    ├── insight-backend-flow-doc-update/SKILL.md
    ├── pr-cleanup/SKILL.md
    ├── pr-description/SKILL.md
    └── session-learnings/SKILL.md

.cursor/skills  →  ../.ai/skills   (symlink)
.claude/skills  →  ../.ai/skills   (symlink)
```

## Adding a skill

Use the **create-skill** skill, or manually:

```bash
mkdir .ai/skills/my-skill
```

Then create `SKILL.md` with frontmatter (`name`, `description`) and step-by-step instructions. See `create-skill/SKILL.md` for the full template and guidelines.

It will appear in both Cursor and Claude Code automatically — no extra steps.

## Removing a skill

Delete the folder from `.ai/skills/`. Both symlinks reflect the change immediately.
