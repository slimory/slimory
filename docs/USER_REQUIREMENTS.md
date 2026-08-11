# User Requirements

> Living document of all user requirements. Check off items as they are addressed by iterations.
> Each requirement should link to the iteration that implements it.

## Text Selection & AI Assistance
- [x] Universal text selection across all Windows applications (v0.1.0)
- [x] AI-powered explanations of selected text (v0.1.0)
- [x] AI-powered translation of selected text (v0.1.0)
- [x] Follow-up questions on selected content (v0.1.0)
- [x] Text modification in editable fields (v0.1.0)
- [x] Fully customizable selection menu actions (user-defined name + prompt) (iter-1)
- [x] Remove the 4-action limit on selection menu (iter-1)

## Chat Interface
- [x] General Q&A with web search (v0.1.0)
- [x] Browser automation via natural language commands (v0.1.0)

## Provider Support
- [x] Support for multiple AI providers (OpenAI, Anthropic, DeepSeek, GLM, Moonshot, Gemini) (v0.1.0)
- [x] Easy provider switching and configuration (v0.1.0)
- [x] Encrypted API key storage (v0.1.0)
- [x] Additional LLM providers (Groq, Fireworks AI, MiniMax, OpenRouter) for more flexibility (iter-1)
- [x] Custom model configuration per provider (iter-1)
- [x] Model verification using tool calling capability (iter-1)

## Privacy & Security
- [x] All data stored locally (no cloud sync) (v0.1.0)
- [x] Zero telemetry / data collection (v0.1.0)
- [x] Encrypted API keys using Electron safeStorage (v0.1.0)

## Internationalization
- [x] Support for 10 languages (Chinese, English, Spanish, Japanese, German, French, Portuguese, Arabic, Hindi, Bengali) (v0.1.0)

## Platform Support
- [x] Windows support (v0.1.0)
- [ ] macOS support (future)
- [ ] Linux support (future)

## UI/UX
- [x] Quick access via keyboard shortcuts (Ctrl+Space for chat) (v0.1.0)
- [x] Selection menu appearing near selected text (v0.1.0)
- [x] Settings panel for customization (v0.1.0)
- [x] Optional Ctrl key requirement for menu popup (reduce accidental triggers) (iter-2)
- [x] Auto-copy generated text to clipboard with visual confirmation (iter-3)

## Performance
- [ ] Fast text selection detection
- [ ] Low memory footprint
- [ ] Quick AI response rendering

---

*To add a new requirement, append it under the appropriate category with `- [ ]` prefix.*
*When addressed by an iteration, change to `- [x]` and add `(iter-N)` suffix.*
