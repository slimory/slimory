import { Tool, ToolResult } from '../types'
import { browserWindowPool } from './browserPool'
import { instructionParser } from './instructionParser'
import { createOperationTools, getOperationToolDefinitions } from './operationTool'
import { ChatService, ChatMessage } from '../../services/chatService'
import { chatConfig } from '../../config/chatConfig'
import { SettingsStorage } from '../../services/settingsStorage'
import { ToolRegistry } from '../index'
import { loadCommonCode } from './operationGenerator'
import { t, setLanguage } from '../../main/i18n'
import { BrowserWindow } from 'electron'
import { showToast, hideToast, showMessagePanel, updateMessagePanel, hideMessagePanel } from './utils'
// import { ScriptStorage } from '../../services/scriptStorage'
import { getCleanUrl } from './urlUtils'

/**
 * Generate short codes for encoding (a, b, c, ..., z, aa, ab, ...)
 */
function generateCode(index: number): string {
    let code = ''
    let num = index
    while (num >= 0) {
        code = String.fromCharCode(97 + (num % 26)) + code
        num = Math.floor(num / 26) - 1
        if (num < 0) break
    }
    return code
}

/**
 * Encode class and id attributes in HTML to minimize average encoding length
 * Only encodes attributes that are used more than 3 times
 * @param html The HTML string to encode
 * @returns Object with encoded HTML and lookup map
 */
