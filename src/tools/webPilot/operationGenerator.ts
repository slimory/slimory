import { BrowserWindow, app } from 'electron'
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { ChatService, ChatMessage } from '../../services/chatService'
import { Operation, OperationScript } from './operationExecutor'
import { t, setLanguage } from '../../main/i18n'
// import { showToast } from './utils'

/**
 * Check if domain-specific operations file exists
 */
export function checkDomainOperationsExists(domain: string): boolean {
    const possiblePaths = getScriptPaths(domain)
    for (const path of possiblePaths) {
        if (existsSync(path)) {
            return true
        }
    }
    return false
}

/**
 * Get possible script paths for a domain (same logic as operationExecutor)
 * Domain-specific scripts are stored in scripts/domains/{domain}/
 * Common scripts are stored in scripts/operations.json
 */
function getScriptPaths(domain: string): string[] {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    const possiblePaths: string[] = []
    const cwd = process.cwd()

    // Common scripts are in scripts/operations.json, not in domains folder
    if (domain === 'common') {
        if (isDev) {
            possiblePaths.push(
                join(cwd, 'src', 'tools', 'webPilot', 'scripts', 'operations.json'),
                join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'operations.json')
            )
        }
        
        const appPath = app.getAppPath()
        const resourcesPath = process.resourcesPath || appPath
        
        possiblePaths.push(
            join(appPath, 'tools', 'webPilot', 'scripts', 'operations.json'),
            join(appPath, 'dist-electron', 'tools', 'webPilot', 'scripts', 'operations.json'),
            join(resourcesPath, 'tools', 'webPilot', 'scripts', 'operations.json'),
            join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'operations.json')
        )
    } else {
        // Domain-specific scripts are in scripts/domains/{domain}/
        if (isDev) {
            possiblePaths.push(
                join(cwd, 'src', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json'),
                join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json')
            )
        }

        // Try various app paths (for production)
        const appPath = app.getAppPath()
        const resourcesPath = process.resourcesPath || appPath
        
        possiblePaths.push(
            join(appPath, 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json'),
            join(appPath, 'dist-electron', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json'),
            join(resourcesPath, 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json'),
            join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json')
        )
    }

    return possiblePaths
}

/**
 * Get the source script path for saving (prefer src directory in dev)
 * Domain-specific scripts are saved to scripts/domains/{domain}/
 */
function getSourceScriptPath(domain: string): string {
    const cwd = process.cwd()
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    
    if (domain === 'common') {
        // Common scripts are in scripts/operations.json
        if (isDev) {
            return join(cwd, 'src', 'tools', 'webPilot', 'scripts', 'operations.json')
        } else {
            return join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'operations.json')
        }
    } else {
        // Domain-specific scripts are in scripts/domains/{domain}/
        if (isDev) {
            return join(cwd, 'src', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json')
        } else {
            // In production, save to dist-electron
            return join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json')
        }
    }
}

/**
 * Convert glob pattern to regex for URL matching
 */
export function convertGlobToRegex(glob: string): RegExp {
    // Escape special regex characters except * and ?
    let pattern = glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    
    // If pattern ends with a / (and not already with .*), add .* to match subsequent paths
    // This allows patterns like "https://example.com/path/" to match "https://example.com/path/anything"
    if (pattern.endsWith('/') && !pattern.endsWith('/.*')) {
        pattern += '.*'
    }
    
    // Anchor to start and end
    return new RegExp(`^${pattern}$`)
}

export function loadCommonCode(codeName: string): string {
    const cwd = process.cwd()
    const possiblePaths = [
        join(cwd, 'src', 'tools', 'webPilot', 'scripts', 'codes', `${codeName}.code.txt`),
        join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'codes', `${codeName}.code.txt`)
    ]
    
    for (const path of possiblePaths) {
        if (existsSync(path)) {
            try {
                return readFileSync(path, 'utf-8')
            } catch (error) {
                console.error(`[OperationGenerator] Failed to load common ${codeName} code from ${path}:`, error)
            }
        }
    }
    return ''
}

/**
 * Load common extractPageContent code from operations.json
 */
export function loadCommonExtractPageContentCode(): string {
    const code = loadCommonCode('extractPageContent')
    if (code) {
        return code
    }
    
    // Fallback to inline code if file not found
    console.warn('[OperationGenerator] Common extractPageContent code file not found, using fallback')
    return `(function() {
    try {
        const mainContent = document.body;
        let html = '';
        if (mainContent) {
            function isElementVisible(el) {
                if (!el || el.nodeType !== 1) return false;
                if (el.hasAttribute('hidden')) return false;
                if (el.getAttribute('aria-hidden') === 'true') return false;
                try {
                    const style = window.getComputedStyle(el);
                    if (style.display === 'none') return false;
                    if (style.visibility === 'hidden') return false;
                    if (style.opacity === '0') return false;
                    if (parseFloat(style.width) === 0 && parseFloat(style.height) === 0) {
                        if (!el.textContent || el.textContent.trim().length === 0) {
                            return false;
                        }
                    }
                } catch(e) {}
                return true;
            }
            const visibilityMap = new Map();
            const allElements = mainContent.querySelectorAll('*');
            allElements.forEach(el => {
                visibilityMap.set(el, isElementVisible(el));
            });
            visibilityMap.set(mainContent, isElementVisible(mainContent));
            const clone = mainContent.cloneNode(true);
            const originalElementsArray = [mainContent, ...Array.from(allElements)];
            const cloneElementsArray = [clone, ...Array.from(clone.querySelectorAll('*'))];
            const elementsToRemove = [];
            cloneElementsArray.forEach((cloneEl, idx) => {
                const originalEl = originalElementsArray[idx];
                if (originalEl && !visibilityMap.get(originalEl)) {
                    elementsToRemove.push(cloneEl);
                }
            });
            elementsToRemove.forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
            clone.querySelectorAll('script').forEach(s => s.remove());
            clone.querySelectorAll('style').forEach(s => s.remove());
            clone.querySelectorAll('svg').forEach(s => s.remove());
            const allCloneElements = clone.querySelectorAll('*');
            allCloneElements.forEach(el => {
                const attrs = Array.from(el.attributes);
                attrs.forEach(attr => {
                    if (attr.name !== 'class' && attr.name !== 'id' && attr.name !== 'href') {
                        el.removeAttribute(attr.name);
                    }
                });
            });
            const rootAttrs = Array.from(clone.attributes);
            rootAttrs.forEach(attr => {
                if (attr.name !== 'class' && attr.name !== 'id' && attr.name !== 'href') {
                    clone.removeAttribute(attr.name);
                }
            });
            html = clone.innerHTML || '';
        }
        html = html.replace(/\\x3C/g, '<').replace(/&lt;/g, '<').replace(/\\x3E/g, '>').replace(/&gt;/g, '>');
        html = html.replace(/<!--[\\s\\S]*?-->/g, '');
        html = html.replace(/<br\\s*\\/?>/gi, '');
        html = html.replace(/>\\s+</g, '><');
        const maxHtmlLength = 100000;
        const originalLength = html.length;
        if (html.length > maxHtmlLength) {
            html = html.substring(0, maxHtmlLength) + '... [truncated]';
        }
        return {
            success: true,
            url: window.location.href,
            title: document.querySelector('h1')?.innerText || document.title || '',
            html: html,
            htmlLength: originalLength
        };
    } catch(e) {
        return { success: false, error: 'Failed: ' + (e.message || String(e)) };
    }
})()`
}

/**
 * Extract HTML content and URL patterns from a page
 */
async function extractHtmlAndUrlPatterns(
    window: BrowserWindow,
    chatService: ChatService,
    currentUrl: string
): Promise<{
    htmlResult: { success: boolean; url: string; title: string; html: string; htmlLength: number } | null;
    extractedPatterns: Array<{ pattern: string; exampleUrls: string[]; description: string }>;
}> {
    // Load common extractPageContent code
    const commonExtractCode = loadCommonExtractPageContentCode()
    
    // Extract HTML content using common code
    const htmlResult = await window.webContents.executeJavaScript(commonExtractCode) as any

    if (!htmlResult?.success) {
        console.warn(`[OperationGenerator] Failed to extract HTML from ${currentUrl}`)
        return {
            htmlResult: null,
            extractedPatterns: []
        }
    }

    // Step 1: Extract URL patterns from HTML links using LLM
    let extractedPatterns: Array<{ pattern: string; exampleUrls: string[]; description: string }> = []
    try {
        // Extract all links from the page using JavaScript
        const linksResult = await window.webContents.executeJavaScript(`
            (function() {
                try {
                    const links = [];
                    const allLinks = document.querySelectorAll('a[href]');
                    const currentUrl = window.location.href;
                    const currentOrigin = window.location.origin;
                    
                    allLinks.forEach(link => {
                        try {
                            let href = link.getAttribute('href');
                            if (!href) return;
                            
                            // Convert relative URLs to absolute
                            if (href.startsWith('//')) {
                                href = window.location.protocol + href;
                            } else if (href.startsWith('/')) {
                                href = currentOrigin + href;
                            } else if (!href.startsWith('http://') && !href.startsWith('https://')) {
                                href = new URL(href, currentUrl).href;
                            }
                            
                            // Only include same-origin links
                            try {
                                const url = new URL(href);
                                if (url.origin === currentOrigin) {
                                    links.push({
                                        url: href,
                                        text: (link.textContent || '').trim().substring(0, 100)
                                    });
                                }
                            } catch(e) {
                                // Invalid URL, skip
                            }
                        } catch(e) {
                            // Skip invalid links
                        }
                    });
                    
                    return links;
                } catch(e) {
                    return [];
                }
            })()
        `) as Array<{ url: string; text: string }>

        if (linksResult && linksResult.length > 0) {
            const currentUrlObj = new URL(currentUrl)
            const currentPattern = urlToGlobPattern(currentUrlObj, currentUrlObj)
            
            // Normalize hostname (remove www. prefix for comparison)
            const normalizeHostname = (hostname: string): string => {
                return hostname.replace(/^www\./, '')
            }
            const currentHostname = normalizeHostname(currentUrlObj.hostname)
            
            // Filter URLs with same hostname
            const filteredUrls: string[] = []
            for (const link of linksResult) {
                try {
                    const url = new URL(link.url)
                    const linkHostname = normalizeHostname(url.hostname)
                    
                    // Skip if different hostname (normalized)
                    if (linkHostname !== currentHostname) {
                        continue
                    }
                    
                    // Skip the current URL itself
                    if (link.url === currentUrl) {
                        continue
                    }
                    
                    filteredUrls.push(link.url)
                } catch (e) {
                    // Skip invalid URLs
                    console.log('Error processing URL:', link.url, e)
                    continue
                }
            }
            
            if (filteredUrls.length > 0) {
                // Send URLs to LLM for pattern extraction
                const urlListText = filteredUrls.slice(0, 100).join('\n') // Limit to 100 URLs to avoid token limits
                const extractPatternsPrompt = `Analyze the following list of URLs from the same website and extract URL patterns.

Current URL: ${currentUrl}
Current URL Pattern: ${currentPattern}

URL List:
${urlListText}

Your task:
1. Group similar URLs together based on their structure
2. For each group, create a glob pattern (use * as wildcard for variable parts like IDs, slugs, etc.)
3. Provide 1-2 example URLs for each pattern
4. Generate a brief description for each pattern

Return a JSON array in this format:
[
  {
    "pattern": "https://example.com/category/*",
    "exampleUrls": ["https://example.com/category/item1", "https://example.com/category/item2"],
    "description": "Category item pages"
  },
  {
    "pattern": "https://example.com/user/*",
    "exampleUrls": ["https://example.com/user/john"],
    "description": "User profile pages"
  }
]

Important:
- Do NOT include the current URL's pattern (${currentPattern})
- Patterns should use glob syntax with * for variable parts
- Limit to top 10 most common patterns
- Sort by specificity (more specific patterns first, fewer wildcards first)
- Each pattern should have at least 1 example URL, preferably 2

Return only the JSON array, no other text.`

                const extractPatternsMessages: ChatMessage[] = [
                    {
                        role: 'system',
                        content: 'You are a URL pattern analyzer. Analyze URLs and extract common patterns using glob syntax. Return only valid JSON arrays.'
                    },
                    {
                        role: 'user',
                        content: extractPatternsPrompt
                    }
                ]

                let responseText = ''
                try {
                    for await (const chunk of chatService.generateStreamingResponse(extractPatternsMessages)) {
                        responseText += chunk.content
                    }
                    
                    // Extract JSON array from response
                    let jsonStr = responseText.trim()
                    // Remove markdown code blocks if present
                    if (jsonStr.startsWith('```')) {
                        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
                    }
                    jsonStr = jsonStr.trim()
                    
                    // Try to extract JSON array from the response
                    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
                    if (jsonMatch) {
                        jsonStr = jsonMatch[0]
                    }
                    
                    const parsed = JSON.parse(jsonStr) as Array<{ pattern: string; exampleUrls: string[]; description: string }>
                    
                    if (Array.isArray(parsed)) {
                        // Filter out the current pattern and validate
                        for (const item of parsed) {
                            if (item.pattern && item.exampleUrls && item.exampleUrls.length > 0 && item.description) {
                                // Skip the current page's pattern
                                if (item.pattern === currentPattern) {
                                    console.log('Skipping current pattern:', item.pattern)
                                    continue
                                }
                                
                                extractedPatterns.push({
                                    pattern: item.pattern,
                                    exampleUrls: item.exampleUrls.slice(0, 2),
                                    description: item.description
                                })
                            }
                        }
                        
                        // Sort by specificity (more specific patterns first)
                        extractedPatterns.sort((a, b) => {
                            const aWildcards = (a.pattern.match(/\*/g) || []).length
                            const bWildcards = (b.pattern.match(/\*/g) || []).length
                            return aWildcards - bWildcards
                        })
                        
                        // Limit to top 10 patterns
                        extractedPatterns = extractedPatterns.slice(0, 10)
                    }
                } catch (error) {
                    console.warn(`[OperationGenerator] Failed to extract patterns using LLM from ${currentUrl}:`, error)
                    if (responseText) {
                        console.log('LLM response:', responseText.substring(0, 500))
                    }
                }
            } else {
                console.log('No valid URLs found after filtering')
            }
        } else {
            console.log('No links found or linksResult is empty')
        }
    } catch (error) {
        console.warn(`[OperationGenerator] Failed to extract patterns from ${currentUrl}:`, error)
    }

    console.log('extractedPatterns', extractedPatterns)

    return {
        htmlResult,
        extractedPatterns
    }
}

/**
 * Generate extraction rule for a URL pattern using LLM
 */
/**
 * Test extraction code by executing it in the browser
 */
async function testExtractionCode(
    window: BrowserWindow,
    extractionCode: string
): Promise<{ valid: boolean; error?: string }> {
    try {
        // Check for invalid CSS selectors in the code before execution
        // Look for patterns like [data-ad-*], [class*="ad-*"], etc. that are invalid CSS selectors
        const invalidSelectorPatterns = [
            /\[data-[^\]]*\*[^\]]*\]/,  // [data-*] or [data-*-something] patterns
            /\[class\*="[^"]*\*[^"]*"\]/,  // [class*="...*..."] patterns
            /\[id\*="[^"]*\*[^"]*"\]/,  // [id*="...*..."] patterns
            /\[[a-zA-Z-]+\*[^\]]*\]/,  // Any attribute selector with * inside brackets (like [attr-*])
            /querySelector\(['"`]\[[^\]]*\*[^\]]*\]/,  // querySelector with invalid selector
            /querySelectorAll\(['"`]\[[^\]]*\*[^\]]*\]/  // querySelectorAll with invalid selector
        ]
        
        for (const pattern of invalidSelectorPatterns) {
            if (pattern.test(extractionCode)) {
                return {
                    valid: false,
                    error: 'Code contains invalid CSS selector. CSS selectors do not support wildcards (*) inside attribute brackets like [data-ad-*] or [class*="ad-*"]. Use manual iteration through elements instead: Array.from(element.querySelectorAll(\'*\')).forEach(el => { if (el.hasAttribute(\'data-ad\') || el.getAttribute(\'class\')?.includes(\'ad-\')) el.remove(); });'
                }
            }
        }
        
        // Escape the extraction code for embedding in template string
        // Need to escape backticks, ${, and backslashes
        const escapedCode = extractionCode
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/`/g, '\\`')     // Escape backticks
            .replace(/\${/g, '\\${')  // Escape template string interpolation
        
        // Create a test wrapper that executes the code and checks the result
        const testCode = `
            (function() {
                try {
                    ${escapedCode}
                    if (typeof extractPageContent !== 'function') {
                        return { valid: false, error: 'extractPageContent is not a function' };
                    }
                    const result = extractPageContent();
                    if (!result || typeof result !== 'object') {
                        return { valid: false, error: 'Function did not return an object' };
                    }
                    if (result.success !== true && result.success !== false) {
                        return { valid: false, error: 'Result missing success property' };
                    }
                    if (result.success === true) {
                        if (!result.url || !result.html || typeof result.htmlLength !== 'number') {
                            return { valid: false, error: 'Result missing required fields (url, html, htmlLength)' };
                        }
                    }
                    return { valid: true };
                } catch(e) {
                    return { valid: false, error: 'Execution error: ' + (e.message || String(e)) };
                }
            })()
        `
        
        const testResult = await window.webContents.executeJavaScript(testCode) as { valid: boolean; error?: string }
        return testResult
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}

async function generateExtractionRule(
    currentUrl: string,
    domain: string,
    htmlResult: { success: boolean; url: string; title: string; html: string; htmlLength: number },
    chatService: ChatService,
    urlPatterns: Array<{ pattern: string; extractionCode: string; description: string }>,
    window: BrowserWindow,
    pattern?: string
): Promise<string | null> {
    // Step 2: Generate extraction code for current URL's pattern
    // Use provided pattern if available, otherwise determine from URL
    const currentPattern = pattern || determineUrlPattern(currentUrl, domain)
    const generateRulePrompt = `Analyze the following HTML content and generate a JavaScript extraction function for URL pattern: ${currentPattern}

HTML content:
${htmlResult.html.substring(0, 60000)}

Current URL: ${currentUrl}
Page title: ${htmlResult.title || 'N/A'}

Your task is to write a JavaScript function that extracts essential HTML content from this page. The extracted HTML will be given to an AI agent so it can:
1. Understand what the user sees on the page
2. Identify interactive elements (buttons, links, forms, inputs, etc.)
3. Perform DOM operations to complete user instructions

Requirements:
1. Extract only essential visible content (main content, navigation, interactive elements)
2. Remove unnecessary elements (scripts, styles, ads, tracking codes, etc.)
3. Remove unnecessary HTML tag attributes (keep only class, id, and href)
4. Remove HTML comments and code comments
5. Preserve structure needed for interaction:
   - Keep class, id, and href attributes (needed for DOM operations)
   - Keep button, link, form, input, select, textarea elements
   - Keep text content and structure
6. Remove invisible elements (display: none, visibility: hidden, etc.)
7. Minimize token usage while maintaining visual structure
8. The function must be named "extractPageContent" and return an object with: { success: true, url: string, title: string, html: string, htmlLength: number }

CRITICAL CODE SAFETY REQUIREMENTS:
- Always check for null/undefined before using DOM elements: if (!element) return;
- Wrap all querySelector/querySelectorAll calls in try-catch blocks
- NEVER use invalid CSS selectors like [data-ad-*] or [class*="ad-"] - these are NOT valid CSS selectors
- To match attributes with patterns, iterate through elements and check attributes manually:
  Example: Array.from(element.querySelectorAll('*')).forEach(el => {
    if (el.hasAttribute('data-ad') || el.getAttribute('class')?.includes('ad-')) {
      el.remove();
    }
  });
- Always validate selectors before using them in querySelector/querySelectorAll
- Use optional chaining (?.) when accessing properties that might not exist

Example function structure:
function extractPageContent() {
    try {
        // Always check for null/undefined
        const mainContent = document.querySelector('main') || document.body;
        if (!mainContent) {
            return { success: false, error: 'Main content not found' };
        }
        
        // Safe selector usage with try-catch
        let elementsToRemove = [];
        try {
            elementsToRemove = Array.from(mainContent.querySelectorAll('script, style'));
        } catch(e) {
            console.warn('Selector error:', e);
        }
        
        // For attribute pattern matching, iterate manually
        Array.from(mainContent.querySelectorAll('*')).forEach(el => {
            const attrs = Array.from(el.attributes);
            attrs.forEach(attr => {
                if (attr.name.startsWith('data-ad-') || attr.name.includes('ad-')) {
                    el.remove();
                }
            });
        });
        
        // Clone and clean HTML
        const clone = mainContent.cloneNode(true);
        // ... cleaning logic ...
        
        return {
            success: true,
            url: window.location.href,
            title: document.querySelector('h1')?.innerText || document.title || '',
            html: cleanedHtml,
            htmlLength: cleanedHtml.length
        };
    } catch(e) {
        return { success: false, error: e.message };
    }
}

Return a JSON object:
{
  "pattern": "${currentPattern}",
  "extractionCode": "function extractPageContent() {\\n  try {\\n    // Your complete JavaScript code here\\n    return { success: true, url: window.location.href, title: '', html: '', htmlLength: 0 };\\n  } catch(e) {\\n    return { success: false, error: e.message };\\n  }\\n}",
  "description": "Brief description of this page type"
}

IMPORTANT: The extractionCode must be a complete, valid JavaScript function definition. Use \\n for newlines in the JSON string. The function must be named "extractPageContent" and return the required object format.`

    const generateRuleMessages: ChatMessage[] = [
        {
            role: 'system',
            content: 'You are a web extraction code generator. Analyze HTML and create JavaScript functions that extract essential content. The code must preserve class, id, and href attributes for DOM operations. CRITICAL: Always check for null/undefined, wrap querySelector calls in try-catch, and NEVER use invalid CSS selectors like [data-ad-*]. Use manual iteration for attribute pattern matching. Return only valid JSON with properly escaped JavaScript code.'
        },
        {
            role: 'user',
            content: generateRulePrompt
        }
    ]

    // Retry up to 3 times
    const maxRetries = 3
    let lastError: string | undefined
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            let responseText = ''
            for await (const chunk of chatService.generateStreamingResponse(generateRuleMessages)) {
                responseText += chunk.content
            }
            
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0])
                if (parsed.pattern && parsed.extractionCode && parsed.description) {
                    // Test the generated code
                    const testResult = await testExtractionCode(window, parsed.extractionCode)
                    console.log('testResult', testResult)
                    if (testResult.valid) {
                        // Code is valid, save it
                        const existingIndex = urlPatterns.findIndex(p => p.pattern === parsed.pattern)
                        if (existingIndex >= 0) {
                            // Update existing pattern
                            urlPatterns[existingIndex] = {
                                pattern: parsed.pattern,
                                extractionCode: parsed.extractionCode,
                                description: parsed.description
                            }
                        } else {
                            // Add new pattern
                            urlPatterns.push({
                                pattern: parsed.pattern,
                                extractionCode: parsed.extractionCode,
                                description: parsed.description
                            })
                        }
                        return parsed.pattern // Return the actual generated pattern
                    } else {
                        // Code is invalid, record error and retry
                        lastError = testResult.error || 'Code validation failed'
                        console.warn(`[OperationGenerator] Generated code failed validation (attempt ${attempt + 1}/${maxRetries}):`, lastError)
                        
                        // If not the last attempt, add error feedback to prompt and retry
                        if (attempt < maxRetries - 1) {
                            generateRuleMessages.push({
                                role: 'assistant',
                                content: responseText
                            })
                            generateRuleMessages.push({
                                role: 'user',
                                content: `The generated code failed validation: ${lastError}. Please fix the code and ensure:\n1. The function is named "extractPageContent"\n2. It returns an object with { success: boolean, url: string, title: string, html: string, htmlLength: number }\n3. The code is valid JavaScript that can execute without errors\n4. All required fields are present when success is true\n5. Always check for null/undefined before using DOM elements\n6. Wrap querySelector/querySelectorAll in try-catch blocks\n7. NEVER use invalid CSS selectors like [data-ad-*] or [class*="ad-"] - use manual iteration instead\n8. Validate all selectors before using them`
                            })
                            continue
                        }
                    }
                }
            }
            
            // If we get here, JSON parsing or validation failed
            if (attempt < maxRetries - 1) {
                lastError = 'Failed to parse JSON or missing required fields'
                console.warn(`[OperationGenerator] Failed to parse response (attempt ${attempt + 1}/${maxRetries})`)
                continue
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error)
            console.warn(`[OperationGenerator] Error generating extraction rule (attempt ${attempt + 1}/${maxRetries}):`, lastError)
            
            if (attempt < maxRetries - 1) {
                // Add error context for retry
                generateRuleMessages.push({
                    role: 'user',
                    content: `Previous attempt failed with error: ${lastError}. Please ensure:\n1. The code is valid JavaScript and returns the correct format\n2. Always check for null/undefined before using DOM elements\n3. Wrap querySelector/querySelectorAll in try-catch blocks\n4. NEVER use invalid CSS selectors like [data-ad-*] - use manual iteration for attribute pattern matching`
                })
                continue
            }
        }
    }
    
    // All retries failed
    console.error(`[OperationGenerator] Failed to generate valid extraction rule after ${maxRetries} attempts for ${currentUrl}. Last error: ${lastError}`)
    return null
}

