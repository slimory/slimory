# Iteration 1: Tasks

## Iteration Information

| Field | Value |
|-------|-------|
| **Iteration Number** | 1 |
| **Name** | Custom Actions & More Providers |
| **Status** | ✅ Completed |
| **Start Date** | 2026-03-11 |
| **End Date** | 2026-03-11 |
| **Completion** | 100% (7/7 tasks) |

---

## Task List

### T1.1 Extend data model for custom actions
- **Status**: ✅ Done
- **Priority**: 🔴 P0
- **Owner**: Claude
- **Completion Time**: 2026-03-11

**Acceptance Criteria**
- [x] `CustomAction` interface defined with `id`, `name`, `prompt` fields
- [x] `customActions` array added to default settings (empty by default)
- [x] CRUD methods implemented in settingsStorage
- [x] IPC handlers registered in main.ts for renderer access

**Related Files**: `src/services/settingsStorage.ts`, `src/main/main.ts`, `src/preload/preload.ts`, `src/renderer/vite-env.d.ts`

---

### T1.2 Render custom actions in MenuPopup
- **Status**: ✅ Done
- **Priority**: 🔴 P0
- **Owner**: Claude
- **Completion Time**: 2026-03-11

**Acceptance Criteria**
- [x] Custom actions rendered in menu after built-in actions
- [x] Each custom action displays its user-defined name
- [x] Menu is scrollable when items exceed available height
- [x] No hardcoded limit on number of actions

**Related Files**: `src/renderer/components/MenuPopup.tsx`, `src/renderer/components/MenuPopup.css`, `src/renderer/menu.tsx`, `src/main/menuWindow.ts`

---

### T1.3 Implement custom action execution
- **Status**: ✅ Done
- **Priority**: 🔴 P0
- **Owner**: Claude
- **Completion Time**: 2026-03-11

**Acceptance Criteria**
- [x] Clicking a custom action sends the templated prompt to the LLM
- [x] `{{text}}` placeholder correctly replaced with selected text
- [x] Response displayed in message window same as built-in actions
- [x] Errors handled gracefully (missing prompt, API failure)

**Related Files**: `src/main/main.ts`

---

### T1.4 Build Settings UI for custom action management
- **Status**: ✅ Done
- **Priority**: 🟡 P1
- **Owner**: Claude
- **Completion Time**: 2026-03-11

**Acceptance Criteria**
- [x] "Custom Actions" section visible in Settings panel
- [x] Users can add a new custom action (name + prompt)
- [x] Users can edit an existing custom action
- [x] Users can delete a custom action
- [x] Validation: name and prompt are required
- [x] i18n keys added for UI labels (en, zh)

**Related Files**: `src/renderer/components/SettingsPanel.tsx`, `src/renderer/i18n/locales/en.json`, `src/renderer/i18n/locales/zh.json`

---

### T1.5 Add Groq provider
- **Status**: ✅ Done
- **Priority**: 🟡 P1
- **Owner**: Claude
- **Completion Time**: 2026-03-11

**Acceptance Criteria**
- [x] Groq entry added to `PROVIDER_CONFIGS`
- [x] Groq appears in provider selection dropdown
- [x] Streaming chat works with Groq API (OpenAI-compatible)
- [x] API key can be saved and encrypted

**Related Files**: `src/services/settingsStorage.ts`, `src/services/chatService.ts`

---

### T1.6 Add Fireworks AI provider
- **Status**: ✅ Done
- **Priority**: 🟡 P1
- **Owner**: Claude
- **Completion Time**: 2026-03-11

**Acceptance Criteria**
- [x] Fireworks AI entry added to `PROVIDER_CONFIGS`
- [x] Fireworks AI appears in provider selection dropdown
- [x] Streaming chat works with Fireworks API (OpenAI-compatible)
- [x] API key can be saved and encrypted

**Related Files**: `src/services/settingsStorage.ts`, `src/services/chatService.ts`

---

### T1.7 Update Settings UI for new providers
- **Status**: ✅ Done
- **Priority**: 🟢 P2
- **Owner**: Claude
- **Completion Time**: 2026-03-11

**Acceptance Criteria**
- [x] Provider dropdown shows all 8 providers with correct labels
- [x] Switching to Groq/Fireworks updates baseUrl and model correctly
- [x] Thinking mode disabled for providers that don't support it
- [x] No UI regressions in existing provider selection

**Related Files**: `src/services/chatService.ts`

---

### T1.8 Add MiniMax and OpenRouter providers
- **Status**: ✅ Done
- **Priority**: 🟡 P1
- **Owner**: Claude
- **Completion Time**: 2026-03-15

**Acceptance Criteria**
- [x] MiniMax entry added to `PROVIDER_CONFIGS`
- [x] OpenRouter entry added to `PROVIDER_CONFIGS`
- [x] Both providers appear in provider selection dropdown
- [x] Streaming chat works with both APIs (OpenAI-compatible)
- [x] API key can be saved and encrypted

**Related Files**: `src/services/settingsStorage.ts`

---

### T1.9 Add custom model configuration
- **Status**: ✅ Done
- **Priority**: 🟡 P1
- **Owner**: Claude
- **Completion Time**: 2026-03-15

**Acceptance Criteria**
- [x] Model input field added in API settings section
- [x] Default model hint shown (e.g., "默认模型为 deepseek-chat")
- [x] Custom model saved per provider in settings storage
- [x] Custom model loaded and used when app starts
- [x] Model persisted across app restarts

**Related Files**: `src/services/settingsStorage.ts`, `src/main/main.ts`, `src/renderer/components/SettingsPanel.tsx`

---

### T1.10 Model verification using tool calling
- **Status**: ✅ Done
- **Priority**: 🟡 P1
- **Owner**: Claude
- **Completion Time**: 2026-03-15

**Acceptance Criteria**
- [x] API key verification uses `generateStreamingResponseWithTools` instead of basic streaming
- [x] Test with a simple tool call to verify model supports tools
- [x] Full error message displayed in settings UI on verification failure
- [x] Description updated to indicate model must support tool calling

**Related Files**: `src/main/main.ts`, `src/renderer/components/SettingsPanel.tsx`, `src/renderer/i18n/locales/*.json`

---

## Iteration Summary

### Completion Status
- **Total Tasks**: 10
- **Completed**: 10
- **In Progress**: 0
- **Pending**: 0
- **Blocked**: 0

### Main Achievements
- Fully customizable selection menu actions with user-defined name and prompt template
- Custom actions CRUD in Settings panel with i18n support (all 10 languages)
- Added Groq, Fireworks AI, MiniMax, and OpenRouter as LLM providers (10 total)
- Custom model configuration per provider in settings
- Model verification using tool calling capability
- Thinking mode compatibility for new providers

---

**Created**: 2026-03-11
**Last Updated**: 2026-03-15
