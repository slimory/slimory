# Iteration 4: Custom OpenAI/Anthropic Compatible Provider Support

## Goals

Enable users to configure custom OpenAI/Anthropic compatible API endpoints (private gateways, proxies, local inference servers like Ollama/vLLM) directly from the Settings UI.

## User Story

As a SlimoryLite user, I want to use custom OpenAI/Anthropic compatible API endpoints (such as private API gateways, reverse proxies, or local Ollama/vLLM servers) so that I can:
- Use my own infrastructure instead of official provider APIs
- Access region-restricted or private LLM deployments
- Test against local models without cloud dependencies

## Background

The underlying `@earendil-works/pi-ai` library already supports custom providers via `createProvider()` with custom `baseUrl`, models, and API types. However, the current SlimoryLite UI only exposes providers from the pi-ai builtin catalog. Users cannot add their own OpenAI/Anthropic compatible endpoints.

## Features

### 1. Custom Provider Options in Settings

Add two new provider options to the Provider dropdown:
- **"Custom OpenAI Compatible"** (provider id: `custom-openai`)
- **"Custom Anthropic Compatible"** (provider id: `custom-anthropic`)

These options should appear at the **end** of the provider list (after all pi-ai catalog providers).

### 2. Dynamic UI for Custom Providers

When a custom provider is selected:

**Show:**
- **Base URL input field** (text input, required)
  - Label: "Base URL"
  - Placeholder: e.g., `http://localhost:11434/v1` (for OpenAI), `http://localhost:8000` (for Anthropic)
  - Validation: Must be a valid URL format

**Change behavior:**
- **Model selector** switches from dropdown to text input
  - Label: "Model" 
  - Placeholder: e.g., `llama-3.1-8b`, `claude-sonnet-4`
  - Reason: Custom endpoints don't expose model lists via pi-ai catalog

### 3. Settings Persistence

Custom provider configurations must persist across app restarts:
- `provider`: `"custom-openai"` or `"custom-anthropic"`
- `baseUrl`: user-provided base URL
- `model`: user-provided model name
- `apiKey`: encrypted as usual

### 4. API Key Verification

API key verification should work with custom endpoints:
- Use pi-ai's `createProvider()` + `streamSimple()` to test the connection
- For custom OpenAI: use `openai-completions` API
- For custom Anthropic: use `anthropic-messages` API
- Show meaningful error messages if the endpoint is unreachable or returns errors

### 5. Chat Service Integration

`ChatService` must recognize custom provider ids and:
- Create a dynamic pi-ai provider using `createProvider()` with the user's baseUrl
- Register it in the pi-ai models instance
- Use it for streaming chat requests

## Technical Design

### Data Model Changes

**`settingsStorage.ts`:**
- Custom providers are stored just like builtin providers
- `baseUrl` field already exists in settings schema
- No schema changes needed

**`main.ts` changes:**
- `PROVIDER_OPTIONS` array: append custom provider entries
- `get-available-providers`: include custom providers with user-configured baseUrl
- `verify-api-key`: support custom providers via dynamic `createProvider()`

**`chatService.ts` changes:**
- Detect custom provider ids (`custom-openai`, `custom-anthropic`)
- Call `createProvider()` with user's baseUrl/model
- Use appropriate API type (`openai-completions` or `anthropic-messages`)

**`SettingsPanel.tsx` changes:**
- Detect selected provider type (builtin vs custom)
- Show/hide Base URL input conditionally
- Switch model selector rendering (dropdown vs text input)
- Load/save baseUrl along with other settings

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| User enters invalid baseUrl format | Add URL validation before saving |
| Custom endpoint doesn't support tool calling | Gracefully fall back to non-tool mode; show warning in verification |
| Model name typo (user mistypes model id) | Verification step will catch invalid model names |
| baseUrl without `/v1` suffix (OpenAI) | Document common patterns; verification will catch it |

## Out of Scope

- Auto-discovery of models from custom endpoints (would require `/v1/models` API call, not all endpoints support it)
- Multiple custom providers (only one custom OpenAI and one custom Anthropic at a time; user can switch back and forth)
- Advanced compat flags (`supportsDeveloperRole`, etc.) — use pi-ai defaults

## Success Metrics

- Users can successfully configure and use custom OpenAI/Anthropic compatible endpoints
- Settings persist correctly across app restarts
- API key verification works for custom endpoints
- Chat service uses custom providers without errors

## Related Requirements

- [x] Custom OpenAI/Anthropic compatible provider support (iter-4)
