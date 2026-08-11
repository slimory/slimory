# Changelog

All notable changes to SlimoryLite will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Custom action icon picker with 90+ lucide-react icons
- Icon selection and display for custom actions in settings and menu
- Model configuration in API settings - users can customize the model used for AI conversations
- OpenRouter provider support
- Model verification using tool calling capability
- Optional Ctrl key requirement for menu popup - users can now configure the menu to only appear when holding Ctrl during text selection, reducing accidental triggers

### Changed
- `saveSettings` IPC now accepts optional model parameter
- API key verification uses `generateStreamingResponseWithTools` to verify model supports tools

### Fixed
- Model configuration now correctly persists and loads after app restart
- Fixed default model display in settings panel

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
