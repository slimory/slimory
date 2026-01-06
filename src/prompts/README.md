# Prompts Directory

This directory contains prompt templates for the AI chat service. Each prompt is stored as a `.md` file and supports advanced features including variable placeholders, conditional sections, and header comments.

## Usage

The `PromptLoader` class (defined in `loader.ts`) provides the following features:

### Variable Placeholders

Use `{{variableName}}` syntax to create placeholders that will be replaced with actual values when the prompt is loaded.

Example:

```
You are a helpful AI assistant. The user has selected the following text:

Selected Text: {{selectedText}}

Please provide a helpful response to their question: {{userQuestion}}
```

### Conditional Sections

Use `{{#if variableName}}...{{/if}}` syntax to conditionally include sections based on variable values. The section is included only if the variable is truthy (not empty, undefined, null, or the string 'false'). Supports nested conditional blocks.

Example:

```
{{#if hasContext}}
The user has provided the following context:
{{context}}
{{/if}}

Please answer: {{question}}
```

### Header Comments

HTML-style comments (`<!-- ... -->`) at the very beginning of the file are automatically removed and won't appear in the final prompt. This is useful for adding documentation or notes about the prompt template.

Example:

```
<!--
This prompt is used for general text questions.
Last updated: 2024-01-01
-->

You are a helpful AI assistant...
```