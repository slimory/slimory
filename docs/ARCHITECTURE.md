# Architecture

## Project Structure

```
slimory-lite/
├── src/
│   ├── main/              # Electron main process
│   ├── renderer/          # React renderer process (UI)
│   ├── preload/           # Electron preload scripts
│   └── prompts/           # AI prompt templates
├── resources/             # Native executables and assets
│   ├── GetSelectedText.exe    # C# text selection utility
│   ├── GetSelectedText.cs     # Source for text selection
│   ├── UpdateSelectedText.exe # C# text update utility
│   └── UpdateSelectedText.cs  # Source for text update
├── build/                 # Build assets (icons, etc.)
├── scripts/               # Build and utility scripts
│   ├── copy-prompts.js
│   ├── copy-webpilot-scripts.js
│   ├── copy-worklet.js
│   ├── copy-i18n.js
│   └── tests/             # Test scripts
├── docs/                  # Project documentation (iterflow)
├── dist/                  # Vite build output (renderer)
├── dist-electron/         # Compiled Electron code
├── release/               # Packaged application output
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript config (renderer)
├── tsconfig.main.json     # TypeScript config (main process)
├── electron-builder.yml   # Electron Builder config
└── package.json
```

## Process Architecture

### Main Process (`src/main/`)
- Application lifecycle management
- Global keyboard shortcut registration (Ctrl+Space, text selection hotkey)
- System tray integration
- IPC communication with renderer
- Native module coordination (GetSelectedText.exe, UpdateSelectedText.exe)
- Window management (chat window, selection menu)

### Renderer Process (`src/renderer/`)
- React-based UI
- Chat interface
- Settings panel
- Selection menu overlay
- AI response rendering (with KaTeX for math)

### Preload Scripts (`src/preload/`)
- Secure bridge between main and renderer processes
- Exposes safe IPC channels to renderer

### Native Components (`resources/`)
- **GetSelectedText.exe**: Uses Windows UI Automation API to detect and capture selected text from any application
- **UpdateSelectedText.exe**: Uses Windows UI Automation API to modify text in editable fields

## Data Flow

1. User selects text → uiohook-napi detects selection event
2. Main process spawns GetSelectedText.exe → captures selected text
3. Main process sends text to renderer via IPC
4. Renderer displays selection menu near cursor position
5. User picks action (translate, explain, ask) → renderer sends to AI provider
6. AI response rendered in chat/overlay UI

## Storage

All data persisted locally in `%APPDATA%/Roaming/slimory/`:
- `conversations.json` — Chat history
- `settings.json` — User preferences and provider config
- `scripts.json` — Browser automation scripts

## Key Design Decisions

- **Native C# executables** for text selection instead of pure Node.js — required for reliable Windows UI Automation access
- **koffi (FFI)** for additional native Windows API calls from Node.js
- **Local-only storage** — privacy-first, no cloud dependencies
- **Multi-provider architecture** — users bring their own API keys

## Supported Providers

The provider list, display name, base URL, and models are loaded from the pi-ai builtin catalog (`@earendil-works/pi-ai/providers/all`), which ships ~39 static providers (DeepSeek, Anthropic, OpenAI, Google/Gemini, Moonshot, Groq, Fireworks, MiniMax, OpenRouter, Z.AI Coding CN / GLM, Mistral, X.AI, NVIDIA, etc.). The app's provider key IS the pi-ai catalog id.

The dropdown's display order and labels are defined by `PROVIDER_OPTIONS` in `src/main/main.ts` (curated, e.g. `zai-coding-cn` → "Z.AI (China) / 智谱国内"). Any catalog provider not in that list is appended at the end with its pi-ai name.

`PROVIDER_CONFIGS` in `src/services/settingsStorage.ts` is used **only** to pick a preferred default model per provider (and a legacy baseUrl fallback for the raw-fetch path). Providers without an entry default to the first model in the pi-ai catalog.

Provider keys persisted before this change were migrated automatically on load:

| Legacy key | pi-ai id |
|------------|----------|
| glm | zai-coding-cn |
| moonshot | moonshotai |
| gemini | google |

The mapping also lives in `PI_AI_PROVIDER_MAP` (`src/services/chatService.ts`) and `PI_AI_PROVIDER_MAP_MAIN` (`src/main/main.ts`), which accept either a legacy key or a pi-ai id directly.

Users can customize the model for each provider in settings. Custom models must support tool calling.

## IPC Channels

Key IPC channels between main and renderer processes:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `verify-api-key` | Renderer → Main | Verify API key and model (tests with tool calling) |
| `save-settings` | Renderer → Main | Save API key, model, and update chat service |
| `get-provider-model` | Renderer → Main | Get custom model for a provider |
| `get-available-providers` | Renderer → Main | Get list of available providers |
| `get-all-settings` | Renderer → Main | Get all user settings |