/**
 * Convert URL to glob pattern
 */
function urlToGlobPattern(url: URL, _baseUrl: URL): string {
    let pattern = `${url.protocol}//${url.host}`
    
    // Handle pathname
    const pathSegments = url.pathname.split('/').filter(s => s.length > 0)
    
    if (pathSegments.length === 0) {
        pattern += '/'
    } else {
        // Replace segments that look like IDs with wildcards
        const processedSegments = pathSegments.map((segment, idx) => {
            // If segment looks like an ID (long alphanumeric), replace with *
            // Check for YouTube-style video IDs (11 characters) or channel IDs
            if (/^[a-zA-Z0-9_-]+$/.test(segment)) {
                // YouTube video IDs are typically 11 characters
                if (segment.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(segment)) {
                    return '*'
                }
                // Long IDs (likely unique identifiers)
                if (segment.length > 15) {
                    return '*'
                }
                // If it's the last segment and looks like a resource ID, replace with *
                if (idx === pathSegments.length - 1 && segment.length > 8) {
                    return '*'
                }
            }
            return segment
        })
        pattern += '/' + processedSegments.join('/')
    }
    
    // Handle query parameters
    if (url.search) {
        const params = new URLSearchParams(url.search)
        const paramKeys = Array.from(params.keys())
        if (paramKeys.length > 0) {
            // Sort parameter keys for consistent pattern matching
            const sortedKeys = paramKeys.sort()
            // Replace parameter values with wildcards
            const paramPattern = sortedKeys.map(key => `${key}=*`).join('&')
            pattern += '?' + paramPattern
        }
    }
    
    return pattern
}

