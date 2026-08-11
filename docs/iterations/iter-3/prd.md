# Iteration 3 — Auto Copy Generated Text

## Goal

Let users automatically copy AI-generated text (translation, explanation, and custom actions) to the clipboard when generation completes, with a visual "Copied" confirmation toast in the message window.

## Linked User Requirements

- [Auto-copy generated text to clipboard with visual confirmation](../USER_REQUIREMENTS.md) (UI/UX)

## Features

1. **Settings checkbox** — "Auto copy generated text" checkbox in the Settings panel, only visible when word selection is enabled.
2. **Auto-copy on completion** — After text generation finishes (translate / explain / custom actions), copy the cleaned result to the system clipboard automatically.
3. **Copied toast** — Show a "Copied" toast at the top of the message window, centered relative to the actual `message-panel` width (not the window width).
4. **Local persistence** — Setting stored via `SettingsStorage` with IPC round-trip, default off (backward compatible).

## Scope

**In scope:**
- Settings storage + IPC for `autoCopyGenerated`
- Auto-copy logic in main process after streaming completes
- Toast rendering in `message.tsx`
- i18n keys in all 10 locales

**Out of scope:**
- Auto-copy for the full chat / agent (`chat`) mode and `modify`/`ask` commands (they replace the selected text or live in the chat window, not the message window)

## Risks

- Copying the raw streamed content may include markdown/thinking tags — mitigated by stripping `<think>` blocks and trimming.
- Toast position may be off-center while the panel width changes during streaming — mitigated by a ResizeObserver that recomputes the panel center.
- 10 locale files must stay in sync — a translation key set is added per locale.

## Success Criteria

- [ ] Toggling the checkbox persists across restart
- [ ] Translation/explain/custom actions auto-copy the result when enabled
- [ ] "Copied" toast appears top-center relative to the message panel
- [ ] Toast auto-hides after ~2s and is cleared when the message window hides
- [ ] Build passes (`npm run dev-build`)
