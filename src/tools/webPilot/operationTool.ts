import { Tool, ToolResult } from '../types'
import { Operation } from './operationExecutor'
import { BrowserWindow } from 'electron'
import { operationExecutor } from './operationExecutor'

/**
 * Dynamic tool wrapper for operations
 * This allows operations to be used as LLM tools
 */
export class OperationTool implements Tool {
    name: string
    description: string
    parameters: {
        type: 'object'
        properties: Record<string, {
            type: string
            description: string
            required?: boolean
        }>
        required?: string[]
    }
    private operation: Operation
    private window: BrowserWindow
    private domain: string

    constructor(operation: Operation, window: BrowserWindow, domain: string) {
        this.operation = operation
        this.window = window
        this.domain = domain
        this.name = `webpilot_${operation.name}`
        this.description = operation.description

        // Convert operation parameters to tool parameters
        // Note: In JSON Schema, 'required' is an array at the top level, not a boolean in properties
        const properties: Record<string, { type: string; description: string }> = {}
        const required: string[] = []

        if (operation.parameters) {
            for (const [paramName, paramDef] of Object.entries(operation.parameters)) {
                properties[paramName] = {
                    type: paramDef.type,
                    description: paramDef.description || ''
                }
                if (paramDef.required) {
                    required.push(paramName)
                }
            }
        }

        this.parameters = {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined
        }
    }

    async execute(
        params: Record<string, any>,
        _onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => void,
        _currentLang: string = 'zh',
        _messages?: Array<{ role: string; content: string }>,
        _conversationId?: string
    ): Promise<ToolResult> {
        // Special handling for navigate operation
        if (this.operation.name === 'navigate' && params.url) {
            try {
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Navigation timeout'))
                    }, 30000)

                    this.window.webContents.once('did-finish-load', () => {
                        clearTimeout(timeout)
                        resolve()
                    })

                    this.window.webContents.once('did-fail-load', (_event, _errorCode, errorDescription) => {
                        clearTimeout(timeout)
                        reject(new Error(`Navigation failed: ${errorDescription}`))
                    })
                    this.window.loadURL(params.url)
                })

                // Wait for page to be ready
                await new Promise(resolve => setTimeout(resolve, 1000))

                return {
                    success: true,
                    data: {
                        message: `Navigated to ${params.url}`,
                        url: params.url
                    }
                }
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            }
        }

        // Execute the operation using operationExecutor
        let result: ToolResult
        try {
            result = await operationExecutor.executeOperation(
                this.window,
                this.domain,
                this.operation.name,
                params
            )
        } finally {
        }

        return {
            success: result.success,
            data: result.data,
            error: result.error
        }
    }
}

/**
 * Create tool definitions from operations for a domain
 */
export function createOperationTools(domain: string, window: BrowserWindow): Tool[] {
    const script = operationExecutor.loadScript(domain)
    if (!script) {
        return []
    }

    return script.operations.map(operation => 
        new OperationTool(operation, window, domain)
    )
}

/**
 * Get tool definitions for operations (for LLM)
 */
export function getOperationToolDefinitions(domain: string, window: BrowserWindow): Array<{
    type: 'function'
    function: {
        name: string
        description: string
        parameters: any
    }
}> {
    const tools = createOperationTools(domain, window)
    return tools.map(tool => ({
        type: 'function' as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }))
}

