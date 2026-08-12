# SlimoryLite Project Overview

## Project Name
SlimoryLite

## Description
An open-source, free AI desktop assistant for Windows that works in any application. SlimoryLite brings powerful AI capabilities directly to your workflow by allowing you to select any text in any application and instantly get AI-powered explanations, translations, or answers without breaking your flow.

## Vision
To create a universal AI assistant that seamlessly integrates into users' existing workflows, eliminating context switching and making AI assistance accessible anywhere on Windows.

## Target Users
- **Knowledge Workers**: Professionals who work with documents, research, and information processing
- **Students**: Learners who need help understanding and translating content
- **Developers**: Software engineers and technical professionals who need coding assistance

## Tech Stack

### Core Technologies
- **Electron 39.2.6**: Cross-platform desktop application framework
- **React 18.2**: UI library for building the interface
- **TypeScript 5.3**: Type-safe JavaScript development
- **Vite 5.0**: Fast build tool and dev server

### Key Dependencies
- **uiohook-napi**: Global input monitoring for text selection detection
- **i18next**: Internationalization framework supporting 10 languages
- **koffi**: Native FFI for Windows API integration
- **katex**: Math rendering support
- **lucide-react**: Icon library for UI components

### Native Components
- **GetSelectedText.exe**: C# utility for text selection detection using UI Automation
- **UpdateSelectedText.exe**: C# utility for text modification using UI Automation

### Build & Development
- **electron-builder**: Application packaging and distribution
- **concurrently**: Running multiple dev processes
- **wait-on**: Development server coordination

## Architecture Overview
- **Main Process**: Electron main process handling system integration, global shortcuts, and native operations
- **Renderer Process**: React-based UI for chat interface and settings
- **Native Modules**: C# executables for Windows UI Automation
- **Local Storage**: All data stored locally in %APPDATA%/Roaming/slimory-lite/

## Key Features
1. **Universal Text Selection**: Works across all Windows applications
2. **Chat Interface**: General Q&A with web search and browser automation
3. **Text Modification**: AI-powered text editing in any editable field
4. **Multi-Provider Support**: 39+ providers from the pi-ai catalog (OpenAI, Anthropic, DeepSeek, GLM/Z.AI Coding CN, Moonshot, Gemini, Groq, Fireworks, MiniMax, OpenRouter, Mistral, X.AI, NVIDIA, and more)
5. **Custom Model Configuration**: Users can customize the model for each provider (must support tool calling)
6. **Privacy-First**: No cloud sync, encrypted API keys, zero telemetry
7. **Internationalization**: 10 languages supported

## Development Workflow
- Development: `npm run electron:dev`
- Build: `npm run build`
- Output: `release/` directory

## Links
- Repository: https://github.com/slimory/slimory-lite
- Issues: https://github.com/slimory/slimory-lite/issues
- Discussions: https://github.com/slimory/slimory-lite/discussions