function encodeClassAndId(html: string): { encodedHtml: string; lookup: Record<string, string> } {
    const classUsage = new Map<string, number>()
    const idUsage = new Map<string, number>()
    
    // Extract and count all class and id attributes
    // Match class="..." or class='...' or class=... (handle quoted and unquoted values)
    const classRegex = /\bclass\s*=\s*(["']?)([^"'>\s]+(?:\s+[^"'>\s]+)*)\1/gi
    let match
    while ((match = classRegex.exec(html)) !== null) {
        const classValue = match[2]
        const classes = classValue.split(/\s+/).filter(c => c.trim())
        classes.forEach(cls => {
            classUsage.set(cls, (classUsage.get(cls) || 0) + 1)
        })
    }
    
    // Match id="..." or id='...' or id=...
    const idRegex = /\bid\s*=\s*(["']?)([^"'>\s]+)\1/gi
    while ((match = idRegex.exec(html)) !== null) {
        const id = match[2].trim()
        if (id) {
            idUsage.set(id, (idUsage.get(id) || 0) + 1)
        }
    }
    
    // Filter: only encode attributes used more than 3 times
    const classToEncode = Array.from(classUsage.entries())
        .filter(([_, count]) => count > 3)
        .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
    
    const idToEncode = Array.from(idUsage.entries())
        .filter(([_, count]) => count > 3)
        .sort((a, b) => b[1] - a[1]) // Sort by frequency descending
    
    // Create encoding maps (frequency-based: higher frequency = shorter code)
    const classEncoding = new Map<string, string>()
    const idEncoding = new Map<string, string>()
    const lookup: Record<string, string> = {}
    
    let codeIndex = 0
    classToEncode.forEach(([className, _]) => {
        const code = generateCode(codeIndex++)
        classEncoding.set(className, code)
        lookup[code] = className
    })
    
    idToEncode.forEach(([idName, _]) => {
        const code = generateCode(codeIndex++)
        idEncoding.set(idName, code)
        lookup[code] = idName
    })
    
    // Replace in HTML
    let encodedHtml = html
    
    // Replace classes (handle multiple classes in one attribute)
    // Process from longest to shortest class names to avoid partial matches
    const sortedClasses = Array.from(classEncoding.entries()).sort((a, b) => b[0].length - a[0].length)
    sortedClasses.forEach(([className, code]) => {
        // Match class="..." or class='...' or class=... and replace the specific class name
        // Use word boundaries to ensure we match complete class names
        const escapedClassName = escapeRegex(className)
        // Match class attribute with quotes or without, handling multiple classes
        const classPattern = new RegExp(`(\\bclass\\s*=\\s*)(["']?)([^"'>]*?\\b)${escapedClassName}(\\b[^"'>]*?)(\\2)`, 'gi')
        encodedHtml = encodedHtml.replace(classPattern, (_match, prefix, quote, before, after) => {
            // Split existing classes, remove the one we're encoding, add the code
            const allClasses = (before + ' ' + after).split(/\s+/).filter(c => c.trim() && c !== className)
            allClasses.push(code)
            const newClassValue = allClasses.join(' ').trim()
            // Preserve quotes if they were present, otherwise don't add them
            return prefix + (quote ? quote + newClassValue + quote : newClassValue)
        })
    })
    
    // Replace ids (simpler, as id is usually single value)
    idEncoding.forEach((code, idName) => {
        const escapedId = escapeRegex(idName)
        // Match id="..." or id='...' or id=...
        const idPattern = new RegExp(`(\\bid\\s*=\\s*)(["']?)${escapedId}(\\2)`, 'gi')
        encodedHtml = encodedHtml.replace(idPattern, (_match, prefix, quote) => {
            // Preserve quotes if they were present
            return prefix + (quote ? quote + code + quote : code)
        })
    })
    
    return { encodedHtml, lookup }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Decode class and id in CSS selector from encoded values back to original names
 * @param selector The CSS selector string that may contain encoded class/id
 * @param lookup The lookup map from encoded code to original name
 * @returns The decoded selector with original class/id names
 */
function decodeSelector(selector: string, lookup: Record<string, string>): string {
    if (!selector || Object.keys(lookup).length === 0) {
        return selector
    }
    
    // Create a set of encoded values for quick lookup
    const encodedValues = new Set(Object.keys(lookup))
    
    let decodedSelector = selector
    
    // Decode class selectors: .encodedClass
    // Match .className (may be part of compound selector like .class1.class2)
    // Only decode if the class name exists in lookup
    const classSelectorRegex = /\.([a-z]+(?:\.[a-z]+)*)/gi
    decodedSelector = decodedSelector.replace(classSelectorRegex, (_match, classes) => {
        const classList = classes.split('.')
        const decodedClasses = classList.map((cls: string) => {
            // Only decode if this is an encoded value in our lookup
            return encodedValues.has(cls) ? lookup[cls] : cls
        })
        return '.' + decodedClasses.join('.')
    })
    
    // Decode id selectors: #encodedId
    // Only decode if the id exists in lookup
    const idSelectorRegex = /#([a-z]+)/gi
    decodedSelector = decodedSelector.replace(idSelectorRegex, (_match, id) => {
        // Only decode if this is an encoded value in our lookup
        return '#' + (encodedValues.has(id) ? lookup[id] : id)
    })
    
    // Decode attribute selectors: [class="encodedClass"] or [class='encodedClass']
    // Handle both single and multiple classes
    const classAttrRegex = /\[class\s*=\s*(["'])([^"']+)\1\]/gi
    decodedSelector = decodedSelector.replace(classAttrRegex, (_match, quote, classValue) => {
        const classes = classValue.split(/\s+/).map((cls: string) => {
            // Only decode if this is an encoded value in our lookup
            return encodedValues.has(cls) ? lookup[cls] : cls
        })
        return `[class=${quote}${classes.join(' ')}${quote}]`
    })
    
    // Decode attribute selectors: [id="encodedId"] or [id='encodedId']
    const idAttrRegex = /\[id\s*=\s*(["'])([^"']+)\1\]/gi
    decodedSelector = decodedSelector.replace(idAttrRegex, (_match, quote, idValue) => {
        // Only decode if this is an encoded value in our lookup
        return `[id=${quote}${encodedValues.has(idValue) ? lookup[idValue] : idValue}${quote}]`
    })
    
    return decodedSelector
}

/**
 * Extract executable JavaScript code from LLM response
 * Handles cases where LLM adds text descriptions before/after the code
 */
function extractExecutableCode(code: string): string {
    if (!code || !code.trim()) {
        return ''
    }

    let extracted = code.trim()

    // Step 1: Try to extract from markdown code blocks
    const codeBlockRegex = /```(?:javascript|js)?\n?([\s\S]*?)```/i
    const codeBlockMatch = extracted.match(codeBlockRegex)
    if (codeBlockMatch && codeBlockMatch[1]) {
        extracted = codeBlockMatch[1].trim()
    }

    // Step 2: Try to extract IIFE pattern (function() {...})() or (() => {...})()
    // This handles cases where LLM adds descriptions but wraps code in IIFE
    const iifePatterns = [
        /\(function\s*\([^)]*\)\s*\{[\s\S]*?\}\)\(\)/g,  // (function() {...})()
        /\(\([^)]*\)\s*=>\s*\{[\s\S]*?\}\)\(\)/g,        // (() => {...})()
        /\(async\s+function\s*\([^)]*\)\s*\{[\s\S]*?\}\)\(\)/g,  // (async function() {...})()
        /\(async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}\)\(\)/g  // (async () => {...})()
    ]

    for (const pattern of iifePatterns) {
        const matches = extracted.match(pattern)
        if (matches && matches.length > 0) {
            // Use the longest match (most complete code)
            const longestMatch = matches.reduce((a, b) => a.length > b.length ? a : b)
            if (longestMatch.length > 50) { // Only use if it's substantial code
                extracted = longestMatch.trim()
                break
            }
        }
    }

    // Step 3: If no IIFE found at the start, try to find IIFE pattern anywhere in the text
    // This handles cases where LLM adds descriptions before the code
    if (!extracted.match(/^\(/)) {
        const iifeStartPattern = /\(function\s*\(|\(\([^)]*\)\s*=>|\(async\s+function\s*\(|\(async\s*\([^)]*\)\s*=>/
        const iifeStartMatch = extracted.search(iifeStartPattern)
        if (iifeStartMatch !== -1) {
            // Find the matching closing )() by tracking parentheses
            let openParens = 0
            let codeStart = iifeStartMatch
            let codeEnd = -1
            let inString = false
            let stringChar = ''

            for (let i = iifeStartMatch; i < extracted.length; i++) {
                const char = extracted[i]
                const prevChar = i > 0 ? extracted[i - 1] : ''
                
                // Handle string literals to avoid counting parens inside strings
                if (!inString && (char === '"' || char === "'" || char === '`')) {
                    inString = true
                    stringChar = char
                } else if (inString && char === stringChar && prevChar !== '\\') {
                    inString = false
                }
                
                if (!inString) {
                    if (char === '(') {
                        openParens++
                    } else if (char === ')') {
                        openParens--
                        // Check if we've closed all parens and found )()
                        if (openParens === 0 && i + 1 < extracted.length && extracted[i + 1] === '(') {
                            if (i + 2 < extracted.length && extracted[i + 2] === ')') {
                                codeEnd = i + 3
                                break
                            }
                        }
                    }
                }
            }

            if (codeStart !== -1 && codeEnd !== -1) {
                extracted = extracted.substring(codeStart, codeEnd).trim()
            }
        }
    }

    // Step 4: Remove leading/trailing text that's not code
    // Remove common prefixes like "Here's the code:", "Code:", etc.
    extracted = extracted.replace(/^(?:Here'?s?\s+(?:the\s+)?(?:code|solution|implementation)[:\-]?\s*)/i, '')
    extracted = extracted.replace(/^(?:Code[:\-]?\s*)/i, '')
    extracted = extracted.replace(/^(?:JavaScript\s+code[:\-]?\s*)/i, '')
    extracted = extracted.replace(/^(?:The\s+code\s+(?:is|below)[:\-]?\s*)/i, '')
    
    // Remove trailing text like "This code...", "Note:", etc.
    extracted = extracted.replace(/\s*(?:This\s+code|Note|Note:|Explanation|说明)[:\-]?.*$/i, '')
    
    // Step 5: Final cleanup
    extracted = extracted.trim()
    
    // Remove any remaining markdown code block markers
    extracted = extracted.replace(/^```(?:javascript|js)?\n?/i, '').replace(/\n?```$/i, '')
    extracted = extracted.trim()

    return extracted
}

/**
 * Generate JavaScript code using LLM and execute it with retries
 */
async function generateAndExecuteScript(
    window: BrowserWindow,
    chatService: ChatService,
    description: string,
    currentLang: string = 'zh',
    maxRetries: number = 3,
    onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => void
): Promise<ToolResult> {
    // Get current page information for context
    const currentUrl = window.webContents.getURL()
    const currentTitle = window.webContents.getTitle()
    
    // Extract page content for context using common extractPageContent code
    let pageContext = ''
    let currentExecutedScript: string = ''
    try {
        const commonExtractCode = loadCommonCode('extractPageContentForScript')
        const htmlResult = await window.webContents.executeJavaScript(commonExtractCode) as any
        if (htmlResult?.success && htmlResult.html) {
            // Use the HTML content as page context (no truncation)
            pageContext = htmlResult.html
            const scriptRegex = /<script[^>]*data-webpilot-executed\s*=\s*["']?true["']?[^>]*>([\s\S]*?)<\/script>/gi
            // Extract previously executed scripts from the HTML
            const match = scriptRegex.exec(htmlResult.html)
            if (match && match[1]) {
                currentExecutedScript = match[1].trim()
                pageContext = pageContext.replace(match[0], '')
            }
        }
    } catch (e) {
        // Ignore errors
    }
    console.log('currentExecutedScript', currentExecutedScript.length > 0)
    const removeScriptResult = await window.webContents.executeJavaScript(`(function() {
        const script = document.body.querySelector('script[data-webpilot-executed]')
        const text = script?.textContent || ''
        if (script) {
            script.remove()
        }
        return text
    })()`)
    console.log('removeScriptResult', removeScriptResult.length > 0)

    // Define tool for getting element styles
    const getElementStyleTool = {
        type: 'function' as const,
        function: {
            name: 'get_element_computed_style',
            description: 'Get the computed styles of one or more elements on the current webpage. Use this tool to inspect element styles before modifying them. This helps ensure you have complete information about the current styles, including positioning, layout, colors, fonts, etc. You can pass multiple selectors in a single call to reduce the number of tool calls.',
            parameters: {
                type: 'object',
                properties: {
                    selectors: {
                        type: 'array',
                        items: {
                            type: 'string'
                        },
                        description: 'Array of CSS selectors to find elements (e.g., ["#myId", ".myClass", "div > p:first-child"]). For each selector, if multiple elements match, the first one will be used. You can pass multiple selectors to get styles for multiple elements in a single call.'
                    },
                    properties: {
                        type: 'array',
                        items: {
                            type: 'string'
                        },
                        description: 'Optional array of specific CSS property names to retrieve (e.g., ["color", "fontSize", "display"]). If not provided, all computed styles will be returned for each element.'
                    }
                },
                required: ['selectors']
            }
        }
    }

    const previousExecutedScriptInfo = currentExecutedScript ? 
`## Previously executed script on this page:
\`\`\`javascript
${currentExecutedScript}
\`\`\``
: ''

    const baseSystemPrompt = `You are a JavaScript code generator for web automation. Your task is to generate JavaScript code that can be executed in a browser page context to accomplish the user's request.

## Current page information:
- URL: ${currentUrl || 'N/A'}
- Title: ${currentTitle || 'N/A'}
${pageContext ? `- Page HTML content:\n${pageContext}` : ''}

## DOM & Style Analysis
Before making any changes, analyze the current page using DOM inspection and computed styles to understand:

- **Layout patterns**:
  - flexbox, grid, block, positioning
  - how layout responsibilities are distributed across nested containers
- **Visual hierarchy**:
  - parent-child relationships
  - wrapper vs. content containers
  - which level defines visual boundaries (spacing, background, border)
- **Spacing system**:
  - margins, paddings, gaps, rhythm
  - how spacing is shared or duplicated across nested elements
- **Component types**:
  - buttons, cards, forms, navigation, lists
  - identify structural wrappers vs. interactive components
- **Color & typography**:
  - colors, font sizes, weights, line-heights
  - whether color or background is used to separate nested sections

### Nested Container Awareness (Critical)
- Explicitly map container depth (section → wrapper → component → inner content)
- Identify which container is responsible for:
  - spacing
  - background
  - border / outline
- Treat non-interactive wrappers as structural only:
  - do NOT assign decorative styles by default
- Detect tight nesting (padding / gap < 12px) and flag it as a high-risk zone for:
  - redundant borders
  - over-styling

You may use "get_element_computed_style" tool with multiple selectors in one call to minimize tool usage.

## Style modification rules:

### Allowed modifications:
- Color, background, gradients
- Shadows, glows
- Border color or style (if element already has visible border)
- Typography (font-family, font-size, font-weight)
- Border-radius
- Visual effects that do not change layout

### Strictly prohibited modifications:
- Layout-affecting properties: position, top, left, right, bottom, z-index
- Spacing: margin, padding
- Size: width, height, min/max-width/height
- Display type changes (block, flex, grid)
- Any change that could shift other elements

### Handling non-visual elements:
- Elements without explicit visual cues (no border, background, or content) should generally not be styled.
- If a visual change is required (e.g., adding a border), carefully check:
    a) Parent and sibling styles (existing border, background, shadows, gradients)
    b) Visual harmony and coordination with surrounding elements
    c) That layout, spacing, and stacking order are not impacted

### Target scope:
- Apply style changes only to elements with visible content or clear visual representation.
- Avoid modifying global or layout-critical selectors (body, html, *, containers).

### Text color rules:

Default rule:
- When modifying text color, choose a color with similar brightness to the original, to ensure readability.

High contrast changes:
- If the new text color has a significantly different brightness:
    a) Ensure sufficient contrast between text and background for readability.
    b) A simple approach: adjust the parent element’s background color to coordinate with the new text color while preserving visual harmony with surrounding elements.

General principles:
- Avoid colors that reduce legibility.
- Maintain overall visual coordination with sibling and parent elements.
- Do not modify layout or spacing to accommodate color changes; adjust only visual style.

### Principle:
- All style changes must enhance visual style while preserving original layout, spacing, and positioning.
- Never break existing page layout (header, footer, grids, flex containers, positioning).
- Only apply styles locally to the elements you create or explicitly target.
- Do not modify global selectors (body, html, *), or existing layout-related CSS.
- Preserve spacing, alignment, and positioning of existing components.
- If necessary, use inline styles or uniquely scoped classes for new elements.

## Visual Modification Constraints
- Do **not** break existing buttons, links, inputs, or forms
- Decorative effects must be **non-intrusive**
- **No Waiting:** Do not use "setTimeout", "setInterval", or wait for user interactions. Return immediately.
- **Non-Destructive:** NEVER hide/cover main content or break critical functionality (forms, buttons).
- **Overlays:** If using full-screen effects, set "pointer-events: none" so clicks pass through.
- **Canvas:** If using canvas, ensure backgrounds are transparent.

## Aesthetic Quality Guidelines

### Color & Theme
- Use a **cohesive, context-specific palette**
- Prefer dominant colors with clear accents
- Avoid generic or overused aesthetics
- Use CSS variables when appropriate

### Motion & Animation (Natural & Intuitive)
- Animations must feel **natural, intuitive, and physically believable**
- Motion should clearly reflect **cause and effect** (no sudden jumps, teleports, or unnatural speed changes)
- Use animation **only when it improves understanding or perceived quality**, not for decoration alone
- Timing guidelines:
  - Micro-interactions: 120-200ms
  - Component transitions: 200-350ms
  - Emphasis or larger movements: 300-500ms
- Easing:
  - Prefer ease-in-out or carefully chosen cubic-bezier curves
  - Avoid linear easing unless intentionally mechanical
- Spatial consistency:
  - Elements should move from their logical origin and return predictably
  - Direction, distance, and speed should match the element's size and importance
- Continuity:
  - Maintain consistent motion patterns across similar components
  - Do not mix radically different animation styles on the same page
- Restraint:
  - One well-designed animation is better than many weak ones
  - Never distract from reading, navigation, or primary actions
- Viewport Boundary Awareness:
  - All important visual elements MUST remain within the viewport at least part of the time
  - Do NOT allow key visuals to permanently exit the visible window
  - Avoid spawning or moving elements entirely off-screen unless intentionally entering/exiting
- Performance:
  - Balance visual effects with performance considerations. 
  - Optimize animations using CSS transforms and opacity (which trigger GPU acceleration) rather than properties that cause layout reflows. 
  - Use requestAnimationFrame for JavaScript animations. 
  - Achieve the desired effect with the simplest possible implementation. 

### SVG/Canvas Guidelines
- **Namespace is Mandatory:** When creating SVG elements, YOU MUST use:
    "document.createElementNS('http://www.w3.org/2000/svg', 'tagName')"
    - Using standard "createElement" for SVG tags will result in invisible 'dead' nodes.
- **Explicit Dimensions:** Always set "width", "height", and "viewBox" attributes on the root SVG.
- Explicitly set "fill="none"" or a specific color value.
- Explicitly set "stroke" color when using outlines.
- Do not rely on inherited CSS for colors.

${previousExecutedScriptInfo}

## Output & Execution Requirements

### JavaScript Output Rules
- Output **ONLY executable JavaScript**
- No explanations, no markdown, no extra text
- Must run directly in the browser context
- Use this structure exactly:

"(function() {
  try {
    // code
    return {
      success: true,
      name: '<script name>',
      data: null,
      message: '<short message>'
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
})()"

### DOM & Security Constraints (Critical)
- **Never use**:
  - innerHTML / outerHTML / insertAdjacentHTML
  - eval(), Function(), or dynamic code execution
- **Always use**:
  - document.createElement()
  - textContent
  - appendChild()
  - setAttribute()
  - direct style property assignment

Example (allowed):
"const span = document.createElement('span');
span.textContent = 'Text';
element.appendChild(span);"

### IMPORTANT:
- The page will be refreshed before running the new code.
- All elements, variables, and side effects from the previous script must be treated as non-existent.
- “Modify / adjust / change the effect” means rewriting the logic, not patching existing DOM.
- Never assume any element already exists.
- If a required element is not found, recreate it instead of treating it as an error.

### STRICT RULES:
1. Always generate a COMPLETE, standalone script.
2. Never output incremental changes, patches, or partial code.
3. Do not rely on any previously created DOM elements or state.
4. Even if elements could be found by selectors, you must recreate all required elements in the new script.
5. The new script must fully replace the previous one and implement all requested behavior.

### Code Quality & Performance
- Minimal DOM mutations
- No unnecessary reflows or repaints
- Modular, concise functions
- No over-engineering
`

    let previousErrors: string[] = []

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            if (onStatusUpdate && attempt > 0) {
                // setLanguage(currentLang)
                const retryMessage = currentLang === 'zh' 
                    ? `重试生成代码... (${attempt + 1}/${maxRetries})`
                    : `Retrying code generation... (${attempt + 1}/${maxRetries})`
                onStatusUpdate('processing', retryMessage)
                const statusMessage = getStatusMessage('executeScript', {})
                showToast(window, statusMessage)
            }

            // Build system prompt with previous errors if any
            let systemPrompt = baseSystemPrompt
            if (previousErrors.length > 0) {
                systemPrompt += `\n\nPrevious attempts failed with the following errors:\n${previousErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\nPlease fix the code based on these errors and try again.`
            }

            // Generate code using LLM with tool support
            let messages: ChatMessage[] = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: description
                }
            ]

            let generatedCode = ''
            let toolCallsToExecute: Array<{ id: string; name: string; arguments: any }> = []
            let maxToolCallIterations = 5 // Limit tool call iterations to prevent infinite loops
            let toolCallIteration = 0
            
            // Handle tool calls
            const handleToolCall = async (toolCalls: Array<{ id: string; name: string; arguments: any }>) => {
                toolCallsToExecute = toolCalls
            }

            // Generate code with tool support (may involve multiple rounds if tools are called)
            // Show message panel at the start of first iteration
            if (toolCallIteration === 0) {
                await showMessagePanel(window, t('tools.webPilot.codeGeneration'))
            }

            let finishReason = ''
            while (toolCallIteration < maxToolCallIterations) {
                let currentChunkCode = ''
                let hasToolCalls = false
                
                
                // Generate code with tool support
                let codeMessageStarted = false
                
                for await (const chunk of chatService.generateStreamingResponseWithTools(
                    messages,
                    undefined,
                    undefined,
                    handleToolCall,
                    [getElementStyleTool]
                )) {
                    if (chunk.content) {
                        currentChunkCode += chunk.content
                        // Update message panel with streaming code (append to last message)
                        if (!codeMessageStarted) {
                            // Start new code message
                            await updateMessagePanel(window, chunk.content, 'code', false)
                            codeMessageStarted = true
                        } else {
                            // Append to existing code message
                            await updateMessagePanel(window, chunk.content, 'code', true)
                        }
                    }

                    finishReason = chunk.finishReason || ''
                    
                    // Check if tool calls are needed
                    if (chunk.finishReason === 'tool_calls' && toolCallsToExecute.length > 0) {
                        hasToolCalls = true
                        break
                    }
                }
                
                generatedCode += currentChunkCode
                
                // If no tool calls, we're done generating code
                if (!hasToolCalls || toolCallsToExecute.length === 0) {
                    break
                }
                
                // Execute tool calls
                const toolResults: ChatMessage[] = []
                
                for (const toolCall of toolCallsToExecute) {
                    // Update message panel with tool call info
                    const toolCallInfo = `Calling tool: ${toolCall.name}(${typeof toolCall.arguments === 'string' ? toolCall.arguments : JSON.stringify(toolCall.arguments)})`
                    await updateMessagePanel(window, toolCallInfo, 'tool')
                    if (toolCall.name === 'get_element_computed_style') {
                        try {
                            const args = typeof toolCall.arguments === 'string' 
                                ? JSON.parse(toolCall.arguments) 
                                : toolCall.arguments
                            
                            // Support both single selector (backward compatibility) and multiple selectors
                            let selectors: string[] = []
                            if (args.selectors) {
                                selectors = Array.isArray(args.selectors) ? args.selectors : [args.selectors]
                            } else if (args.selector) {
                                // Backward compatibility: support single selector
                                selectors = [args.selector]
                            } else {
                                throw new Error('No selectors provided')
                            }
                            
                            const properties = args.properties || null
                            
                            // Execute JavaScript to get computed styles for multiple elements
                            const getStyleCode = `(function() {
                                try {
                                    const selectors = ${JSON.stringify(selectors)};
                                    const properties = ${properties ? JSON.stringify(properties) : 'null'};
                                    const results = [];
                                    
                                    for (let i = 0; i < selectors.length; i++) {
                                        const selector = selectors[i];
                                        try {
                                            const element = document.querySelector(selector);
                                            if (!element) {
                                                results.push({
                                                    selector: selector,
                                                    success: false,
                                                    error: 'Element not found with selector: ' + selector
                                                });
                                                continue;
                                            }
                                            
                                            const computedStyle = window.getComputedStyle(element);
                                            const styles = {};
                                            
                                            if (properties && Array.isArray(properties)) {
                                                properties.forEach(prop => {
                                                    styles[prop] = computedStyle.getPropertyValue(prop) || computedStyle[prop];
                                                });
                                            } else {
                                                for (let j = 0; j < computedStyle.length; j++) {
                                                    const prop = computedStyle[j];
                                                    styles[prop] = computedStyle.getPropertyValue(prop);
                                                }
                                            }
                                            
                                            results.push({
                                                selector: selector,
                                                success: true,
                                                data: {
                                                    selector: selector,
                                                    tagName: element.tagName.toLowerCase(),
                                                    styles: styles,
                                                    elementInfo: {
                                                        id: element.id || null,
                                                        className: element.className || null,
                                                        innerText: element.innerText ? element.innerText.substring(0, 100) : null
                                                    }
                                                }
                                            });
                                        } catch (e) {
                                            results.push({
                                                selector: selector,
                                                success: false,
                                                error: 'Failed to get computed style for selector "' + selector + '": ' + (e.message || String(e))
                                            });
                                        }
                                    }
                                    
                                    return {
                                        success: true,
                                        data: {
                                            results: results,
                                            totalCount: results.length,
                                            successCount: results.filter(r => r.success).length
                                        }
                                    };
                                } catch (e) {
                                    return { success: false, error: 'Failed to get computed styles: ' + (e.message || String(e)) };
                                }
                            })()`
                            
                            const styleResult = await Promise.race([
                                window.webContents.executeJavaScript(getStyleCode),
                                new Promise((_, reject) => 
                                    setTimeout(() => reject(new Error('Style retrieval timeout')), 10000)
                                )
                            ]) as any
                            console.log('styleResult', styleResult)
                            
                            // Update message panel with tool result
                            const resultInfo = styleResult.success 
                                ? `Tool result: Success - Retrieved styles for ${styleResult.data?.successCount || 0}/${styleResult.data?.totalCount || 0} elements`
                                : `Tool result: Failed - ${styleResult.error || 'Unknown error'}`
                            await updateMessagePanel(window, resultInfo, 'tool')
                            
                            // Add tool result to messages
                            toolResults.push({
                                role: 'tool',
                                content: JSON.stringify(styleResult),
                                tool_call_id: toolCall.id
                            })
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error)
                            
                            // Update message panel with error
                            await updateMessagePanel(window, `Tool error: ${errorMessage}`, 'tool')
                            
                            toolResults.push({
                                role: 'tool',
                                content: JSON.stringify({ success: false, error: errorMessage }),
                                tool_call_id: toolCall.id
                            })
                        }
                    }
                }
                
                // Add assistant message with tool calls and tool results to messages
                messages.push({
                    role: 'assistant',
                    content: currentChunkCode || '',
                    tool_calls: toolCallsToExecute.map(tc => ({
                        id: tc.id,
                        type: 'function' as const,
                        function: {
                            name: tc.name,
                            arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments)
                        }
                    }))
                })
                
                messages.push(...toolResults)
                
                // Reset for next iteration
                toolCallsToExecute = []
                toolCallIteration++
            }
            
            // Hide message panel when iteration is complete
            await hideMessagePanel(window)

            if (finishReason === 'length') {
                throw new Error('Generated code is too long, please try again with a shorter code')
            }

            // window.loadURL(currentUrl)
            // Clean up and extract the generated code
            generatedCode = extractExecutableCode(generatedCode)

            // console.log('generatedCode', generatedCode)

            if (!generatedCode) {
                // Hide message panel if code is empty
                await hideMessagePanel(window)
                throw new Error('Generated code is empty')
            }

            // Execute the generated code
            // const executeCode = `(function() { try { const code = ${JSON.stringify(generatedCode)}; const result = (new Function(code))(); return { success: true, result: result, message: 'Script executed successfully' }; } catch(e) { return { success: false, error: 'Failed to execute script: ' + (e.message || String(e)), stack: e.stack }; } })()`
            
            // const executionResult = await Promise.race([
            //     window.webContents.executeJavaScript(generatedCode),
            //     new Promise((_, reject) => 
            //         setTimeout(() => reject(new Error('Script execution timeout')), 10000)
            //     )
            // ]) as any

            // Execute the generated code with enhanced error handling
            // Wrap the code to capture detailed error information
            const wrappedCode = `(function() {
                function __webpilot_safeValue(value, seen, depth) {
                    if (!seen) seen = new WeakSet();
                    if (depth === undefined) depth = 0;
                    if (depth > 5) return undefined;
                    
                    const t = typeof value;
                    if (value === null || t === 'string' || t === 'number' || t === 'boolean') {
                        return value;
                    }
                    
                    if (t === 'function' || t === 'symbol' || t === 'bigint') {
                        return undefined;
                    }
                    
                    if (typeof Node !== 'undefined' && value instanceof Node) {
                        return undefined;
                    }
                    if (typeof Window !== 'undefined' && value instanceof Window) {
                        return undefined;
                    }
                    if (typeof Document !== 'undefined' && value instanceof Document) {
                        return undefined;
                    }
                    
                    if (t === 'object') {
                        if (seen.has(value)) return undefined;
                        seen.add(value);
                        
                        if (Array.isArray(value)) {
                            return value.map(function (v) {
                                return __webpilot_safeValue(v, seen, depth + 1);
                            });
                        }
                        
                        const out = {};
                        for (const key in value) {
                            try {
                                const v = __webpilot_safeValue(value[key], seen, depth + 1);
                                if (v !== undefined) {
                                    out[key] = v;
                                }
                            } catch (e) {
                            }
                        }
                        return out;
                    }
                    
                    return undefined;
                }
            
                try {
                    const result = ${generatedCode};
                    return __webpilot_safeValue(result);
                } catch(e) {
                    return {
                        success: false,
                        error: e.message || String(e),
                        stack: e.stack,
                        name: e.name
                    };
                }
            })()`
            
            let executionResult: any
            try {
                executionResult = await Promise.race([
                    window.webContents.executeJavaScript(wrappedCode),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Script execution timeout')), 10000)
                    )
                ]) as any
            } catch (executeError: any) {
                console.log('generatedCode', generatedCode)
                // If executeJavaScript itself throws an error, try to get more details
                
                const detailedError = `Script execution failed: ${executeError?.message || String(executeError)}\nFailed code: ${generatedCode}`
                console.error('[WebPilot] Detailed execution error:', String(executeError))
                
                throw new Error(detailedError)
            }

            console.log('executionResult', executionResult)

            // Check if execution was successful
            if (executionResult && executionResult.success !== false) {
                // Ensure resultData is an object
                
                // Inject the executed code as a script tag in the page
                // This ensures the code state is preserved when extracting page content
                try {
                    // Use JSON.stringify to safely escape the code for embedding in JavaScript string
                    const escapedCode = JSON.stringify(generatedCode.slice(0, -2))
                    const injectScriptCode = `(function() {
                        try {
                            // Create a script tag with the executed code
                            const script = document.createElement('script');
                            script.setAttribute('data-webpilot-executed', 'true');
                            script.textContent = ${escapedCode};
                            document.body.appendChild(script);
                            return { success: true };
                        } catch(e) {
                            return { success: false, error: e.message };
                        }
                    })()`
                    // console.log('injectScriptCode', injectScriptCode)
                    await window.webContents.executeJavaScript(injectScriptCode)
                } catch (injectError) {
                    // Log but don't fail if injection fails
                    console.warn('[WebPilot] Failed to inject script tag:', injectError)
                }
                
                // Save script after successful execution
                try {
                    const currentUrl = window.webContents.getURL()
                    if (currentUrl && currentUrl !== 'about:blank' && window.isVisible()) {
                        const cleanUrl = getCleanUrl(currentUrl)
                        setTimeout(() => {
                            browserWindowPool.injectNavigationToolbar(window, {code: generatedCode, name: executionResult.name || cleanUrl})
                        }, 100)
                    }
                } catch (saveError) {
                    // Log but don't fail if saving fails
                    console.warn('[WebPilot] Failed to save script:', saveError)
                }
                
                return {
                    success: executionResult.success,
                    data: executionResult,
                    error: executionResult.error
                }
                
            } else {
                // If execution failed, use the error for next retry
                const errorMsg = executionResult?.error || 'Script execution failed'
                console.log('errorMsg', errorMsg)
                if (attempt < maxRetries - 1) {
                    // Add error feedback for next retry
                    previousErrors.push(errorMsg)
                    continue
                } else {
                    return {
                        success: false,
                        error: errorMsg
                    }
                }
            }
        } catch (error) {
            let errorMessage = String(error)
            // Extract detailed error information
            
            // Hide message panel on error
            await hideMessagePanel(window)
            
            // Log detailed error information
            console.error('[WebPilot] Execution error details:', errorMessage)
            
            if (attempt < maxRetries - 1) {
                // Add error feedback for next retry
                previousErrors.push(errorMessage)
                continue
            } else {
                return {
                    success: false,
                    error: `Failed after ${maxRetries} attempts: ${errorMessage}`
                }
            }
        }
    }

    return {
        success: false,
        error: `Failed to generate and execute script after ${maxRetries} attempts`
    }
}

/**
 * Get status message for the operation
 */
function getStatusMessage(operationName: string, params: Record<string, any>): string {
    if (operationName === 'navigate' && params.url) {
        return t('tools.webPilot.navigate', { url: params.url })
    } else if (operationName === 'extractPageContent') {
        return t('tools.webPilot.extractPageContent')
    } else if (operationName === 'search') {
        return t('tools.webPilot.search', { query: params.query || '' })
    } else if (operationName === 'clickElement') {
        return t('tools.webPilot.clickElement', { targetName: params.targetName || '' })
    } else if (operationName === 'fillInput') {
        return t('tools.webPilot.fillInput', { value: params.value || '' })
    } else if (operationName === 'waitForElement') {
        return t('tools.webPilot.waitForElement', { targetName: params.targetName || '' })
    } else if (operationName === 'selectOption') {
        return t('tools.webPilot.selectOption', { value: params.value || '' })
    } else if (operationName === 'scrollToBottom') {
        return t('tools.webPilot.scrollToBottom')
    } else if (operationName === 'scrollToTop') {
        return t('tools.webPilot.scrollToTop')
    } else if (operationName === 'scrollBy') {
        return t('tools.webPilot.scrollBy', { pixels: params.pixels?.toString() || '0' })
    } else if (operationName === 'executingOperations') {
        return t('tools.webPilot.executingOperations', { domain: params.domain })
    } else if (operationName === 'executeScript') {
        return t('tools.webPilot.generateScriptAndExecute')
    } else {
        return t('tools.webPilot.executing', { operationName: operationName })
    }
}

/**
 * WebPilot Tool - Automates web browser operations based on natural language instructions
 */
export class WebPilotTool implements Tool {
    name = 'web_pilot'
    description = 'Automate web browser operations on any website. You can give natural language instructions like "open youtube.com, search for trump, then open the first result". The tool will parse the instruction and execute the operations automatically. Supports operations like navigation, search, clicking elements, and more.'

    parameters = {
        type: 'object' as const,
        properties: {
            instruction: {
                type: 'string',
                description: 'Natural language instruction describing what to do on the website. Examples: "open youtube.com, search for trump, then open the first result". IMPORTANT: Unless the user explicitly requests code, the instruction should only contain natural language descriptions of the desired actions, NOT specific code implementations. Use plain language to describe what should happen, not how to implement it.'
            },
            domain: {
                type: 'string',
                description: 'Optional domain hint (e.g., "youtube.com").'
            },
            showWindow: {
                type: 'boolean',
                description: 'Whether to show the browser window during execution (default: false). Set to true if user wants to see the operations happening.'
            },
            newWindow: {
                type: 'boolean',
                description: 'Whether to create a new browser window instead of reusing an existing one (default: false). Set to true if user wants a fresh window instance.'
            }
        },
        required: ['instruction']
    }

    async execute(
        params: Record<string, any>,
        onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => boolean,
        currentLang: string = 'zh',
        messages: Array<{ role: string; content: string }> = [],
        conversationId?: string
    ): Promise<ToolResult> {
        console.log('WebPilotTool execute', params)
        const { instruction, domain, showWindow = false, newWindow = false } = params
        if (!instruction || typeof instruction !== 'string') {
            return {
                success: false,
                error: 'Instruction parameter is required and must be a string'
            }
        }
        let window= browserWindowPool.acquire(conversationId || '', showWindow, newWindow)
        try {
            // Extract domain from instruction or use provided domain
            const extractedDomain = domain || instructionParser.extractDomain(instruction)

            // Get current page information
            const currentUrl = window.webContents.getURL()
            const currentDomain = currentUrl ? new URL(currentUrl).hostname.replace(/^www./, '') : ''

            console.log('currentDomain', currentDomain, 'conversationId', conversationId)

            const targetDomain = extractedDomain || currentDomain

            if (onStatusUpdate) {
                setLanguage(currentLang)
                const statusMessage = getStatusMessage('executingOperations', { domain: targetDomain })
                // console.log('statusMessage', statusMessage)
                onStatusUpdate('start', statusMessage)
                showToast(window, statusMessage)
            }

            try {
                // Load settings and create ChatService instance (needed for generation)
                const settingsStorage = new SettingsStorage()
                const savedSettings = settingsStorage.loadSettings()
                const config = savedSettings ? {
                    baseUrl: savedSettings.baseUrl,
                    apiKey: savedSettings.apiKey,
                    model: savedSettings.model
                } : chatConfig
                
                const chatService = new ChatService(config)

                // Check if domain operations exist, generate if needed
                // if (targetDomain && !checkDomainOperationsExists(targetDomain)) {
                //     try {
                //         if (onStatusUpdate) {
                //             // setLanguage(currentLang)
                //             const statusMessage = t('tools.webPilot.firstTimeExploring', { domain: targetDomain })
                //             showToast(window, statusMessage)
                //             onStatusUpdate('processing', statusMessage)
                //         }
                        
                //         await generateDomainOperations(
                //             targetDomain,
                //             window,
                //             chatService,
                //             onStatusUpdate,
                //             currentLang
                //         )
                //     } catch (genError) {
                //         const genErrorMessage = genError instanceof Error ? genError.message : String(genError)
                //         console.warn(`[WebPilot] Failed to generate operations for ${targetDomain}:`, genErrorMessage)
                //         // Continue with common operations if generation fails
                //         if (onStatusUpdate) {
                //             // setLanguage(currentLang)
                //             const statusMessage = t('tools.webPilot.generationFailedUsingCommon', { error: genErrorMessage })
                //             onStatusUpdate('processing', statusMessage)
                //         }
                //     } finally {
                //         // hideToast(window)
                //     }
                // }

                // Create operation tools for this domain
                const operationTools = createOperationTools(targetDomain, window)
                
                // Temporarily register operation tools
                const toolRegistry = new ToolRegistry()
                const originalTools = new Map<string, Tool>()
                for (const tool of operationTools) {
                    const existing = toolRegistry.getTool(tool.name)
                    if (existing) {
                        originalTools.set(tool.name, existing)
                    }
                    toolRegistry.registerTool(tool)
                }

                try {
                    // ChatService already created above for operation generation
                    const currentTitle = window.webContents.getTitle()
                    const currentPageInfo = currentUrl && currentUrl !== 'about:blank' ?
                        `\nCurrent page information:\n- URL: ${currentUrl}\n- Title: ${currentTitle || 'N/A'}`
                        : `\nCurrent page information:\nyou are not on any website. Please navigate to ${targetDomain} first.`
                    const domainInstruction = extractedDomain ? 
                    ` The user wants you to perform task on ${extractedDomain}.` :
                    '';
                    // Build system prompt
                    const systemPrompt = `You are a web automation assistant.${domainInstruction}

Information of the page you are currently on and available operations (tools) for this website have been provided. Use them to complete the task step by step.

Navigation decision guidelines:
- ONLY navigate to a new URL if:
  * The user explicitly asks to open/visit/go to a different URL/website
  * The current page is blank (about:blank) or not the target website
  * The task requires accessing a different page than the current one
- DO NOT navigate if:
  * The user wants to modify/add/change something on the current page (e.g., add styles, execute scripts, modify content)
  * The current page is already on the target website and the task can be completed on the current page
  * The user wants to interact with elements on the current page (click, fill, scroll, etc.)
  * Navigating would reset/refresh the page and lose previous script effects or page state
  
When navigation is needed:
- Navigate first, then extract page content if needed, then perform operations
- After navigation, wait for the page to load before proceeding

When navigation is NOT needed:
- Skip navigation and directly perform operations on the current page
- Extract page content only if you need to see the current page structure
- Use executeScript for modifying current page (styles, content, behavior)

About executeScript tool:
- executeScript is a resource-intensive tool that generates and executes custom JavaScript code
- Use it ONLY when simpler tools (click, fill, scroll, etc.) cannot accomplish the task
- executeScript is appropriate for cases such as:
  * Adding custom CSS styles or animations to elements
  * Modifying page structure or DOM elements dynamically
  * Implementing complex visual effects (particles, gradients, transitions)
  * Creating custom interactive elements or widgets
  * Manipulating page behavior or event handlers
  * Performing complex data transformations or calculations on the page
  * Adding custom functionality that requires JavaScript execution
- DO NOT use executeScript for simple tasks that can be done with basic operations:
  * Clicking buttons or links (use click tool)
  * Filling forms (use fill tool)
  * Scrolling the page (use scroll tool)
  * Extracting text or data (use extractPageContent tool)
- IMPORTANT: Do NOT call executeScript multiple times unless absolutely necessary:
  * If an executeScript call succeeds, trust the result and proceed - do NOT call it again just to verify
  * Only call executeScript again if the previous call failed or if you need to execute a DIFFERENT script for a DIFFERENT purpose
  * Repeatedly calling the same executeScript wastes resources and is unnecessary
  * If you need to check if something worked, use extractPageContent to inspect the page state instead
- CRITICAL: After calling executeScript successfully, especially for tasks involving website style modifications or visual effects:
  * If the executeScript call has successfully completed the user's request, you should END tool calls immediately
  * Do NOT perform additional operations after executeScript, as they may cause page refresh and invalidate the executed code
  * Once executeScript has fulfilled the user's requirement, stop tool execution and respond with a brief message "已成功完成任务" (Task completed successfully)
  * Keep responses concise and efficient - do not provide additional explanations or summaries

General workflow:
- First, determine if navigation is needed based on the guidelines above
- If navigation is needed: navigate → (extract page content if needed) → perform operations
- If navigation is NOT needed: (extract page content if needed) → perform operations directly
- Each operation result will be returned to you, use it to decide the next step
- Continue until the task is complete


${currentPageInfo}

Important: Only use the provided operation tools. Do not make up operations.`
                    // console.log(systemPrompt)
                    // Create initial message
                    const currentMessages: ChatMessage[] = []
                    currentMessages.push({
                        role: 'system',
                        content: systemPrompt
                    })

                    if (messages) {
                        for (const message of messages) {
                            if (message.role === 'user') {
                                currentMessages.push({
                                    role: 'user',
                                    content: message.content
                                } as ChatMessage)
                            } else {
                                let result = JSON.parse(message.content)
                                console.log('result', result)
                                if (result.data.messages && result.data.messages.length > 0) {
                                    currentMessages.push(...result.data.messages.map((msg: any) => {
                                        if (msg.role === 'tool') {
                                            let d = JSON.parse(msg.content)
                                            if (d.html) {
                                                return {...msg, content: JSON.stringify({
                                                    'success': d.success,
                                                    'title': d.title,
                                                    'url': d.url,
                                                    'content': '...'
                                                })}
                                            } else {
                                                return msg
                                            }
                                        } else {
                                            return msg
                                        }
                                    }))
                                }
                            }
                        }
                    }

                    currentMessages.push({
                        role: 'user',
                        content: instruction
                    })

                    console.log('WebPilotTool messages', currentMessages)

                    const results: any[] = []
                    let maxIterations = 50
                    let iteration = 0
                    let classIdLookup: Record<string, string> = {}
                    let shouldStop = false
                    const start = currentMessages.length

                    // Execute in a loop, allowing LLM to make tool calls
                    while (iteration < maxIterations) {
                        if (shouldStop) {
                            break
                        }
                        iteration++

                        // if (onStatusUpdate) {
                        //     const statusMessage = currentLang === 'zh'
                        //         ? `LLM决策中... (迭代 ${iteration}/${maxIterations})`
                        //         : `LLM deciding... (iteration ${iteration}/${maxIterations})`
                        //     onStatusUpdate('processing', statusMessage)
                        // }

                        let toolCallsToExecute: Array<{ id: string; name: string; arguments: any }> = []
                        let isExtractPageContent = false
                        let content = ''

                        // Generate response with tool calls
                        const handleToolCall = (toolCalls: Array<{ id: string; name: string; arguments: any }>) => {
                            toolCallsToExecute = toolCalls
                        }

                        // const handleToolCallDetected = (toolCallName: string, _index: number) => {
                        //     if (onStatusUpdate && toolCallName.includes('executeScript')) {
                        //         // setLanguage(currentLang)
                        //         const statusMessage = t('tools.webPilot.generateScriptAndExecute')
                        //         showToast(window, statusMessage)
                        //         onStatusUpdate('processing', statusMessage)
                        //     }
                        // }

                        // Get operation tool definitions for this domain
                        const operationToolDefinitions = getOperationToolDefinitions(targetDomain, window)

                        let hasContent = false
                        let finishReason: string | null = null

                        for await (const chunk of chatService.generateStreamingResponseWithTools(
                            currentMessages,
                            undefined,
                            undefined,
                            handleToolCall,
                            operationToolDefinitions, // Pass operation tools instead of default tools
                            // handleToolCallDetected
                        )) {
                            hasContent = hasContent || !!chunk.content
                            content += chunk.content || ''
                            if (chunk.finishReason) {
                                finishReason = chunk.finishReason
                            }
                        }

                        console.log('WebPilotTool finishReason', finishReason)

                        // If no tool calls or finish_reason is 'stop', we're done
                        if (toolCallsToExecute.length === 0 || finishReason === 'stop') {
                            break
                        }

                        // Execute tool calls
                        const toolResults: Array<{ tool_call_id: string; role: 'tool'; content: string }> = []
                        const assistantToolCalls: Array<{
                            id: string
                            type: 'function'
                            function: {
                                name: string
                                arguments: string
                            }
                        }> = []

                        for (const toolCall of toolCallsToExecute) {
                            if (shouldStop) {
                                break
                            }
                            console.log('WebPilotTool toolCall', targetDomain, toolCall)
                            // Check if this is an operation tool
                            if (toolCall.name.startsWith('webpilot_')) {
                                const opName = toolCall.name.split('_').pop()
                                console.log('WebPilotTool opName', opName)
                                if (!opName) {
                                    continue
                                }
                                if (onStatusUpdate) {
                                    const statusMessage = getStatusMessage(opName, toolCall.arguments)
                                    showToast(window, statusMessage)
                                    shouldStop = onStatusUpdate('processing', statusMessage)
                                }

                                if (toolCall.name.includes('extractPageContent')) {
                                    isExtractPageContent = true
                                }

                                // Execute the operation tool
                                const tool = toolRegistry.getTool(toolCall.name)
                                if (tool) {
                                    console.log('found tool', toolCall.name)
                                    const toolArguments = toolCall.arguments || {}
                                    if (toolArguments.selector && Object.keys(classIdLookup).length > 0) {
                                        toolArguments.selector = decodeSelector(toolArguments.selector, classIdLookup)
                                        console.log('decoded selector', toolArguments.selector)
                                        classIdLookup = {}
                                    }
                                    
                                    let toolResult: ToolResult
                                    
                                    // Special handling for executeScript: use LLM to generate and execute code
                                    if (toolCall.name.includes('executeScript')) {
                                        const description = toolArguments.description || toolArguments.code || ''
                                        if (!description) {
                                            toolResult = {
                                                success: false,
                                                error: 'Description parameter is required for executeScript'
                                            }
                                        } else {
                                            toolResult = await generateAndExecuteScript(
                                                window,
                                                chatService,
                                                description,
                                                currentLang,
                                                3, // maxRetries
                                                onStatusUpdate
                                            )
                                        }
                                    } else {
                                        // Normal tool execution
                                        toolResult = await tool.execute(
                                            toolCall.arguments || {},
                                            onStatusUpdate,
                                            currentLang,
                                            undefined,
                                            undefined
                                        )
                                    }

                                    if (tool.name.includes('_extractPageContent') && toolResult.success) {
                                        if (toolResult.data && toolResult.data.html) {
                                            console.log('origin length', toolResult.data.html.length)
                                            const { encodedHtml, lookup } = encodeClassAndId(toolResult.data.html)
                                            toolResult.data.html = encodedHtml
                                            classIdLookup = lookup
                                            console.log('encoded length', toolResult.data.html.length)
                                        }
                                    }

                                    if (tool.name.includes('_navigate')) {
                                        const statusMessage = getStatusMessage('extractPageContent', {})
                                        showToast(window, statusMessage)
                                    }

                                    console.log('WebPilotTool toolResult', toolCall.name, toolResult.success, toolResult.data?.message)

                                    results.push({
                                        operation: toolCall.name,
                                        params: toolCall.arguments,
                                        result: toolResult
                                    })

                                    // Format result for LLM
                                    const formattedResult = toolResult.success
                                        ? JSON.stringify(toolResult.data || { message: 'Operation completed' })
                                        : JSON.stringify({ error: toolResult.error || 'Operation failed' })
                                    
                                    toolResults.push({
                                        tool_call_id: toolCall.id,
                                        role: 'tool',
                                        content: formattedResult
                                    })

                                    assistantToolCalls.push({
                                        id: toolCall.id,
                                        type: 'function',
                                        function: {
                                            name: toolCall.name,
                                            arguments: JSON.stringify(toolCall.arguments || {})
                                        }
                                    })
                                }
                                // hideToast(window)
                            }
                        }

                        // Add assistant message with tool calls
                        if (assistantToolCalls.length > 0) {
                            currentMessages.push({
                                role: 'assistant',
                                content: '',
                                tool_calls: assistantToolCalls
                            } as ChatMessage)
                        } else {
                            currentMessages.push({
                                role: 'assistant',
                                content: content
                            } as ChatMessage)
                        }

                        // Add tool result messages
                        for (const toolResult of toolResults) {
                            currentMessages.push({
                                role: 'tool',
                                content: toolResult.content,
                                tool_call_id: toolResult.tool_call_id
                            } as ChatMessage)
                        }

                        if (!isExtractPageContent) {
                            for (const message of currentMessages) {
                                if (message.role === 'tool' && message.tool_call_id) {
                                    const toolCall = toolCallsToExecute.find(tc => tc.id === message.tool_call_id)
                                    if (toolCall && toolCall.name.includes('extractPageContent')) {
                                        // setLanguage(currentLang)
                                        message.content = t('tools.webPilot.pageContentExtracted')
                                    }
                                }
                            }
                        }

                    }

                    // Restore original tools
                    for (const tool of originalTools.values()) {
                        toolRegistry.registerTool(tool)
                    }

                    // Return window to pool (keep visible if showWindow is true)
                    browserWindowPool.release(conversationId || '', window, showWindow)

                    const successfulOps = results.filter(r => r.result?.success).length

                    if (onStatusUpdate) {
                        // setLanguage(currentLang)
                        const statusMessage = t('tools.webPilot.operationsSuccessful')
                        onStatusUpdate('end', statusMessage)
                    }

                    // const lastOperation = results[results.length - 1]
                    // let result: any = {}
                    // if (lastOperation && lastOperation.operation.includes('extractPageContent') && lastOperation.result.success) {
                    //     result = lastOperation.result.data
                    // } else {
                    //     // extract current page content
                    //     result = await window.webContents.executeJavaScript(loadCommonExtractPageContentCode())
                    // }

                    return {
                        success: results.length > 0? successfulOps > 0: true,
                        data: {
                            domain: targetDomain,
                            // operations: results,
                            messages: currentMessages.slice(start),
                            summary: {
                                total: results.length,
                                successful: successfulOps,
                                failed: results.length - successfulOps
                            }
                        }
                    }
                } catch (error) {
                    // Restore original tools on error
                    for (const tool of originalTools.values()) {
                        toolRegistry.registerTool(tool)
                    }

                    throw error
                }
            } catch (error) {
                // Return window to pool even on error (keep visible if showWindow is true)
                browserWindowPool.release(conversationId || '', window, showWindow)

                const errorMessage = error instanceof Error ? error.message : String(error)
                console.error('[WebPilot] Execution error:', errorMessage)

                if (onStatusUpdate) {
                    // setLanguage(currentLang)
                    const statusMessage = t('tools.webPilot.executionFailed', { error: errorMessage })
                    onStatusUpdate('end', statusMessage)
                }

                return {
                    success: false,
                    error: errorMessage
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error('[WebPilot] Error:', errorMessage)

            if (onStatusUpdate) {
                // setLanguage(currentLang)
                const statusMessage = t('tools.webPilot.error', { error: errorMessage })
                onStatusUpdate('end', statusMessage)
            }

            return {
                success: false,
                error: errorMessage
            }
        } finally {
            if (window) {
                hideToast(window)
            }
        }
    }
}

