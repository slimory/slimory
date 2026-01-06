# Contributing to Slimory

Thank you for your interest in contributing to Slimory! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Internationalization](#internationalization)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js
- **Git**: For version control
- **Windows**: Currently the primary development platform (future support for other platforms planned)
- **Visual Studio Build Tools** (optional): For compiling `GetSelectedText.cs` `UpdateSelectedText.cs` if you need to modify it

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/slimory/slimory.git
   cd slimory
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Rebuilding Electron**
   If you encounter native module issues:
   ```bash
   npx electron-rebuild
   ```

5. **Run in development mode**:
   ```bash
   npm run electron:dev
   ```

### Compiling GetSelectedText.exe and UpdateSelectedText.exe

If you need to modify the text selection functionality, you'll need to compile `GetSelectedText.cs`:

```bash
[your path]\VS\MSBuild\Current\Bin\Roslyn\csc.exe /t:exe /out:./resources/GetSelectedText.exe ./resources/GetSelectedText.cs /r:"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\UIAutomationClient.dll" /r:"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\UIAutomationTypes.dll"
```

If you need to modify the text modification functionality, you'll need to compile `UpdateSelectedText.cs`:

```bash
[your path]\VS\MSBuild\Current\Bin\Roslyn\csc.exe /t:exe /out:./resources/UpdateSelectedText.exe ./resources/UpdateSelectedText.cs /r:"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\UIAutomationClient.dll" /r:"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\UIAutomationTypes.dll"
```

## Project Structure

```
slimory-pc/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Main entry point
│   │   ├── chatWindow.ts  # Chat window management
│   │   ├── messageWindow.ts
│   │   └── ...
│   ├── renderer/          # React renderer process
│   │   ├── components/    # React components
│   │   ├── i18n/          # Internationalization files
│   │   └── ...
│   ├── preload/           # Preload scripts
│   ├── services/          # Business logic services
│   ├── tools/             # Tool implementations
│   │   └── webPilot/      # Browser automation
│   ├── config/            # Configuration files
│   └── prompts/           # AI prompt templates
├── scripts/               # Build and test scripts
│   └── tests/            # Test scripts
├── resources/            # Static resources
└── build/                # Build assets
```

## Development Workflow

### 1. Create a Branch

Create a new branch from `main` for your changes:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clean, maintainable code
- Follow the existing code style
- Add comments for complex logic
- Update documentation if needed

### 3. Test Your Changes

- Test manually in development mode
- Run relevant test scripts if available

### 4. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git add .
git commit -m "feat: description of what you added"
```

Good commit message format:
- Use present tense ("feat: add feature" not "feat: added feature")
- Be specific and concise
- Reference issues if applicable: "fix: description (#123)"

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear description of changes
- Screenshots/GIFs if UI changes
- Reference to related issues

## Coding Standards

### TypeScript

- **Strict Mode**: The project uses TypeScript strict mode
- **Type Safety**: Always use proper types, avoid `any` when possible
- **ES2020**: Target ES2020 for modern JavaScript features
- **Modules**: Use ES modules (`import`/`export`)

### Code Style

- **Indentation**: Use consistent indentation (spaces, typically 4 spaces)
- **Naming**:
  - Use camelCase for variables and functions
  - Use PascalCase for classes and components
  - Use descriptive names
- **Comments**: Add comments for complex logic or non-obvious code
- **Unused Code**: Remove unused imports, variables, and functions (enforced by TypeScript)

### React Components

- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use TypeScript for component props

### File Organization

- Keep related files together
- Use consistent naming conventions
- Separate concerns (UI, logic, services)

## Testing

### Running Tests

The project includes test scripts in `scripts/tests/`:

```bash
# Test web search functionality
npm run test:websearch

# Test operation generator
npm run test:operationgenerator
```

**Set up environment variables** (if needed):
- Create a `.env.dev` file in the root directory
- Add your API keys if testing AI features:
   ```
   OPENAI_API_KEY=your_key_here
   OPENAI_API_BASE_URL=https://api.openai.com/v1
   OPENAI_API_MODEL=gpt-5.2
   # or other provider
   ```

### Writing Tests

- Create test files in `scripts/tests/` directory
- Follow naming convention: `test<ModuleName>.ts`
- Add corresponding npm script in `package.json`
- Update `scripts/tests/README.md` with test documentation

### Test Requirements

- Tests should be self-contained and independent
- Include error handling and edge cases
- Provide clear output with success/failure indicators
- Some tests may require network access or API keys

## Internationalization

Slimory supports multiple languages. When adding new UI text:

1. **Add translations** to all locale files in `src/renderer/i18n/locales/`:
   - `en.json` (English - base)
   - `zh.json` (Chinese)
   - `es.json` (Spanish)
   - `fr.json` (French)
   - `de.json` (German)
   - `ja.json` (Japanese)
   - `pt.json` (Portuguese)
   - `ar.json` (Arabic)
   - `bn.json` (Bengali)
   - `hi.json` (Hindi)

2. **Use translation keys** in components:
   ```typescript
   import { useTranslation } from 'react-i18next';
   
   const { t } = useTranslation();
   return <div>{t('key.path')}</div>;
   ```

3. **Maintain consistency** across all language files

4. **Test** with different language settings

## Submitting Changes

### Pull Request Process

1. **Update your branch** with the latest changes from `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-branch
   git rebase main
   ```

2. **Ensure your code**:
   - Follows coding standards
   - Passes all tests
   - Builds successfully
   - Includes necessary documentation updates

3. **Create Pull Request**:
   - Use a clear, descriptive title
   - Provide detailed description
   - Link related issues
   - Add screenshots for UI changes
   - Request review from maintainers

4. **Respond to feedback**:
   - Address review comments promptly
   - Make requested changes
   - Keep discussions constructive

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated (if needed)
- [ ] No new warnings or errors
- [ ] Tests pass (if applicable)
- [ ] Internationalization updated (if UI changes)
- [ ] Changes tested manually

## Reporting Bugs

### Before Reporting

1. Check if the bug has already been reported
2. Test with the latest version
3. Try to reproduce the issue consistently

### Bug Report Template

When reporting a bug, please include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**:
  - OS version
  - Node.js version
  - Slimory version
- **Screenshots/Logs**: If applicable
- **Additional Context**: Any other relevant information

## Feature Requests

### Suggesting Features

1. Check if the feature has been requested before
2. Provide a clear description
3. Explain the use case and benefits
4. Consider implementation complexity
5. Be open to discussion and alternatives

### Feature Request Template

- **Feature Description**: What you want to add
- **Use Case**: Why this feature is useful
- **Proposed Solution**: How it could work (optional)
- **Alternatives**: Other approaches considered (optional)

## Building for Production

To build production packages:

```bash
npm run build
```

This will:
1. Compile TypeScript
2. Build with Vite
3. Copy necessary resources
4. Create distributable packages in `release/` directory

## Rebuilding Electron

If you encounter native module issues:

```bash
npx electron-rebuild
```

## Getting Help

- **Issues**: Open an issue on GitHub for bugs or questions
- **Discussions**: Use GitHub Discussions for general questions
- **Documentation**: Check the README.md for setup instructions

## License

By contributing to Slimory, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Slimory! Your efforts help make this project better for everyone. 🎉
