import path from 'path'
import { fileURLToPath } from 'url'
import { ChatConfig } from '../config/chatConfig'
import { toolRegistry, executeTool } from '../tools'
import { PromptLoader } from '../prompts/loader'

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    tool_calls?: Array<{
        id: string
        type: 'function'
        function: {
            name: string
            arguments: string
        }
    }>
    tool_call_id?: string
}

export interface ChatResponse {
    content: string
    done: boolean
}

export class ChatService {
    private config: ChatConfig
    private promptsDir: string
    private promptLoader: PromptLoader

    constructor(config: ChatConfig) {
        this.config = config
        // Use ES module compatible way to get directory path
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = path.dirname(__filename)
        this.promptsDir = path.join(__dirname, '..', 'prompts')
        this.promptLoader = new PromptLoader(this.promptsDir)
    }

    /**
     * Update configuration dynamically
     */
    updateConfig(config: ChatConfig): void {
        this.config = { ...this.config, ...config }
    }

    /**
     * Get ISO week number for a given date
     */
    private getWeekNumber(date: Date): string {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
        const dayNum = d.getUTCDay() || 7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum)
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7).toString()
    }

    /**
     * Load a prompt template from file and replace variables
     */
    private loadPrompt(templateName: string, variables: Record<string, string | undefined> = {}): string {
        try {
            return this.promptLoader.loadPrompt(templateName, variables)
        } catch (error) {
            console.error(`Failed to load prompt template ${templateName}:`, error)
            return ''
        }
    }

    /**
     * Generate streaming response for a chat conversation
     */
    async *generateStreamingResponse(
        messages: ChatMessage[],
        promptTemplate?: string,
        promptVariables?: Record<string, string | undefined>,
        _thinking: boolean = false
    ): AsyncGenerator<ChatResponse, void, unknown> {
        try {
            // Create a copy of messages to avoid mutating the original array
            const messagesCopy = [...messages]
            // Add system prompt if template is provided
            if (promptTemplate && promptVariables) {
                const systemPrompt = this.loadPrompt(promptTemplate, promptVariables)
                //console.log('System prompt:', systemPrompt)
                messagesCopy.unshift({
                    role: 'system',
                    content: systemPrompt
                })
            }

            // console.log(messagesCopy)

            // console.log('thinking:', thinking)

            const shouldSkipThinking = this.config.model?.startsWith('gemini') ||
                this.config.baseUrl?.includes('groq.com') ||
                this.config.baseUrl?.includes('fireworks.ai')
            const thinking = shouldSkipThinking ? {} : { thinking: { "type": _thinking ? "enabled" : "disabled" } }
            // console.log('thinking:', thinking)
            console.log(this.config.baseUrl, this.config.apiKey, this.config.model)

            // Only add reasoning_split for OpenAI API (not compatible providers like Groq, Fireworks)
            const isOpenAI = this.config.baseUrl?.includes('api.openai.com')
            const extraBody = isOpenAI ? { extra_body: { "reasoning_split": true } } : {}

            const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: messagesCopy,
                    stream: true,
                    temperature: 0.7,
                    ...extraBody,
                    ...thinking
                })
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} ${await response.text()}`)
            }

            const reader = response.body?.getReader()
            if (!reader) {
                throw new Error('No response body reader available')
            }

            const decoder = new TextDecoder()
            let buffer = ''

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6)
                            if (data === '[DONE]') {
                                yield { content: '', done: true }
                                return
                            }

                            try {
                                const parsed = JSON.parse(data)
                                // console.log('Parsed:', parsed.choices?.[0]?.delta)
                                const content = parsed.choices?.[0]?.delta?.content
                                if (content) {
                                    yield { content, done: false }
                                }
                            } catch (e) {
                                // Skip invalid JSON lines
                                continue
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock()
            }
        } catch (error) {
            console.error('Chat service error:', error)
            throw error
        }
    }

    /**
     * Generate streaming response with tool support (agent mode)
     */
    async *generateStreamingResponseWithTools(
        messages: ChatMessage[],
        promptTemplate?: string,
        promptVariables?: Record<string, string | undefined>,
        onToolCall?: (toolCalls: Array<{ id: string; name: string; arguments: any }>) => void,
        tools?: Array<{
            type: 'function'
            function: {
                name: string
                description: string
                parameters: any
            }
        }>,
        onToolCallDetected?: (toolCallName: string, index: number) => void
    ): AsyncGenerator<ChatResponse & { finishReason?: string; toolCalls?: any[] }, void, unknown> {
        try {
            // Add system prompt if template is provided
            const messagesCopy = [...messages]
            if (promptTemplate && promptVariables) {
                const systemPrompt = this.loadPrompt(promptTemplate, promptVariables)
                messagesCopy.unshift({
                    role: 'system',
                    content: systemPrompt
                })
                // console.log(systemPrompt)
            }
            const shouldSkipThinking2 = this.config.model?.startsWith('gemini') ||
                this.config.baseUrl?.includes('groq.com') ||
                this.config.baseUrl?.includes('fireworks.ai')
            const thinking = shouldSkipThinking2 ? {} : { thinking: { "type": "disabled" } }
            // Get tool definitions - use provided tools or fall back to toolRegistry
            const toolDefinitions = tools || toolRegistry.getToolDefinitions()
            // console.log("use model", this.config.model)
            const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: messagesCopy,
                    stream: true,
                    temperature: 0.6,
                    max_tokens: 8000,
                    ...thinking,
                    tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
                    tool_choice: toolDefinitions.length > 0 ? 'auto' : undefined
                })
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} ${await response.text()}`)
            }

            const reader = response.body?.getReader()
            if (!reader) {
                throw new Error('No response body reader available')
            }

            const decoder = new TextDecoder()
            let buffer = ''
            let toolCalls: Map<number, any> = new Map()
            let finishReason: string | null = null
            let detectedToolNames: Map<number, string> = new Map() // Track detected tool names to avoid duplicate calls

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6)
                            if (data === '[DONE]') {
                                // Check if we have tool calls to report (even if finish_reason wasn't set yet)
                                if (toolCalls.size > 0 && (finishReason === 'tool_calls' || finishReason === null) && onToolCall) {
                                    const toolCallsArray = Array.from(toolCalls.values())
                                        .filter(tc => tc.function?.name && tc.function.name.length > 0)
                                        .map(tc => {
                                            try {
                                                return {
                                                    id: tc.id || '',
                                                    name: tc.function.name,
                                                    arguments: tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
                                                }
                                            } catch (e) {
                                                console.error('Error parsing tool call arguments:', e)
                                                return null
                                            }
                                        })
                                        .filter((tc): tc is { id: string; name: string; arguments: any } => tc !== null)
                                    if (toolCallsArray.length > 0) {
                                        onToolCall(toolCallsArray)
                                    }
                                    yield { content: '', done: true, finishReason: finishReason || undefined }
                                    return
                                }
                                yield { content: '', done: true, finishReason: finishReason || undefined }
                                return
                            }

                            try {
                                const parsed = JSON.parse(data)
                                const choice = parsed.choices?.[0]
                                
                                // Check for tool calls in delta
                                if (choice?.delta?.tool_calls) {
                                    // console.log('Tool calls in delta:', choice.delta.tool_calls)
                                    for (const toolCallDelta of choice.delta.tool_calls) {
                                        const index = toolCallDelta.index
                                        if (!toolCalls.has(index)) {
                                            toolCalls.set(index, {
                                                id: toolCallDelta.id || '',
                                                type: 'function',
                                                function: {
                                                    name: '',
                                                    arguments: ''
                                                }
                                            })
                                        }
                                        const toolCall = toolCalls.get(index)!
                                        if (toolCallDelta.id) {
                                            toolCall.id = toolCallDelta.id
                                        }
                                        if (toolCallDelta.function?.name) {
                                            toolCall.function.name += toolCallDelta.function.name
                                            
                                            // Call onToolCallDetected when tool name is detected or updated
                                            if (onToolCallDetected) {
                                                const currentName = toolCall.function.name
                                                const previousName = detectedToolNames.get(index) || ''
                                                // Only call if name has changed (new detection or update)
                                                if (currentName !== previousName && currentName.length > 0) {
                                                    detectedToolNames.set(index, currentName)
                                                    onToolCallDetected(currentName, index)
                                                }
                                            }
                                        }
                                        if (toolCallDelta.function?.arguments) {
                                            toolCall.function.arguments += toolCallDelta.function.arguments
                                        }
                                    }
                                }

                                // Check finish reason
                                if (choice?.finish_reason) {
                                    finishReason = choice.finish_reason
                                    
                                    // If finish_reason is tool_calls, we need to report it
                                    if (finishReason === 'tool_calls' && toolCalls.size > 0 && onToolCall) {
                                        const toolCallsArray = Array.from(toolCalls.values())
                                            .filter(tc => tc.function?.name && tc.function.name.length > 0)
                                            .map(tc => {
                                                try {
                                                    return {
                                                        id: tc.id || '',
                                                        name: tc.function.name,
                                                        arguments: tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
                                                    }
                                                } catch (e) {
                                                    console.error('Error parsing tool call arguments:', e)
                                                    return null
                                                }
                                            })
                                            .filter((tc): tc is { id: string; name: string; arguments: any } => tc !== null)
                                        if (toolCallsArray.length > 0) {
                                            onToolCall(toolCallsArray)
                                        }
                                    }
                                    // token usage
                                    const tokenUsage = parsed.usage
                                    console.log('Token usage:', tokenUsage)
                                }

                                // Yield content
                                const content = choice?.delta?.content
                                // if (content) {
                                //     console.log('Content in delta:', content)
                                // }
                                if (content) {
                                    yield { content, done: false }
                                }
                            } catch (e) {
                                // Skip invalid JSON lines
                                continue
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock()
            }
        } catch (error) {
            console.error('Chat service error:', error)
            throw error
        }
    }

    /**
     * Answer user question with agent mode (tool support)
     */
    async *answerUserQuestionWithTools(
        messages: Array<{ role: 'user' | 'assistant'; content: string; originalMessages?: ChatMessage[] }>,
        currentLangCode: string = 'en',
        currentLanguage: string = 'English',
        conversationId: string = '',
        onStatusUpdate?: (messageId: string, toolName: string, status: 'start' | 'processing' | 'end', message: string) => boolean,
        onComplete?: (generatedMessages: ChatMessage[]) => void
    ): AsyncGenerator<ChatResponse & { resources?: Array<{ index: number; url: string; title?: string; source?: string }> }, void, unknown> {

        const currentMessages: ChatMessage[] = []
        for (const msg of messages) {
            if (msg.role == 'user' || !msg.originalMessages) {
                currentMessages.push({
                    role: msg.role,
                    content: msg.content
                } as ChatMessage)
            } else {
                let t = msg.content.split(/(<\[.*?\] start>[\s\S]*?<\/\[.*?\] end>)/)
                let o = [...msg.originalMessages]
                if (t.length === o.length + 1) {
                    for (let i = 0; i < o.length; i++) {
                        if (o[i].role === 'tool') continue;
                        o[i]['content'] = t[i].trim()
                    }
                    currentMessages.push(...o)
                }
                currentMessages.push({role: msg.role, content: t[t.length - 1]} as ChatMessage)
            }
        }

        // Get current date information (once for the entire conversation)
        const now = new Date()
        const currentDate = now.toISOString().split('T')[0] // YYYY-MM-DD
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
        const weekNumber = this.getWeekNumber(now)
        const year = now.getFullYear().toString()
        const month = (now.getMonth() + 1).toString().padStart(2, '0')
        const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][now.getMonth()]
        const start = currentMessages.length
        const messagesForTool: Map<string, ChatMessage[]> = new Map()

        let maxIterations = 20 // Prevent infinite loops
        let iteration = 0
        let allResources: Array<{ index: number; url: string; title?: string; source?: string }> = [] // 收集所有 resources
        let shouldBreak = false
        let shouldStop = false

        console.log('currentMessages', currentMessages)

        while (iteration < maxIterations) {
            if (shouldStop) {
                // console.log('shouldStop1', shouldStop)
                break
            }
            iteration++
            
            let toolCallsToExecute: Array<{ id: string; name: string; arguments: any }> = []

            // Callback for tool calls
            const handleToolCall = (toolCalls: Array<{ id: string; name: string; arguments: any }>) => {
                toolCallsToExecute = toolCalls
            }

            // Generate response (may include tool calls)
            let hasContent = false
            let finishReason: string | null = null

            for await (const chunk of this.generateStreamingResponseWithTools(
                currentMessages,
                'assist_with_tools',
                {
                    currentLanguage,
                    currentDate,
                    dayOfWeek,
                    weekNumber,
                    year,
                    month,
                    monthName
                },
                handleToolCall,
                undefined // Use default tools from toolRegistry
            )) {
                hasContent = hasContent || !!chunk.content
                if (chunk.finishReason) {
                    finishReason = chunk.finishReason
                }
                // 在每次 yield 时都带上当前的 resources
                yield { 
                    ...chunk, 
                    resources: allResources.length > 0 ? allResources : undefined
                }
            }

            // console.log('Tool calls to execute:', toolCallsToExecute)
            console.log('Finish reason:', finishReason)

            // If no tool calls or finish_reason is 'stop', we're done
            if (toolCallsToExecute.length === 0 || finishReason === 'stop') {
                shouldBreak = true
                break
            }

            // Execute all tool calls
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
                    // console.log('shouldStop2', shouldStop)
                    break
                }
                console.log('Tool call:', toolCall)
                const wrappedOnStatusUpdate = onStatusUpdate 
                    ? (status: 'start' | 'processing' | 'end', message: string) => {
                        // console.log('wrappedOnStatusUpdate', status, message)
                        shouldStop = onStatusUpdate(toolCall.id, toolCall.name, status, message)
                        return shouldStop
                    }
                    : undefined
                if (!messagesForTool.has(toolCall.name)) {
                    messagesForTool.set(toolCall.name, [])
                    let currentToolId = ''
                    for (const msg of messages) {
                        if (msg.role === 'assistant' && msg.originalMessages) {
                            let index = 0
                            while (index < msg.originalMessages.length) {
                                const existTool = msg.originalMessages[index].tool_calls?.find((tool: any) => tool.function.name === toolCall.name)
                                if (msg.originalMessages[index].role === 'assistant' && existTool) {
                                    let content = ''
                                    try {
                                        content = JSON.parse(existTool?.function.arguments || '{}').instruction || ''
                                    } catch {}
                                    messagesForTool.get(toolCall.name)?.push({
                                        role: 'user',
                                        content: content
                                    } as ChatMessage)
                                    currentToolId = existTool?.id || ''
                                } else if (msg.originalMessages[index].role === 'tool' && msg.originalMessages[index].tool_call_id === currentToolId) {
                                    messagesForTool.get(toolCall.name)?.push({
                                        role: 'assistant',
                                        content: msg.originalMessages[index].content
                                    } as ChatMessage)
                                }
                                index++
                            }
                        }
                    }
                }

                console.log('start tool execute')
                const toolResult = await executeTool(toolCall.name, toolCall.arguments || {}, wrappedOnStatusUpdate, currentLangCode, messagesForTool.get(toolCall.name) || [], conversationId)
                // console.log('Tool result:', toolResult)
                // if (onToolComplete) {
                    // onToolComplete(toolCall.id, toolCall.name, JSON.stringify(toolResult))
                // }
                const formatToolResult = (toolName: string, result: any): { content: string; resources?: Array<{ index: number; url: string; title?: string; source?: string }> } => {
                    if (toolName === 'web_search' && result.success && result.data?.results) {
                        const results = result.data.results
                        const resources: Array<{ index: number; url: string; title?: string; source?: string }> = []
                        
                        let formattedContent = `Web search results for "${result.data.query}":\n\n`
                        
                        results.forEach((item: any, idx: number) => {
                            const resourceIndex = allResources.length + idx + 1
                            resources.push({
                                index: resourceIndex,
                                url: item.url,
                                title: item.title || item.pageTitle,
                                source: item.source || ''
                            })
                            
                            formattedContent += `[${resourceIndex}] ${item.title || item.pageTitle || 'Untitled'}\n`
                            formattedContent += `URL: ${item.url}\n`
                            if (item.source) {
                                formattedContent += `Source: ${item.source}\n`
                            }
                            if (item.snippet) {
                                formattedContent += `Snippet: ${item.snippet}\n`
                            }
                            if (item.pageContent) {
                                formattedContent += `Content: ${item.pageContent.substring(0, 1000)}${item.pageContent.length > 1000 ? '...' : ''}\n`
                            }
                            formattedContent += '\n'
                        })
                        
                        return { content: formattedContent, resources }
                    } else if (toolName === 'fetch_url_content' && result.success && result.data?.results) {
                        const results = result.data.results
                        const resources: Array<{ index: number; url: string; title?: string; source?: string }> = []
                        
                        let formattedContent = `Fetched content from ${result.data.successful}/${result.data.total} URLs:\n\n`
                        
                        results.forEach((item: any) => {
                            if (item.hasContent) {
                                const resourceIndex = allResources.length + resources.length + 1
                                resources.push({
                                    index: resourceIndex,
                                    url: item.url,
                                    title: item.title
                                })
                                
                                formattedContent += `[${resourceIndex}] ${item.title || 'Untitled'}\n`
                                formattedContent += `URL: ${item.url}\n`
                                if (item.content) {
                                    formattedContent += `Content: ${item.content.substring(0, 1000)}${item.content.length > 1000 ? '...' : ''}\n`
                                }
                                formattedContent += '\n'
                            } else {
                                formattedContent += `Failed to fetch: ${item.url}\n`
                                if (item.error) {
                                    formattedContent += `Error: ${item.error}\n`
                                }
                                formattedContent += '\n'
                            }
                        })
                        
                        return { content: formattedContent, resources }
                    } else {
                        return { content: JSON.stringify(result) }
                    }
                }

                const formattedResult = formatToolResult(toolCall.name, toolResult)
                
                if (formattedResult.resources) {
                    allResources.push(...formattedResult.resources)
                }

                messagesForTool.get(toolCall.name)?.push({
                    role: 'user',
                    content: toolCall.arguments.instruction || JSON.stringify(toolCall.arguments)
                })

                messagesForTool.get(toolCall.name)?.push({
                    role: 'assistant',
                    content: formattedResult.content
                } as ChatMessage)

                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    content: formattedResult.content
                })

                // Store tool call for assistant message
                assistantToolCalls.push({
                    id: toolCall.id,
                    type: 'function',
                    function: {
                        name: toolCall.name,
                        arguments: JSON.stringify(toolCall.arguments || {})
                    }
                })
            }

            // Add assistant message with tool calls
            if (assistantToolCalls.length > 0) {
                currentMessages.push({
                    role: 'assistant',
                    content: "",
                    tool_calls: assistantToolCalls
                })
            }

            // Add tool result messages
            for (const toolResult of toolResults) {
                currentMessages.push({
                    role: 'tool',
                    content: toolResult.content,
                    tool_call_id: toolResult.tool_call_id
                })
            }

            // Continue loop to get final response
        }

        // If we reached max iterations without normal completion, generate a summary response
        if (iteration >= maxIterations && !shouldBreak) {
            console.log('Reached max iterations, generating summary response...')
            
            // Use a dedicated summary prompt that doesn't include tool instructions
            // Generate final summary response based on currentMessages without tools
            for await (const chunk of this.generateStreamingResponse(
                currentMessages,
                'summarize',
                {
                    currentLanguage,
                    currentDate,
                    dayOfWeek,
                    weekNumber,
                    year,
                    month,
                    monthName
                },
                false // No thinking mode
            )) {
                yield { ...chunk, resources: allResources.length > 0 ? allResources : undefined }
            }
        }

        onComplete?.(currentMessages.slice(start).map(msg => {
            if (msg.role === 'tool') {
                try {
                    let content = JSON.parse(msg.content)
                    content.data.messages = content.data.messages.map((msg: any) => {
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
                    })
                    return {...msg, content: JSON.stringify(content)}
                } catch {
                    return msg
                }
            } else {
                return msg
            }
        }) as ChatMessage[])
    }
}