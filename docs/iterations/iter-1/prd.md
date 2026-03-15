# Iteration 1: Product Requirements

## Iteration Overview

| Field | Value |
|-------|-------|
| **Iteration** | 1 |
| **Name** | Custom Actions & More Providers |
| **Status** | 📋 Pending |
| **Duration** | 2026-03-11 to TBD |

---

## Goals

Based on user feedback (Sam), this iteration focuses on two improvements:

1. **Fully customizable selection menu actions** — Allow users to define their own actions with custom names and prompts, beyond the 4 predefined options (explain, translate, ask, modify).
2. **Additional LLM providers** — Add providers like Groq and Fireworks AI that offer free tiers or lower-cost API access, giving users more flexibility.

---

## User Requirements

This iteration addresses the following user requirements from [USER_REQUIREMENTS.md](../../USER_REQUIREMENTS.md):

- [ ] Fully customizable selection menu actions (user-defined name + prompt)
- [ ] Remove the 4-action limit on selection menu
- [ ] Additional LLM providers (Groq, Fireworks AI, etc.) for more flexibility

---

## Features to Deliver

### 1. Custom Selection Menu Actions
**Priority**: 🔴 P0

**Description**
Currently the selection menu is limited to 4 hardcoded actions (`explain`, `translate`, `ask`, `modify`) defined in `actionConfigMap` (MenuPopup.tsx). Users can only toggle these on/off in settings. This feature allows users to create fully custom actions with their own name and underlying prompt template.

**Current Architecture**
- `src/renderer/components/MenuPopup.tsx` — Renders menu with `actionConfigMap` (4 fixed entries)
- `src/services/settingsStorage.ts` — Stores `menuActions: string[]` (action IDs)
- `src/renderer/components/SettingsPanel.tsx` — Toggle UI for predefined actions
- `src/main/main.ts` — IPC handlers `get-menu-actions` / `save-menu-actions`

**Target Architecture**
- Keep the 4 built-in actions as defaults
- Add a `customActions` array in settings: `{ id, name, icon?, prompt }[]`
- MenuPopup renders both built-in and custom actions
- Custom actions send the user-defined prompt (with `{{text}}` placeholder) to the current LLM provider
- Settings panel gets a new section for CRUD management of custom actions

**Success Criteria**
- [ ] Users can create a custom action with a name and prompt template
- [ ] Users can edit and delete custom actions
- [ ] Custom actions appear in the selection menu alongside built-in actions
- [ ] Custom actions execute correctly, sending the prompt with selected text to the LLM
- [ ] No hardcoded limit on the number of menu actions
- [ ] Built-in actions continue to work as before

### 2. Additional LLM Providers
**Priority**: 🟡 P1

**Description**
Add Groq and Fireworks AI as provider options. Both use OpenAI-compatible API endpoints, so integration is straightforward — primarily adding entries to `PROVIDER_CONFIGS` in `settingsStorage.ts` and updating the Settings UI.

**Current Architecture**
- `src/services/settingsStorage.ts` — `PROVIDER_CONFIGS` with 6 providers, all using `/chat/completions`
- `src/services/chatService.ts` — Sends requests to `${baseUrl}/chat/completions` with Bearer auth
- `src/renderer/components/SettingsPanel.tsx` — Provider selection dropdown

**Success Criteria**
- [ ] Groq provider available with default model (e.g. `llama-3.3-70b-versatile`)
- [ ] Fireworks AI provider available with default model (e.g. `accounts/fireworks/models/llama-v3p1-70b-instruct`)
- [ ] Both providers work with existing streaming chat and tool-calling flows
- [ ] Provider icons/labels display correctly in Settings UI

---

## Technical Requirements

- All providers use OpenAI-compatible `/chat/completions` endpoint — no new API adapters needed
- Custom actions stored in `settings.json` alongside existing settings
- Custom action prompts support `{{text}}` placeholder for selected text
- Menu window may need height adjustment for additional items (scrollable if many)
- i18n: custom action names are user-defined, no translation needed; UI labels for the management section need i18n keys

---

## Out of Scope

- User-defined custom providers (arbitrary base URL + model) — future iteration
- Custom action icons (use a default icon for now)
- Sharing/importing/exporting custom actions
- macOS / Linux support

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Menu overflow with many custom actions | Medium | Add scrollable container with max-height |
| Groq/Fireworks API incompatibilities | Low | Both are OpenAI-compatible; test streaming + tool calls |
| Custom prompt injection via `{{text}}` | Low | Text is user-selected content, same trust model as existing actions |

---

**Created**: 2026-03-11
**Last Updated**: 2026-03-11
