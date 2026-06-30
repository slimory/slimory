# CLAUDE.md — Agent Workflow Instructions

This file defines how the AI agent operates in this project. Read it on every session start.

---

## Project Context

SlimoryLite is an Electron + React desktop application that provides AI assistance across all Windows applications through text selection. All project knowledge lives in documentation — read docs first, update docs when you make changes.

**Read on session start** (essential context):

1. `docs/PROJECT.md` — Project overview, tech stack, key features
2. `docs/USER_REQUIREMENTS.md` — Existing user needs (needed to identify duplicates and track progress)
3. `docs/iterations/README.md` — Current iteration status and what's in flight

**Read on demand** (when entering implementation):

4. `docs/ARCHITECTURE.md` — Read before making technical decisions or writing code
5. `docs/CONTRIBUTING.md` — Read before claiming tasks or committing code

---

## ⚠️ Mandatory Checklist — DO NOT SKIP

Before and after every implementation, verify these items. Skipping any step is a workflow violation.

**BEFORE writing any code:**
- [ ] Requirement recorded in `docs/USER_REQUIREMENTS.md`
- [ ] Iteration planned: `prd.md` + `tasks.md` exist (create new iter-N if needed)
- [ ] `docs/iterations/README.md` updated with iteration entry
- [ ] Plan presented to user and approved

**AFTER implementation is complete:**
- [ ] `docs/CHANGELOG.md` updated
- [ ] `docs/ARCHITECTURE.md` updated (if architecture/directory/IPC changed)
- [ ] `docs/PROJECT.md` updated (if tech stack changed)
- [ ] `docs/USER_REQUIREMENTS.md` requirements checked off
- [ ] Iteration `tasks.md` tasks marked completed
- [ ] `docs/iterations/README.md` completion percentage updated
- [ ] `CLAUDE.md` Lessons Learned updated (if reusable pitfall discovered)

---

## Core Principle: Document-Driven Development

Every change starts from documentation and ends with documentation updates. The flow is:

```
User Requirement → Documentation → Implementation → Documentation Update
```

Never write code without a documented requirement and a planned task.

---

## Workflow: From Conversation to Delivery

### Phase 1: Requirement Gathering (PM Mode)

> **⛔ STOP: Do NOT write code until the requirement is recorded in `docs/USER_REQUIREMENTS.md` and the user has confirmed.**

When a user describes a need, feature idea, bug, or improvement, treat it as a **potential new requirement**. Before any implementation:

1. **Clarify the requirement** — Ask questions to understand:
   - What problem does the user want to solve?
   - What is the expected behavior?
   - What are the edge cases?
   - What is the priority (P0–P3)?
   - Are there any constraints or preferences?

2. **Confirm understanding** — Summarize the requirement back to the user in this format:
   ```
   Requirement: [one-line description from user perspective]
   Background: [why this is needed]
   Acceptance Criteria:
   - [ ] Criterion 1
   - [ ] Criterion 2
   Priority: P0/P1/P2/P3
   ```
   Wait for user confirmation before proceeding.

3. **Record the requirement** — Append to `docs/USER_REQUIREMENTS.md`:
   ```
   [ ] YYYY-MM-DD [Requirement description from user perspective]
   ```
   Place it under the appropriate category. Create a new category section if none fits.

### Phase 2: Iteration Planning

After requirements are confirmed and recorded:

1. **Check current iteration** — Read `docs/iterations/README.md` to find the current iteration status.

2. **Decide iteration strategy**:
   - If the current iteration is in progress and has capacity → add tasks to it
   - If the current iteration is completed or full → create a new iteration

3. **Create/update iteration documents**:
   - **prd.md** — Define goals, link to user requirements, describe features, identify risks
   - **tasks.md** — Break features into tasks with priorities, acceptance criteria, dependencies, and effort estimates

4. **Update `docs/iterations/README.md`** — Add or update the iteration entry in the overview table.

5. **Present the plan to the user** — Show the task breakdown and get approval before starting implementation.

### Phase 3: Implementation

> **⛔ STOP: Do NOT start coding until `prd.md` and `tasks.md` exist for the current iteration and the user has approved the plan.**

Execute tasks following `docs/CONTRIBUTING.md`:

1. **Claim a task** — Set owner to "Agent-Claude", status to "🔄 In Progress", start time to today.

2. **Implement** — Follow the code conventions in CONTRIBUTING.md:
   - TypeScript strict mode, explicit types
   - File naming: `kebab-case.ts` for utilities, `PascalCase.tsx` for React components
   - IPC changes: update preload whitelist, add handler, document in ARCHITECTURE.md

3. **Verify quality gates**:
   - Code compiles without errors (`npm run dev-build`)
   - No regressions in existing functionality
   - All acceptance criteria met