/**
 * Determine URL pattern from a URL
 */
function determineUrlPattern(url: string, domain: string): string {
    try {
        const urlObj = new URL(url)
        const pathname = urlObj.pathname
        const search = urlObj.search
        
        // Extract path segments
        const segments = pathname.split('/').filter(s => s.length > 0)
        
        // Build pattern
        let pattern = `${urlObj.protocol}//${urlObj.host}`
        
        if (segments.length === 0) {
            // Homepage
            pattern += '/'
        } else {
            // Replace last segment with wildcard if it looks like an ID
            const lastSegment = segments[segments.length - 1]
            if (/^[a-zA-Z0-9_-]+$/.test(lastSegment) && lastSegment.length > 10) {
                // Likely an ID, replace with wildcard
                pattern += '/' + segments.slice(0, -1).join('/') + '/*'
            } else {
                // Keep as is, but add wildcard for potential variations
                pattern += '/' + segments.join('/') + '*'
            }
        }
        
        // Handle query parameters
        if (search) {
            const params = new URLSearchParams(search)
            const paramKeys = Array.from(params.keys())
            if (paramKeys.length > 0) {
                // Replace parameter values with wildcards
                const paramPattern = paramKeys.map(key => `${key}=*`).join('&')
                pattern += '?' + paramPattern
            }
        }
        
        return pattern
    } catch (error) {
        // Fallback: use domain with wildcard
        return `https://${domain}/*`
    }
}

