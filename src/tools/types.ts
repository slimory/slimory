/**
 * Tool execution result
 */
export interface ToolResult {
    success: boolean
    data?: any
    error?: string
}

/**
 * Base interface for all tools
 */
export interface Tool {
    /**
     * Tool name (must be unique)
     */
    name: string

    /**
     * Tool description (for LLM to understand what this tool does)
     */
    description: string

    /**
     * Tool parameters schema (JSON Schema format)
     */
    parameters: {
        type: 'object'
        properties: Record<string, {
            type: string
            description: string
            required?: boolean
        }>
        required?: string[]
    }

    /**
     * Execute the tool with given parameters
     * @param params - Tool parameters
     * @param onStatusUpdate - Optional callback for status updates (status: 'start' | 'processing' | 'end', message: string)
     * @param currentLang - Optional current language code ('zh' or 'en')
     * @param messages - Optional chat messages for context
     * @param conversationId - Optional conversation ID
     * @returns Tool execution result
     */
    execute(params: Record<string, any>, onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => boolean, currentLang?: string, messages?: Array<{ role: string; content: string }>, conversationId?: string): Promise<ToolResult>
}

