<div align="center">
<br>
<a href="https://slimory.cc/"><img src="./src/renderer/assets/logo.png" width="128" alt="Slimory" style="vertical-align: middle; flex-shrink: 0;"></a>

### AI that works anywhere you do

Select any text in any application and instantly get AI-powered answers

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-39.2.6-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)

[Features](#features) • [Installation](#installation) • [Development](#development)

</div>

## Overview

Slimory is a free, open-source AI desktop assistant for Windows that brings powerful AI capabilities directly to your workflow. Select any text in any application—whether it's a PDF, Word document, browser, or even PowerPoint—and instantly get AI-powered explanations, translations, or answers without breaking your flow.

Beyond text assistance, Slimory features powerful browser automation capabilities that let you control web browsers through natural language commands, making web interactions more efficient and customizable.

### Why Slimory?

- **Universal Text Selection** - Works seamlessly across all Windows applications
- **Zero Context Switching** - No app switching or copy-pasting required
- **Privacy First** - All data stored locally, no cloud sync
- **Browser Automation** - Control browsers with natural language
- **Multi-Language** - 10 languages supported

## Installation

Currently only supports Windows, with future support for more platforms.

Download from [slimory.cc](https://slimory.cc/) or [GitHub Releases](https://github.com/slimory/slimory/releases).

## Features

### Universal Text Selection

Select text anywhere in Windows and get instant AI assistance:
- **Translate** - Convert text between any language pairs
- **Explain** - Get detailed explanations of complex concepts
- **Ask** - Ask follow-up questions about selected content

Works in:
- PDF readers (Adobe, Foxit, browsers)
- Microsoft Office (Word, PowerPoint, Excel)
- Web browsers
- Text editors
- Any Windows application with text

### Chat Interface

Press Ctrl+Space to show or hide the chat interface at any time.

- **General Q&A** - Ask Slimory anything, and it will search online to give you accurate answers.
- **Browser Automation**- Tell Slimory what you want to do, and watch it navigate sites, click buttons, play videos, search, and extract data.

### Text Modification

Slimory can also **modify text** in any editing interface. It is not included in the selection menu by default, but you can add it in the settings panel.

### Internationalization

Fully localized in 10 languages:
- 🇨🇳 Chinese (Simplified)
- 🇬🇧 English
- 🇪🇸 Spanish
- 🇯🇵 Japanese
- 🇩🇪 German
- 🇫🇷 French
- 🇵🇹 Portuguese
- 🇸🇦 Arabic
- 🇮🇳 Hindi
- 🇧🇩 Bengali

### Multi-Provider Support

Slimory supports multiple AI providers including OpenAI, Anthropic, DeepSeek, GLM, Moonshot, and Gemini.

### Privacy

- **No cloud sync** - All data stays on your machine
- **Encrypted API keys** - Using Electron's safeStorage
- **No telemetry** - Zero data collection or tracking
- **Local processing** - Only API calls to your chosen LLM provider

All data is stored locally:
- **Conversations**: `%APPDATA%/Roaming/slimory/conversations.json`
- **Settings**: `%APPDATA%/Roaming/slimory/settings.json`
- **Scripts**: `%APPDATA%/Roaming/slimory/scripts.json`

## Development

### Prerequisites

- Node.js 18+ and npm

### Install Dependencies

```bash
npm install
```

### Rebuilding Electron

If you encounter native module issues:

```bash
npx electron-rebuild
```

### Running in Development Mode

```bash
npm run electron:dev
```

### Building for Production

```bash
npm run build
```

This will create distributable packages in the `release` directory.

### Compiling GetSelectedText.exe and UpdateSelectedText.exe

If you need to modify the text selection detection functionality in C#, you'll need to compile `GetSelectedText.cs`:

```bash
[your path]\VS\MSBuild\Current\Bin\Roslyn\csc.exe /t:exe /out:./resources/GetSelectedText.exe ./resources/GetSelectedText.cs /r:"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\UIAutomationClient.dll" /r:"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\UIAutomationTypes.dll"
```

If you need to modify the text update functionality, you'll need to compile `UpdateSelectedText.cs`:

```bash
[your path]\VS\MSBuild\Current\Bin\Roslyn\csc.exe /t:exe /out:./resources/UpdateSelectedText.exe ./resources/UpdateSelectedText.cs /r:"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\UIAutomationClient.dll" /r:"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\UIAutomationTypes.dll"
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

Slimory uses several open-source libraries. Key dependencies:

- **Electron** - MIT License
- **React** - MIT License
- **uiohook-napi** - MIT License
- **i18next** - MIT License

Full dependency list available in `package.json`.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI powered by [React](https://reactjs.org/)
- Global input monitoring via [uiohook-napi](https://github.com/SnosMe/uiohook-napi)
- Internationalization by [i18next](https://www.i18next.com/)
- Icons from community contributors

## Support

- **Documentation**: Check this README and inline code comments
- **Issues**: [GitHub Issues](https://github.com/slimory/slimory/issues)
- **Discussions**: [GitHub Discussions](https://github.com/slimory/slimory/discussions)

---

<div align="center">

[⭐ Star us on GitHub](https://github.com/slimory/slimory) • [🐛 Report Bug](https://github.com/slimory/slimory/issues) • [💡 Request Feature](https://github.com/slimory/slimory/issues)

</div>