/**
 * Generate extractPageContent operation by exploring URLs and collecting patterns
 */
export async function generateExtractPageContentOperation(
    domain: string,
    window: BrowserWindow,
    chatService: ChatService,
    onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => void,
    currentLang: string = 'zh',
    maxPatterns: number = 5
): Promise<Operation> {
    // URL queue: URLs to visit with their corresponding patterns
    const urlQueue: Array<{ url: string; pattern?: string }> = []
    const visitedUrls = new Set<string>([`https://www.${domain}`, `https://www.${domain}/`])
    const urlPatterns: Array<{ pattern: string; extractionCode: string; description: string }> = []
    // Map to track URL to pattern mapping from extractedPatterns
    const urlToPatternMap = new Map<string, string>()
    // Set to track successfully processed patterns
    const processedPatterns = new Set<string>()
    
    // Start with homepage (no pattern yet)
    const homepage = `https://${domain}`
    urlQueue.push({ url: homepage })

    // Process URLs from queue
    while (urlQueue.length > 0 && urlPatterns.length < maxPatterns) {
        const { url: currentUrl, pattern: currentUrlPattern } = urlQueue.shift()!
        
        if (visitedUrls.has(currentUrl)) {
            continue
        }
        visitedUrls.add(currentUrl)

        if (onStatusUpdate) {
            setLanguage(currentLang)
            const statusMessage = t('tools.webPilot.visitingUrl', { 
                url: currentUrl, 
                current: urlPatterns.length.toString(), 
                max: maxPatterns.toString() 
            })
            onStatusUpdate('processing', statusMessage)
        }

        // Navigate to URL
        try {
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Navigation timeout'))
                }, 10000)

                window.webContents.once('did-finish-load', () => {
                    clearTimeout(timeout)
                    resolve()
                })

                window.webContents.once('did-fail-load', (_event, _errorCode, errorDescription) => {
                    clearTimeout(timeout)
                    reject(new Error(`Navigation failed: ${errorDescription}`))
                })

                window.loadURL(currentUrl)
            })
            await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (error) {
            console.warn(`[OperationGenerator] Failed to navigate to ${currentUrl}:`, error)
            continue
        }

        // Extract HTML content and URL patterns
        const { htmlResult, extractedPatterns } = await extractHtmlAndUrlPatterns(
            window,
            chatService,
            currentUrl
        )

        if (!htmlResult?.success) {
            continue
        }

        // Step 2: Generate extraction rule for current URL's pattern
        // Use the pattern from queue if available, or look it up from map, or use determineUrlPattern as fallback
        const patternForRule = currentUrlPattern || urlToPatternMap.get(currentUrl)
        const generatedPattern = await generateExtractionRule(
            currentUrl,
            domain,
            htmlResult,
            chatService,
            urlPatterns,
            window,
            patternForRule
        )
        
        // If successfully generated extraction rule, mark the pattern as processed
        // Use the actual generated pattern (which may differ from patternForRule)
        if (generatedPattern) {
            processedPatterns.add(generatedPattern)
        }

        // Add example URLs to queue with their corresponding patterns
        // Only add if the pattern hasn't been successfully processed yet
        for (const patternInfo of extractedPatterns) {
            // Skip if this pattern has already been successfully processed
            if (processedPatterns.has(patternInfo.pattern)) {
                continue
            }
            
            if (patternInfo.exampleUrls && patternInfo.exampleUrls.length > 0) {
                const exampleUrl = patternInfo.exampleUrls[0]
                if (!visitedUrls.has(exampleUrl) && !urlQueue.some(item => item.url === exampleUrl)) {
                    urlQueue.push({ url: exampleUrl, pattern: patternInfo.pattern })
                    // Also store in map for lookup
                    urlToPatternMap.set(exampleUrl, patternInfo.pattern)
                }
            }
        }
    }

    // Generate extractPageContent operation from collected patterns
    if (urlPatterns.length === 0) {
        throw new Error('No URL patterns extracted during exploration')
    }

    return generateExtractPageContentOperationFromPatterns(urlPatterns)
}

