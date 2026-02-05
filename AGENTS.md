# AI Agent Instructions – File Overview

This document lists all instruction files for AI coding assistants in this project.

## 📁 File Structure

```
workflow-system/
├── api/                           # NestJS Backend
│   ├── src/
│   ├── prisma/
│   └── test/
├── app/                           # Angular Frontend
│   ├── src/
│   └── public/
├── docs/
│   ├── MINIWORLD.md               # Business requirements
│   ├── ERR.md                     # Entity-Relationship model
│   ├── MAPPING.md                 # CTI mapping strategy
│   └── USER_STORIES.md            # User stories
├── CLAUDE.md                      # Main instructions (Claude Code, universal)
├── AGENTS.md                      # This file - overview
├── .claude/
│   ├── settings.json              # Claude Code configuration
│   └── commands.md                # Quick commands for Claude Code
├── .cursorrules                   # Cursor IDE rules
├── .windsurfrules                 # Windsurf/Codeium rules
├── .clinerules                    # Cline VSCode extension rules
└── .github/
    └── copilot-instructions.md    # GitHub Copilot instructions
```

---

## 🤖 Agent-Specific Files

### Claude Code (Terminal & IDE)

| File                    | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `CLAUDE.md`             | **Primary instructions** - tech stack, patterns, conventions |
| `.claude/settings.json` | Project configuration and metadata                           |
| `.claude/commands.md`   | Quick command templates                                      |

**Usage (Terminal):**

```bash
# Claude Code automatically reads CLAUDE.md
claude "Create the Prisma schema based on docs/ERR.md"
```

---

### Cursor IDE

| File           | Purpose                            |
| -------------- | ---------------------------------- |
| `.cursorrules` | Cursor-specific rules and patterns |

**Location:** Project root  
**Format:** Markdown with code examples

---

### Windsurf / Codeium

| File             | Purpose                           |
| ---------------- | --------------------------------- |
| `.windsurfrules` | Windsurf-specific condensed rules |

**Location:** Project root  
**Format:** Markdown, more concise than Cursor

---

### Cline (VSCode Extension)

| File          | Purpose                     |
| ------------- | --------------------------- |
| `.clinerules` | Cline-specific instructions |

**Location:** Project root  
**Format:** Markdown with task patterns

---

### GitHub Copilot

| File                              | Purpose                        |
| --------------------------------- | ------------------------------ |
| `.github/copilot-instructions.md` | Copilot workspace instructions |

**Location:** `.github/` directory  
**Format:** Markdown with code examples

---

## 📚 Documentation Files (Shared Context)

All agents should read these for domain understanding:

| File                   | Content                                           |
| ---------------------- | ------------------------------------------------- |
| `docs/MINIWORLD.md`    | Business requirements, roles, workflow rules      |
| `docs/ERR.md`          | Entity-Relationship model, constraints            |
| `docs/MAPPING.md`      | CTI implementation strategy, soft delete, indexes |
| `docs/USER_STORIES.md` | User stories                                      |

---

## 🔄 Keeping Files in Sync

When updating instructions:

1. **CLAUDE.md** is the source of truth
2. Update other rule files to match key patterns
3. Keep domain docs (MINIWORLD, ERR, MAPPING) current
4. Test with each agent after changes

### Key Sections to Keep Aligned

- Tech stack versions
- Naming conventions
- Code patterns (workflow, CTI, audit)
- Do's and Don'ts

---

## 💡 Best Practices

### For All Agents

- Point to documentation files for context
- Include concrete code examples
- Define forbidden patterns explicitly
- Keep conventions consistent across files

### Agent-Specific Tips

**Claude Code:**

- Use structured headings
- Include command references
- Provide task-oriented sections

**Cursor:**

- Focus on in-editor assistance
- Include common fix patterns
- Be explicit about file locations

**Copilot:**

- More code examples, less prose
- Focus on completion patterns
- Include test examples

**Cline:**

- Task-oriented structure
- Include execution patterns
- Define clear boundaries

---

## 🆕 Adding New Agents

1. Create rule file in appropriate location
2. Copy core content from CLAUDE.md
3. Adapt format to agent's preferences
4. Add to this overview
5. Test with sample prompts
