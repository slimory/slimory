import { Tool, ToolResult } from './types'
import { WebSearchTool, FetchUrlContentTool } from './webSearch'
import { GetCurrentTimeTool } from './getCurrentTime'
import { WebPilotTool } from './webPilot'

/**
 * Tool registry - manages all available tools
 */
export class ToolRegistry {
    private tools: Map<string, Tool> = new Map()

    constructor() {
        // Register default tools
        this.registerTool(new WebSearchTool())
        this.registerTool(new FetchUrlContentTool())
        this.registerTool(new GetCurrentTimeTool())
        this.registerTool(new WebPilotTool())
    }

    /**
     * Register a new tool
     */
    registerTool(tool: Tool): void {
        if (this.tools.has(tool.name)) {
            console.warn(`Tool "${tool.name}" is already registered. Overwriting...`)
        }
        this.tools.set(tool.name, tool)
    }

    /**
     * Get a tool by name
     */
    getTool(name: string): Tool | undefined {
        return this.tools.get(name)
    }

    /**
     * Get all registered tools
     */
    getAllTools(): Tool[] {
        return Array.from(this.tools.values())
    }

    /**
     * Get tool definitions for LLM (OpenAI function calling format)
     */
    getToolDefinitions(): Array<{
        type: 'function'
        function: {
            name: string
            description: string
            parameters: any
        }
    }> {
        return this.getAllTools().map(tool => ({
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        }))
    }
}

// Singleton instance
export const toolRegistry = new ToolRegistry()

/**
 * Execute a tool by name with given parameters
 * @param toolName - Name of the tool to execute
 * @param params - Tool parameters
 * @param onStatusUpdate - Optional callback for status updates (status: 'start' | 'processing' | 'end', message: string)
 * @param currentLang - Optional current language code ('zh' or 'en')
 * @param messages - Optional chat messages for context
 * @param conversationId - Optional conversation ID
 * @returns Tool execution result
 */
export async function executeTool(
    toolName: string, 
    params: Record<string, any>,
    onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => boolean,
    currentLang?: string,
    messages?: Array<{ role: string; content: string }>,
    conversationId?: string
): Promise<ToolResult> {
    const tool = toolRegistry.getTool(toolName)
    
    if (!tool) {
        return {
            success: false,
            error: `Tool "${toolName}" not found. Available tools: ${toolRegistry.getAllTools().map(t => t.name).join(', ')}`
        }
    }

    try {
        return await tool.execute(params, onStatusUpdate, currentLang, messages, conversationId)
    } catch (error) {
        console.error(`Error executing tool "${toolName}":`, error)
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }
    }
}

// Export types and tools for external use
export type { Tool, ToolResult } from './types'
export { WebSearchTool, FetchUrlContentTool } from './webSearch'
export { GetCurrentTimeTool } from './getCurrentTime'
export { WebPilotTool } from './webPilot'