/**
 * Generate domain-specific operations using LLM exploration
 */
export async function generateDomainOperations(
    domain: string,
    window: BrowserWindow,
    chatService: ChatService,
    onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => void,
    currentLang: string = 'zh',
    _maxPatterns: number = 5
): Promise<OperationScript> {
    try {
        const operations: Operation[] = []

        // Generate extractPageContent operation
        // const extractPageContentOperation = await generateExtractPageContentOperation(
        //     domain,
        //     window,
        //     chatService,
        //     onStatusUpdate,
        //     currentLang,
        //     maxPatterns
        // )
        // operations.push(extractPageContentOperation)

        // Generate search operation
        const searchOperation = await generateSearchOperation(
            domain,
            window,
            chatService,
            onStatusUpdate,
            currentLang
        )
        let script: OperationScript = {
            domain: domain,
            operations: []
        }
        if (searchOperation) {
            if (searchOperation.code) {
                operations.push({...searchOperation, generatedAt: new Date().toISOString()})
            }

            // Create operation script
            script = {
                domain: domain,
                operations: operations
            }

            // Save to file
            saveOperationsToFile(domain, script)
        }

        // if (onStatusUpdate) {
        //     setLanguage(currentLang)
        //     const statusMessage = t('tools.webPilot.completedGenerated', { count: operations.length.toString() })
        //     onStatusUpdate('processing', statusMessage)
        // }

        return script
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[OperationGenerator] Error:', errorMessage)

        // if (onStatusUpdate) {
        //     setLanguage(currentLang)
        //     const statusMessage = t('tools.webPilot.generationFailed', { error: errorMessage })
        //     onStatusUpdate('processing', statusMessage)
        // }

        throw error
    }
}

/**
 * Generate extractPageContent operation from URL patterns
 */
function generateExtractPageContentOperationFromPatterns(
    patterns: Array<{ pattern: string; extractionCode: string; description: string }>
): Operation {
    // Sort patterns by specificity (more specific first)
    const sortedPatterns = [...patterns].sort((a, b) => {
        const aWildcards = (a.pattern.match(/\*/g) || []).length
        const bWildcards = (b.pattern.match(/\*/g) || []).length
        return aWildcards - bWildcards
    })

    console.log('sortedPatterns', sortedPatterns)
    console.log('patterns', patterns)

    // Generate JavaScript code for pattern matching and extraction
    const patternMatchingCode = sortedPatterns.map((p, idx) => {
        const regex = convertGlobToRegex(p.pattern)
        // Extract the pattern from regex and properly escape for JavaScript
        const regexSource = regex.source
        // Escape the extraction code for embedding in template string
        // Need to escape backticks, ${, and backslashes
        const escapedCode = p.extractionCode
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/`/g, '\\`')     // Escape backticks
            .replace(/\${/g, '\\${')  // Escape template string interpolation
        
        return `
        // Pattern ${idx + 1}: ${p.description} (${p.pattern})
        if (/${regexSource}/.test(currentUrl)) {
            try {
                // Execute the extraction code for this pattern
                ${escapedCode}
                if (typeof extractPageContent === 'function') {
                    const result = extractPageContent();
                    if (result && result.success) {
                        return {
                            ...result,
                            pattern: ${JSON.stringify(p.pattern)},
                            description: ${JSON.stringify(p.description)}
                        };
                    }
                }
            } catch(e) {
                console.warn('Extraction code failed for pattern ${p.pattern}:', e);
            }
        }`
    }).join('\n')

    const code = `(function() {
        try {
            const currentUrl = window.location.href;
            ${patternMatchingCode}
            
            // Fallback: if no pattern matches, return failure
            return {
                success: false,
                error: 'No URL pattern matched for: ' + currentUrl,
                url: currentUrl
            };
        } catch(e) {
            return { success: false, error: 'Failed: ' + (e.message || String(e)) };
        }
    })()`

    return {
        name: 'extractPageContent',
        description: `Extract optimized HTML content from the current page based on URL patterns. This operation automatically selects the appropriate extraction rule based on the current page URL to minimize token usage while preserving essential page structure.`,
        code: code,
        waitConditions: ['domContentLoaded', 'networkIdle:2000'],
        parameters: {},
        timeout: 30000
    }
}

/**
 * Generate search operation for a domain
 * Navigates to the domain, extracts page content, and uses LLM to generate search JS code
 */
async function generateSearchOperation(
    domain: string,
    window: BrowserWindow,
    chatService: ChatService,
    _onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => void,
    _currentLang: string = 'zh'
): Promise<Operation | null> {
    try {
        // Step 1: Navigate to domain homepage
        const homepageUrl = domain.startsWith('http') ? domain : `https://${domain}`
        
        // if (onStatusUpdate) {
        //     setLanguage(currentLang)
        //     const statusMessage = t('tools.webPilot.analyzingSearch', { domain })
        //     // showToast(window, statusMessage)
        //     onStatusUpdate('processing', statusMessage)
        // }

        // Navigate to homepage
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Navigation timeout'))
            }, 30000)

            window.webContents.once('did-finish-load', () => {
                clearTimeout(timeout)
                resolve()
            })

            window.webContents.once('did-fail-load', (_event, _errorCode, errorDescription) => {
                clearTimeout(timeout)
                reject(new Error(`Navigation failed: ${errorDescription}`))
            })

            window.loadURL(homepageUrl)
        })
        
        // Wait for page to fully load
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Step 2: Extract HTML content using common code
        const commonExtractCode = loadCommonExtractPageContentCode()
        const htmlResult = await window.webContents.executeJavaScript(commonExtractCode) as any

        if (!htmlResult?.success) {
            console.warn(`[OperationGenerator] Failed to extract HTML from ${homepageUrl}`)
            return null
        }

        // Step 3: Use LLM to generate search operation code
        // if (onStatusUpdate) {
        //     setLanguage(currentLang)
        //     const statusMessage = t('tools.webPilot.generatingSearchCode')
        //     // showToast(window, statusMessage)
        //     onStatusUpdate('processing', statusMessage)
        // }

        const generateSearchPrompt = `Analyze the following HTML content from ${domain} and generate a JavaScript function that performs a search operation.

HTML content:
${htmlResult.html.substring(0, 60000)}

Current URL: ${htmlResult.url}
Page title: ${htmlResult.title || 'N/A'}

Your task is to write a JavaScript function that:
1. Finds the search input field (look for input elements with type="search", type="text" in search forms, or elements with search-related classes/ids)
2. Fills in the search query
3. Submits the search (either by clicking a search button, pressing Enter, or triggering form submission)

Requirements:
1. The function must accept a "query" parameter (the search term)
2. The function must find the search input using CSS selectors
3. The function must handle different search implementations:
   - Input field with a submit button
   - Input field that submits on Enter key
   - Form with search input
4. The function must return an object with: { success: boolean, message?: string, error?: string }
5. Always check for null/undefined before using DOM elements
6. Use try-catch blocks for error handling
7. The function should be named "performSearch"

CRITICAL CODE SAFETY REQUIREMENTS:
- Always check for null/undefined before using DOM elements: if (!element) return { success: false, error: 'Element not found' };
- Wrap all querySelector/querySelectorAll calls in try-catch blocks
- Use optional chaining (?.) when accessing properties that might not exist
- Handle cases where search input or button might not exist

Example function structure:
function performSearch(query) {
    try {
        // Find search input - try multiple common selectors
        let searchInput = null;
        const selectors = [
            'input[type="search"]',
            'input[name*="search" i]',
            'input[id*="search" i]',
            'input[class*="search" i]',
            'input[placeholder*="search" i]',
            '#search',
            '.search-input',
            'input[type="text"]' // fallback
        ];
        
        for (const selector of selectors) {
            try {
                searchInput = document.querySelector(selector);
                if (searchInput) break;
            } catch(e) {
                continue;
            }
        }
        
        if (!searchInput) {
            return { success: false, error: 'Search input not found' };
        }
        
        // Fill in the search query
        searchInput.value = query;
        searchInput.focus();
        
        // Trigger input event to ensure the value is set
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Try to submit the search
        // Method 1: Find and click search button
        const searchButton = searchInput.closest('form')?.querySelector('button[type="submit"], input[type="submit"], button:not([type]), [class*="search" i][class*="button" i]');
        if (searchButton) {
            searchButton.click();
            return { success: true, message: 'Search submitted via button click' };
        }
        
        // Method 2: Submit the form
        const form = searchInput.closest('form');
        if (form) {
            form.submit();
            return { success: true, message: 'Search submitted via form submit' };
        }
        
        // Method 3: Press Enter key
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        });
        searchInput.dispatchEvent(enterEvent);
        
        return { success: true, message: 'Search query entered, Enter key pressed' };
    } catch(e) {
        return { success: false, error: 'Failed to perform search: ' + (e.message || String(e)) };
    }
}

Return a JSON object:
{
  "searchCode": "function performSearch(query) {\\n  try {\\n    // Your complete JavaScript code here\\n    return { success: true, message: 'Search performed' };\\n  } catch(e) {\\n    return { success: false, error: e.message };\\n  }\\n}",
  "description": "Brief description of how search works on this site",
  "inputSelector": "CSS selector for the search input (e.g., 'input[type=\"search\"]')"
}

IMPORTANT: The searchCode must be a complete, valid JavaScript function definition. Use \\n for newlines in the JSON string. The function must be named "performSearch" and accept a "query" parameter.`

        const generateSearchMessages: ChatMessage[] = [
            {
                role: 'system',
                content: 'You are a web automation code generator. Analyze HTML and create JavaScript functions that perform search operations. The code must find search inputs, fill them, and submit searches. Always check for null/undefined, wrap querySelector calls in try-catch, and handle different search implementations. Return only valid JSON with properly escaped JavaScript code.'
            },
            {
                role: 'user',
                content: generateSearchPrompt
            }
        ]

        // Retry up to 2 times
        const maxRetries = 2
        let lastError: string | undefined
        let searchCode: string | null = null
        let description: string = ''
        let inputSelector: string = ''

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                let responseText = ''
                for await (const chunk of chatService.generateStreamingResponse(generateSearchMessages)) {
                    responseText += chunk.content
                }

                // Extract JSON from response
                const jsonMatch = responseText.match(/\{[\s\S]*\}/)
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0])
                    if (parsed.searchCode && parsed.description) {
                        searchCode = parsed.searchCode
                        description = parsed.description
                        inputSelector = parsed.inputSelector || 'input[type="search"]'
                        break
                    }
                }

                if (!searchCode) {
                    lastError = 'Failed to parse LLM response or missing searchCode'
                }
            } catch (error) {
                lastError = error instanceof Error ? error.message : String(error)
                console.warn(`[OperationGenerator] Attempt ${attempt + 1} failed:`, lastError)
            }
        }

        if (!searchCode) {
            console.warn(`[OperationGenerator] Failed to generate search operation after ${maxRetries} attempts:`, lastError)
            return {
                name: 'search',
                description: '',
                code: '',
                waitConditions: [],
                parameters: {},
                timeout: 1000
            }
        }

        // Step 4: Test the generated code
        const testCode = `
            (function() {
                try {
                    ${searchCode}
                    if (typeof performSearch !== 'function') {
                        return { valid: false, error: 'performSearch is not a function' };
                    }
                    // Test with a dummy query (don't actually submit)
                    const testResult = performSearch('test');
                    if (!testResult || typeof testResult !== 'object') {
                        return { valid: false, error: 'Function did not return an object' };
                    }
                    if (testResult.success !== true && testResult.success !== false) {
                        return { valid: false, error: 'Result missing success property' };
                    }
                    return { valid: true };
                } catch(e) {
                    return { valid: false, error: 'Execution error: ' + (e.message || String(e)) };
                }
            })()
        `

        try {
            const testResult = await window.webContents.executeJavaScript(testCode) as { valid: boolean; error?: string }
            if (!testResult.valid) {
                console.warn(`[OperationGenerator] Generated search code failed validation:`, testResult.error)
                // Still return the operation, but log the warning
            }
        } catch (error) {
            console.warn(`[OperationGenerator] Failed to test search code:`, error)
            // Still return the operation
        }

        // Step 5: Create the operation
        // Escape the search code for embedding in template string
        const escapedSearchCode = searchCode
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/`/g, '\\`')     // Escape backticks
            .replace(/\${/g, '\\${')  // Escape template string interpolation

        const operationCode = `(function() {
            try {
                const query = '{{query}}';
                ${escapedSearchCode}
                if (typeof performSearch === 'function') {
                    return performSearch(query);
                } else {
                    return { success: false, error: 'performSearch function not found' };
                }
            } catch(e) {
                return { success: false, error: 'Failed to perform search: ' + (e.message || String(e)) };
            }
        })()`

        return {
            name: 'search',
            description: description || `Search on ${domain}. ${inputSelector ? `Uses selector: ${inputSelector}` : ''}`,
            code: operationCode,
            waitConditions: ['networkIdle:1000'],
            parameters: {
                query: {
                    type: 'string',
                    required: true,
                    description: `The search query to enter (e.g., '${domain.includes('youtube') ? 'trump' : 'example search'}')`
                }
            },
            timeout: 10000
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[OperationGenerator] Failed to generate search operation for ${domain}:`, errorMessage)
        return null
    }
}

/**
 * Save operations to domain-specific operations.json file
 * Code is saved to separate .code.txt files to avoid JSON escaping issues
 */
export function saveOperationsToFile(domain: string, script: OperationScript): void {
    const filePath = getSourceScriptPath(domain)
    const dirPath = dirname(filePath)
    
    try {
        // Create directory if it doesn't exist
        if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true })
        }

        // Create codes directory if it doesn't exist
        const codesDir = join(dirPath, 'codes')
        if (!existsSync(codesDir)) {
            mkdirSync(codesDir, { recursive: true })
        }

        // Save each operation's code to a separate file in codes directory
        const operationsWithCodePaths = script.operations.map(op => {
            // Generate code file path: {operationName}.code.txt
            const codeFileName = `${op.name}.code.txt`
            const codeFilePath = join(codesDir, codeFileName)
            
            // Save code to file
            try {
                writeFileSync(codeFilePath, op.code, 'utf-8')
                console.log(`[OperationGenerator] Saved code for ${op.name} to ${codeFilePath}`)
            } catch (error) {
                console.error(`[OperationGenerator] Failed to save code for ${op.name}:`, error)
                throw error
            }
            
            // Return operation with code path instead of code content
            return {
                ...op,
                code: codeFileName // Store only the filename (relative path)
            }
        })

        // Create script object with code paths
        const scriptWithCodePaths: OperationScript = {
            ...script,
            operations: operationsWithCodePaths
        }

        // Write operations file
        writeFileSync(filePath, JSON.stringify(scriptWithCodePaths, null, 2), 'utf-8')
        console.log(`[OperationGenerator] Saved operations to ${filePath}`)
    } catch (error) {
        console.error(`[OperationGenerator] Failed to save operations to ${filePath}:`, error)
        throw error
    }
}

