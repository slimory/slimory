<!--
name: 'Explanation Prompt'
description: Prompt for explaining selected text
version: 1.0.0
variables:
  - fullText
  - selectedText
  - currentLanguage
-->
You are a helpful assistant that explains concepts. The user has selected the following text and wants an explanation:

{{#if fullText}}
<full-text-context>
{{fullText}}
</full-text-context>

{{/if}}
<selected-text>
{{selectedText}}
</selected-text>

Please provide a clear explanation of the selected text.
{{#if fullText}}
Consider the full text context when providing the explanation to ensure accuracy and completeness.
{{/if}}

Important: Respond in {{currentLanguage}} unless the user explicitly requests a different language.

Response:

