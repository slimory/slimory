import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * Prompt loader that supports:
 * - Header comments (HTML-style comments that are excluded from the prompt)
 * - Variable substitution with {{variable}} syntax
 * - Conditional sections based on variable values
 */
export class PromptLoader {
    private promptsDir: string

    constructor(promptsDir?: string) {
        if (promptsDir) {
            this.promptsDir = promptsDir
        } else {
            // Use ES module compatible way to get directory path
            const __filename = fileURLToPath(import.meta.url)
            const __dirname = path.dirname(__filename)
            this.promptsDir = __dirname
        }
    }

    /**
     * Load a prompt template from file and process it
     * @param templateName Name of the template file (without .md extension)
     * @param variables Variables to substitute in the template
     * @returns Processed prompt string
     */
    loadPrompt(templateName: string, variables: Record<string, string | undefined> = {}): string {
        try {
            const templatePath = path.join(this.promptsDir, `${templateName}.md`)
            const template = fs.readFileSync(templatePath, 'utf-8')
            
            // Remove header comments (HTML-style comments at the beginning)
            let prompt = this.removeHeaderComments(template)
            
            // Process conditional sections
            prompt = this.processConditionalSections(prompt, variables)
            // Replace variables in template
            prompt = this.replaceVariables(prompt, variables)
            
            return prompt.trim()
        } catch (error) {
            console.error(`Failed to load prompt template ${templateName}:`, error)
            throw error
        }
    }

    /**
     * Remove HTML-style comments from the header of the template
     * Comments are only removed if they appear at the very beginning of the file
     */
    private removeHeaderComments(template: string): string {
        // Match HTML-style comments at the start of the file
        // Format: <!-- ... -->
        const commentPattern = /^<!--[\s\S]*?-->\s*/m
        return template.replace(commentPattern, '')
    }

    /**
     * Process conditional sections in the template
     * Format: {{#if variable}}...{{/if}}
     * The section is included only if the variable is truthy (not empty, undefined, null, or 'false')
     * Supports nested {{#if}} blocks
     */
    private processConditionalSections(template: string, variables: Record<string, string | undefined>): string {
        // Use a stack-based approach to handle nested if blocks
        const ifStartPattern = /{{#if\s+(\w+)}}/g
        
        let result = template
        let changed = true
        
        // Iteratively process conditional blocks until no more changes
        // This handles nested blocks by processing from innermost to outermost
        while (changed) {
            changed = false
            const startMatches: Array<{ index: number; varName: string; fullMatch: string }> = []
            
            // Find all {{#if}} start tags
            let match
            while ((match = ifStartPattern.exec(result)) !== null) {
                startMatches.push({
                    index: match.index,
                    varName: match[1],
                    fullMatch: match[0]
                })
            }
            
            if (startMatches.length === 0) {
                break // No more if blocks to process
            }
            
            // Find the innermost if block (the one with no nested if blocks before its closing tag)
            for (let i = startMatches.length - 1; i >= 0; i--) {
                const startMatch = startMatches[i]
                const startIndex = startMatch.index
                const endPattern = new RegExp(`{{\\/if}}`)
                endPattern.lastIndex = startIndex + startMatch.fullMatch.length
                
                const endMatch = endPattern.exec(result)
                if (endMatch) {
                    const endIndex = endMatch.index
                    const content = result.substring(startIndex + startMatch.fullMatch.length, endIndex)
                    
                    // Check if this content contains any nested if blocks
                    const hasNestedIf = /{{#if\s+\w+}}/.test(content)
                    
                    if (!hasNestedIf) {
                        // This is an innermost block, process it
                        const value = variables[startMatch.varName]
                        const shouldInclude = value && value !== 'false' && value !== 'null' && value !== 'undefined' && String(value).trim() !== ''
                        
                        const replacement = shouldInclude ? content : ''
                        const prev = result.substring(0, startIndex)
                        const next = result.substring(endIndex + endMatch[0].length)
                        result = prev.endsWith('\n') ? prev.substring(0, prev.length - 1) + replacement + next : prev + replacement + next
                        changed = true
                        break // Process one block at a time
                    }
                }
            }
        }
        
        return result
    }

    /**
     * Replace variables in the template
     * Format: {{variableName}}
     */
    private replaceVariables(template: string, variables: Record<string, string | undefined>): string {
        let prompt = template
        for (const [key, value] of Object.entries(variables)) {
            // Replace {{variable}} with the value, or empty string if undefined
            const replacement = value !== undefined ? value : ''
            prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), replacement)
        }
        return prompt
    }
}

