# Changelog

All notable changes to SlimoryLite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Custom OpenAI/Anthropic compatible provider support - users can now configure custom API endpoints (private gateways, proxies, local Ollama/vLLM servers) with custom baseUrl and model name input
- Base URL input field in Settings panel for custom providers
- "Custom OpenAI Compatible" and "Custom Anthropic Compatible" options in provider dropdown
- Auto-copy generated text to clipboard — new setting (checkbox) in the Settings panel; when enabled and word selection is on, translation/explanation/custom-action results are copied to the clipboard on completion
- "Copied" toast notification in the message window — shown below the message panel and centered on its actual width; when the panel fills the window, the toast falls back to the panel's inner bottom so it never draws outside the window
- Custom action icon picker with 90+ lucide-react icons
- Icon selection and display for custom actions in settings and menu
- Model configuration in API settings - users can customize the model used for AI conversations
- OpenRouter provider support
- Model verification using tool calling capability
- Optional Ctrl key requirement for menu popup - users can now configure the menu to only appear when holding Ctrl during text selection, reducing accidental triggers

### Changed
- Model selector switches from dropdown to text input when custom provider is selected (user must manually enter model name)
- Settings storage now accepts optional baseUrl parameter for custom providers
- ChatService dynamically creates custom providers using pi-ai's `createProvider()` API
- Upgraded `@earendil-works/pi-ai` from 0.74.2 to 0.84.1 — streaming/type imports moved to the `@earendil-works/pi-ai/compat` compatibility entrypoint and catalog reads (`getModels` → non-deprecated `getBuiltinModels`) moved to `@earendil-works/pi-ai/providers/all`; provider type tightened from `KnownProvider` to `BuiltinProvider`. Requires Node >= 22.19 at runtime (Electron 39.2.6 bundles 22.21.1)
- The provider list in Settings / onboarding is now loaded from the pi-ai builtin catalog (39 providers) instead of a hand-maintained list — provider name, base URL, and models all come from pi-ai; `PROVIDER_CONFIGS` now only supplies a preferred default model per provider
- Provider dropdown has a curated display order and labels (`PROVIDER_OPTIONS` in `main.ts`); any catalog provider not in that list is appended at the end
- Provider identity switched to pi-ai catalog ids (e.g. `glm`→`zai-coding-cn`, `moonshot`→`moonshotai`, `gemini`→`google`); previously saved settings are migrated automatically on load
- `saveSettings` IPC now accepts optional model parameter and optional baseUrl parameter
- API key verification uses `generateStreamingResponseWithTools` to verify model supports tools
- Settings panel: auto-copy checkbox is hidden when word selection is disabled (it depends on the selection flow)

### Fixed
- Model configuration now correctly persists and loads after app restart
- Fixed default model display in settings panel
- Fixed TypeScript error `Cannot find namespace 'NodeJS'` in `MessagePanel.tsx` by using `ReturnType<typeof setTimeout>` for the scroll-throttle timer

### Removed

## [0.1.0] - Initial Release

### Added
- Universal text selection across Windows applications
- AI-powered text explanation, translation, and Q&A
- Chat interface with web search capabilities
- Browser automation via natural language
- Text modification in editable fields
- Multi-provider support (OpenAI, Anthropic, DeepSeek, GLM, Moonshot, Gemini)
- Internationalization for 10 languages
- Privacy-first local storage with encrypted API keys
- Keyboard shortcuts (Ctrl+Space for chat)
