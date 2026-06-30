# Contributing to SlimoryLite

## Development Setup

### Prerequisites
- Node.js 18+
- npm

### Getting Started
```bash
npm install
npm run electron:dev
```

## Iterflow Workflow

All development work is organized through iterations. See `docs/iterations/README.md` for the current state.

### Commands
- `/iterflow` — Resume current iteration, pick up next task
- `/iterflow new` — Create a new iteration
- `/iterflow status` — Check iteration progress
- `/iterflow req` — List unresolved user requirements
- `/iterflow init` — Bootstrap doc structure (already done)

### Task Lifecycle
1. Find a pending task in the current iteration's `tasks.md`
2. Set status to "🔄 In Progress" and assign yourself
3. Read the iteration's `prd.md` for context
4. Implement the task following acceptance criteria
5. Update task status to "✅ Done", fill Implementation Notes and Related Files
6. Update relevant documentation

### Documentation Rules
- **Read before coding**: Always read relevant docs before starting work
- **Update after coding**: Always update docs after completing work
- **Single source of truth**: Each piece of info lives in one place only
- **Iteration-scoped**: All work happens within an iteration

### Documentation Map
| Document | Purpose |
|----------|---------|
| `docs/PROJECT.md` | Project overview, tech stack, target users |
| `docs/ARCHITECTURE.md` | System architecture and project structure |
| `docs/USER_REQUIREMENTS.md` | All user requirements with status |
| `docs/CHANGELOG.md` | Version history and changes |
| `docs/CONTRIBUTING.md` | This file — how to contribute |
| `docs/iterations/README.md` | Iteration management hub |
| `docs/iterations/iter-N/prd.md` | Iteration goals and features |
| `docs/iterations/iter-N/tasks.md` | Task breakdown and tracking |

## Code Standards
- TypeScript for all new code
- Follow existing code style and patterns
- Test changes with `npm run electron:dev` before submitting