4. **Complete the task** — Update tasks.md: status to "✅ Completed", fill implementation notes and related files.

### Phase 4: Documentation Sync

> **⛔ STOP: Do NOT consider the task done until every applicable row below has been checked and updated.**

After implementation, update all affected documentation:

| What happened | What to update |
|---------------|----------------|
| Feature added/changed | `docs/CHANGELOG.md`, iteration `tasks.md` |
| Architecture decision made | `docs/ARCHITECTURE.md` (add ADR) |
| Directory structure changed | `docs/ARCHITECTURE.md` |
| User requirement fulfilled | `docs/USER_REQUIREMENTS.md` (check it off) |
| Iteration finished | `docs/iterations/README.md` |
| Tech stack changed | `docs/PROJECT.md` |
| Discovered a pitfall or better approach | `CLAUDE.md` → Lessons Learned section |

---

## Session Start Checklist

On every new session:

1. Read this file (CLAUDE.md)
2. Read `docs/iterations/README.md` to check current iteration status
3. Read the current iteration's `tasks.md` to see what's in progress or pending
4. If there are in-progress tasks from a previous session, check their status and continue
5. If all tasks are done, inform the user and wait for new requirements

---

## Conversation Guidelines

- Communicate in the same language the user uses.
- When the user describes something that sounds like a new requirement, enter **PM Mode** (Phase 1) — don't jump to coding.
- When the user explicitly asks to fix a quick bug or make a trivial change that doesn't warrant a full iteration cycle, use judgment: small fixes can be done directly, but still update `docs/CHANGELOG.md` and relevant docs.
- Always confirm the plan with the user before writing code.
- When presenting options, be concise and decisive — recommend the best approach with reasoning.
- All documentation files (`docs/`, `CLAUDE.md`, iteration docs, etc.) must be written in English.

---

## SlimoryLite-Specific Guidelines

### Electron Architecture
- **Main Process** (`src/main/`): System integration, global shortcuts, IPC handlers
- **Renderer Process** (`src/renderer/`): React UI components
- **Preload** (`src/preload/`): Secure IPC bridge between main and renderer
- **Services** (`src/services/`): Business logic shared across processes

### IPC Communication
- All IPC channels must be whitelisted in `src/preload/preload.ts`
- Use `window.electron.invoke()` in renderer, `ipcMain.handle()` in main
- Document new IPC channels in `docs/ARCHITECTURE.md`

### Native Integration
- Windows-specific features use `koffi` for FFI or C# executables
- Text selection: `GetSelectedText.exe` (UI Automation)
- Text modification: `UpdateSelectedText.exe` (UI Automation)
- Native executables live in `resources/` and are copied to `extraResources` during build

### Build Process
- Development: `npm run electron:dev` (Vite + Electron)
- Production: `npm run build` (TypeScript → Vite → electron-builder)
- Copy scripts run after build: prompts, webpilot scripts, worklet, i18n files

### Testing
- Manual testing required for UI Automation features
- Test commands: `npm run test:websearch`, `npm run test:operationgenerator`
- Always test in a real Windows environment, not just dev mode

---

## Lessons Learned

Reusable patterns and general principles. Only record issues likely to recur in future sessions, not one-off bugs already fixed in code.

### Electron & Vite
- When adding new dependencies, check if they require Node.js APIs not available in renderer process
- Externalize native modules in `vite.config.ts` to avoid bundling issues
- Use `nodeIntegration: false` and `contextIsolation: true` for security

### Windows UI Automation
- UI Automation APIs are asynchronous and can fail if target window loses focus
- Always add timeout handling for native executable calls
- Test text selection/modification in multiple applications (browsers, Office, IDEs)

### IPC Best Practices
- Keep IPC payloads small — avoid sending large objects or binary data
- Use structured error responses: `{ success: boolean, data?: any, error?: string }`
- Always validate IPC inputs in main process handlers

### Internationalization
- All user-facing strings must use `t()` from react-i18next
- Add new keys to all locale files in `src/renderer/i18n/locales/`
- Use namespaces to organize translation keys by feature

---

## Quick Reference

```
docs/
├── PROJECT.md              # Project vision & tech stack
├── USER_REQUIREMENTS.md    # All user requirements (checkbox list)
├── ARCHITECTURE.md         # Technical design & ADRs
├── CONTRIBUTING.md         # Code conventions & task workflow
├── CHANGELOG.md            # Version history
└── iterations/
    ├── README.md           # Iteration overview & status
    └── iter-N/
        ├── prd.md          # Iteration product requirements
        └── tasks.md        # Task list & tracking

src/
├── main/                   # Electron main process
├── renderer/               # React UI
├── preload/                # IPC bridge
└── services/               # Shared business logic

resources/                  # Native executables & assets
```

---

**Last Updated**: 2026-03-11
