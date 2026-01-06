/**
 * Operation sequence item
 */
export interface OperationSequenceItem {
    operation: string
    params: Record<string, any>
}

/**
 * Parsed instruction result
 */
export interface ParsedInstruction {
    domain: string
    operations: OperationSequenceItem[]
}

import { operationExecutor } from './operationExecutor'
import { chatConfig } from '../../config/chatConfig'

/**
 * Instruction parser - converts natural language instructions to operation sequences
 */
export class InstructionParser {
    /**
     * Parse a natural language instruction into an operation sequence using LLM
     * @param instruction - Natural language instruction (e.g., "打开youtube.com，搜索trump，然后打开第一个搜索结果")
     * @param domain - Optional domain hint (e.g., "youtube.com")
     */
    async parseWithLLM(instruction: string, domain?: string): Promise<ParsedInstruction> {
        // First, extract or determine domain
        const extractedDomain = domain || this.extractDomain(instruction)
        if (!extractedDomain) {
            throw new Error('Cannot determine target domain from instruction')
        }

        // Load available operations for this domain
        const script = operationExecutor.loadScript(extractedDomain)
        if (!script) {
            throw new Error(`No operations script found for domain: ${extractedDomain}`)
        }

        // Build prompt for LLM
        const operationsList = script.operations.map(op => {
            const params = op.parameters ? Object.entries(op.parameters).map(([name, def]) => {
                return `  - ${name} (${def.type}${def.required ? ', required' : ', optional'}): ${def.description || ''}`
            }).join('\n') : '  (no parameters)'
            return `- ${op.name}: ${op.description}\n${params}`
        }).join('\n\n')

        const prompt = `You are a web automation instruction parser. Parse the following natural language instruction into a sequence of operations.

Available operations for ${extractedDomain}:
${operationsList}

User instruction: "${instruction}"

Parse this instruction into a JSON array of operations. Each operation should have:
- operation: the operation name (must be one of the available operations)
- params: an object with the required/optional parameters for that operation

Important rules:
1. Only use operations from the available list above
2. Extract parameters from the instruction (e.g., if instruction says "搜索trump", use {query: "trump"} for search operation - extract only the search term, not the word "搜索" or "search")
3. For "打开第一个搜索结果", "打开第一个结果", "open the first result", "click the first result", etc., ALWAYS use the "clickFirstResult" operation (NOT navigate). This operation clicks on the first search result, it does NOT navigate to a URL.
4. The "navigate" operation should ONLY be used for opening a website URL (like "打开youtube.com" or "open youtube.com")
5. Return ONLY valid JSON array, no explanation, no markdown, just the JSON array

Example output format:
[
  {"operation": "navigate", "params": {"url": "https://www.youtube.com"}},
  {"operation": "search", "params": {"query": "trump"}},
  {"operation": "clickFirstResult", "params": {}}
]

Now parse this instruction: "${instruction}"

Return only the JSON array:`

        try {
            // Call LLM API
            const response = await fetch(`${chatConfig.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${chatConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: chatConfig.model || 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a web automation instruction parser. Always return only valid JSON arrays, no explanations.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`LLM API error: ${response.status} ${errorText}`)
            }

            const data = await response.json() as {
                choices?: Array<{
                    message?: {
                        content?: string
                    }
                }>
            }
            const llmResponse = data.choices?.[0]?.message?.content?.trim() || ''

            // Parse LLM response (might be wrapped in markdown code blocks)
            let jsonStr = llmResponse
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

            const operations = JSON.parse(jsonStr) as OperationSequenceItem[]

            // Validate operations
            const validOperationNames = new Set(script.operations.map(op => op.name))
            for (const op of operations) {
                if (!validOperationNames.has(op.operation)) {
                    throw new Error(`Invalid operation: ${op.operation}. Available: ${Array.from(validOperationNames).join(', ')}`)
                }
            }

            return {
                domain: extractedDomain,
                operations
            }
        } catch (error) {
            console.error('[InstructionParser] LLM parsing failed, falling back to keyword-based parsing:', error)
            // Fallback to keyword-based parsing
            return this.parse(instruction, domain)
        }
    }

    /**
     * Parse a natural language instruction into an operation sequence (keyword-based fallback)
     * @param instruction - Natural language instruction (e.g., "打开youtube.com，搜索trump，然后打开第一个搜索结果")
     * @param domain - Optional domain hint (e.g., "youtube.com")
     */
    parse(instruction: string, domain?: string): ParsedInstruction {
        // Normalize instruction
        const normalized = instruction.toLowerCase().trim()

        // Extract domain from instruction or use provided domain
        const extractedDomain = domain || this.extractDomain(instruction)
        if (!extractedDomain) {
            throw new Error('Cannot determine target domain from instruction')
        }

        // Parse operations
        const operations: OperationSequenceItem[] = []

        // Split instruction by common separators (，, ,, then, 然后, and, 并且)
        const parts = normalized.split(/[，,]\s*|然后|then|并且|and/i).map(p => p.trim()).filter(p => p)

        for (const part of parts) {
            const operation = this.parseOperation(part, extractedDomain)
            if (operation) {
                operations.push(operation)
            }
        }

        if (operations.length === 0) {
            throw new Error('No valid operations found in instruction')
        }

        return {
            domain: extractedDomain,
            operations
        }
    }

    /**
     * Extract domain from instruction
     */
    extractDomain(instruction: string): string | null {
        // Common domain patterns
        const domainPatterns = [
            /(?:打开|访问|go to|visit|open)\s*(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i,
            /([a-z0-9.-]+\.(?:com|org|net|edu|gov|io|co|cn|tv|me))/i,
            /youtube/i,
            /google/i,
            /facebook/i,
            /twitter/i,
            /instagram/i,
            /linkedin/i
        ]

        for (const pattern of domainPatterns) {
            const match = instruction.match(pattern)
            if (match) {
                let domain = match[1] || match[0]
                
                // Normalize common domains
                if (domain.toLowerCase().includes('youtube')) {
                    return 'youtube.com'
                } else if (domain.toLowerCase().includes('google')) {
                    return 'google.com'
                } else if (domain.toLowerCase().includes('facebook')) {
                    return 'facebook.com'
                } else if (domain.toLowerCase().includes('twitter')) {
                    return 'twitter.com'
                } else if (domain.toLowerCase().includes('instagram')) {
                    return 'instagram.com'
                } else if (domain.toLowerCase().includes('linkedin')) {
                    return 'linkedin.com'
                }

                // Clean up domain
                domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
                
                if (domain.includes('.')) {
                    return domain
                }
            }
        }

        return null
    }

    /**
     * Parse a single operation from instruction part
     */
    private parseOperation(part: string, domain: string): OperationSequenceItem | null {
        // Navigate operation
        if (part.match(/(?:打开|访问|go to|visit|open|navigate to)/i)) {
            const urlMatch = part.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i)
            let url = urlMatch ? urlMatch[0] : `https://www.${domain}`
            
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = `https://${url}`
            }

            return {
                operation: 'navigate',
                params: { url }
            }
        }

        // Search operation
        if (part.match(/(?:搜索|search|查找|find)/i)) {
            // Extract query - remove the search keyword and clean up
            let query = part.replace(/(?:搜索|search|查找|find)\s+(?:for\s+)?/i, '').trim()
            // Remove common trailing words
            query = query.replace(/\s*(?:然后|then|并且|and).*$/i, '').trim()
            
            if (query) {
                return {
                    operation: 'search',
                    params: { query }
                }
            }
        }

        // Click first result
        if (part.match(/(?:打开|点击|click|open)\s*(?:第一个|第一|first|the first)/i)) {
            return {
                operation: 'clickFirstResult',
                params: {}
            }
        }

        // Wait for page load
        if (part.match(/(?:等待|wait|等待加载|wait for load)/i)) {
            return {
                operation: 'waitForPageLoad',
                params: {}
            }
        }

        return null
    }

}

// Singleton instance
export const instructionParser = new InstructionParser()

