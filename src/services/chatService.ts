import path from 'path'
import { fileURLToPath } from 'url'
import { Type } from '@earendil-works/pi-ai/compat'
import { streamSimple, clampThinkingLevel } from '@earendil-works/pi-ai/compat'
import { getBuiltinModels, getBuiltinProviders } from '@earendil-works/pi-ai/providers/all'
import { createProvider, createModels } from '@earendil-works/pi-ai'
import type { Context, ToolCall, ThinkingLevel, ModelThinkingLevel, BuiltinProvider, Api, Model, Message as PiMessage, Tool as PiTool } from '@earendil-works/pi-ai/compat'
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

// Map legacy internal provider keys to pi-ai builtin catalog provider names.
// Newer settings persist pi-ai ids directly, so resolvePiProvider() also accepts
// any pi-ai builtin catalog id as-is.
const PI_AI_PROVIDER_MAP: Record<string, BuiltinProvider> = {
    'deepseek': 'deepseek',
    'glm': 'zai-coding-cn',
    'moonshot': 'moonshotai',
    'openai': 'openai',
    'anthropic': 'anthropic',
    'gemini': 'google',
    'groq': 'groq',
    'fireworks': 'fireworks',
    'minimax': 'minimax',
    'openrouter': 'openrouter',
}

// pi-ai builtin catalog ids that can be used directly as the app provider key
const BUILTIN_PROVIDER_IDS: Set<string> = new Set<string>(getBuiltinProviders())

export class ChatService {
    private config: ChatConfig
    private promptsDir: string
    private promptLoader: PromptLoader

    constructor(config: ChatConfig) {
        this.config = config
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
     * Resolve the current provider to a pi-ai builtin catalog id.
     * Handles legacy app-level keys (moonshot→moonshotai, glm→zai-coding-cn,
     * gemini→google) and pi-ai builtin ids used directly as the app key.
     * Returns undefined for custom providers (custom-openai, custom-anthropic).
     */
    private resolvePiProvider(): BuiltinProvider | undefined {
        const provider = this.config.provider
        // Custom providers are not in pi-ai catalog
        if (provider === 'custom-openai' || provider === 'custom-anthropic') {
            return undefined
        }
        const mapped = PI_AI_PROVIDER_MAP[provider]
        if (mapped) return mapped
        if (BUILTIN_PROVIDER_IDS.has(provider)) return provider as BuiltinProvider
        return undefined
    }

    /**
     * Check if current provider is a custom provider
     */
    private isCustomProvider(): boolean {
        return this.config.provider === 'custom-openai' || this.config.provider === 'custom-anthropic'
    }

    /**
     * Get the API type for custom provider
     */
    private getCustomProviderApi(): 'openai-completions' | 'anthropic-messages' | undefined {
        if (this.config.provider === 'custom-openai') {
            return 'openai-completions'
        } else if (this.config.provider === 'custom-anthropic') {
            return 'anthropic-messages'
        }
        return undefined
    }

    /**
     * Create a custom provider instance for pi-ai
     */
    private async createCustomProvider() {
        const apiType = this.getCustomProviderApi()
        if (!apiType) {
            throw new Error('Invalid custom provider type')
        }

        const modelId = this.config.model
        if (!modelId) {
            throw new Error('Custom provider requires a model to be configured')
        }

        // Dynamically import the appropriate API implementation
        let apiImpl: any
        if (apiType === 'openai-completions') {
            const { openAICompletionsApi } = await import('@earendil-works/pi-ai/api/openai-completions.lazy')
            apiImpl = openAICompletionsApi()
        } else if (apiType === 'anthropic-messages') {
            const { anthropicMessagesApi } = await import('@earendil-works/pi-ai/api/anthropic-messages.lazy')
            apiImpl = anthropicMessagesApi()
        }

        // Create the model definition
        const customModel: Model<typeof apiType> = {
            id: modelId,
            name: modelId,
            api: apiType,
            provider: this.config.provider,
            baseUrl: this.config.baseUrl,
            reasoning: false,
            input: ['text'],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 32000,
            compat: {
                supportsDeveloperRole: false,  // Most OpenAI-compatible servers don't support this
                supportsReasoningEffort: false
            }
        }

        // Create the provider
        const customProvider = createProvider({
            id: this.config.provider,
            name: this.config.provider === 'custom-openai' ? 'Custom OpenAI Compatible' : 'Custom Anthropic Compatible',
            baseUrl: this.config.baseUrl,
            auth: {
                apiKey: {
                    name: 'Custom Provider API Key',
                    resolve: async () => ({ auth: { apiKey: this.config.apiKey } })
                }
            },
            models: [customModel],
            api: apiImpl
        })

        return { provider: customProvider, model: customModel }
    }

    /**
     * Check if pi-ai can handle this provider/model combination.
     * Custom providers are always supported (handled by createCustomProvider).
     */
    private isPiAiSupported(): boolean {
        // Custom providers are supported via createCustomProvider
        if (this.isCustomProvider()) {
            return true
        }

        const piProvider = this.resolvePiProvider()
        if (!piProvider) return false
        if (!this.config.model) return false
        return getBuiltinModels(piProvider).some(m => m.id === this.config.model)
    }

    /**
     * Convert internal ChatMessage[] to pi-ai Context
     */
    private chatMessagesToContext(
        messages: ChatMessage[],
        systemPrompt?: string,
        tools?: PiTool[]
    ): Context {
        const piMessages: PiMessage[] = []
        let effectiveSystemPrompt = systemPrompt

        for (const msg of messages) {
            if (msg.role === 'system') {
                // Use first system message as systemPrompt fallback if not provided explicitly
                if (!effectiveSystemPrompt) {
                    effectiveSystemPrompt = msg.content
                }
                continue
            } else if (msg.role === 'user') {
                piMessages.push({
                    role: 'user',
                    content: msg.content,
                    timestamp: Date.now(),
                })
            } else if (msg.role === 'assistant') {
                const content: Array<{ type: 'text'; text: string } | ToolCall> = []
                if (msg.content) {
                    content.push({ type: 'text', text: msg.content })
                }
                if (msg.tool_calls) {
                    for (const tc of msg.tool_calls) {
                        let args: Record<string, any> = {}
                        try {
                            args = JSON.parse(tc.function.arguments)
                        } catch { /* keep empty object */ }
                        content.push({
                            type: 'toolCall',
                            id: tc.id,
                            name: tc.function.name,
                            arguments: args,
                        })
                    }
                }
                piMessages.push({
                    role: 'assistant',
                    content: content.length > 0 ? content : [{ type: 'text', text: '' }],
                    api: 'openai-completions',
                    provider: this.config.provider,
                    model: this.config.model || '',
                    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
                    stopReason: 'stop',
                    timestamp: Date.now(),
                })
            } else if (msg.role === 'tool') {
                piMessages.push({
                    role: 'toolResult',
                    toolCallId: msg.tool_call_id || '',
                    toolName: '',
                    content: [{ type: 'text', text: msg.content }],
                    isError: false,
                    timestamp: Date.now(),
                })
            }
        }

        return {
            systemPrompt: effectiveSystemPrompt,
            messages: piMessages,
            tools,
        }
    }

    /**
     * Convert toolRegistry definitions to pi-ai Tool[] format
     */
    private getPiAiTools(): PiTool[] {
        const toolDefs = toolRegistry.getToolDefinitions()
        return toolDefs.map(td => {
            // Build TypeBox-compatible schema from JSON Schema
            const props: Record<string, any> = {}
            if (td.function.parameters?.properties) {
                for (const [key, prop] of Object.entries(td.function.parameters.properties)) {
                    const propSchema: Record<string, any> = { type: (prop as any).type }
                    if ((prop as any).description) propSchema.description = (prop as any).description
                    if ((prop as any).enum) propSchema.enum = (prop as any).enum
                    if ((prop as any).default !== undefined) propSchema.default = (prop as any).default
                    if ((prop as any).items) propSchema.items = (prop as any).items
                    if ((prop as any).required) propSchema.required = (prop as any).required
                    props[key] = propSchema
                }
            }
            const required: string[] = td.function.parameters?.required || []
            const schema = Type.Object(props as any, { additionalProperties: false })
            // Override required if present
            if (required.length > 0) {
                (schema as any).required = required
            }

            return {
                name: td.function.name,
                description: td.function.description,
                parameters: schema,
            } as PiTool
        })
    }

    /**
     * Determine the reasoning level from config, clamped to model capabilities
     */
    private getReasoningLevel(model: Model<Api>): ThinkingLevel | undefined {
        console.log(this.config.reasoningEffort)
        const effort = (this.config.reasoningEffort || 'off') as ModelThinkingLevel
        if (effort === 'off') return undefined
        const clamped = clampThinkingLevel(model, effort)
        return clamped !== 'off' ? clamped : undefined
    }

    private async *generateStreamingWithPiAi(
        messages: ChatMessage[],
        systemPrompt?: string
    ): AsyncGenerator<ChatResponse, void, unknown> {
        let model: Model<Api> | undefined

        // Handle custom providers
        if (this.isCustomProvider()) {
            const { provider: customProvider, model: customModel } = await this.createCustomProvider()
            const models = createModels()
            models.setProvider(customProvider)
            model = customModel as Model<Api>
        } else {
            const piProvider = this.resolvePiProvider()
            model = piProvider ? getBuiltinModels(piProvider).find(m => m.id === (this.config.model || '')) : undefined
            if (!model) {
                throw new Error(`Model "${this.config.model}" not found for provider "${piProvider}" in pi-ai catalog`)
            }
        }

        // console.log('model', model)

        // Determine reasoning level from config (ignoring the deprecated thinking flag)
        const reasoning = this.getReasoningLevel(model)

        console.log('reasoning', reasoning)

        const context = this.chatMessagesToContext(messages, systemPrompt)

        const eventStream = streamSimple(model, context, {
            apiKey: this.config.apiKey,
            reasoning,
        })

        for await (const event of eventStream) {
            switch (event.type) {
                case 'text_delta':
                    yield { content: event.delta, done: false }
                    break
                case 'done':
                    yield { content: '', done: true }
                    return
                case 'error':
                    throw new Error(event.error?.errorMessage || 'Stream error')
            }
        }
    }

    /**
     * Generate streaming response with tool support using pi-ai
     */
    private async *generateStreamingWithToolsPiAi(
        messages: ChatMessage[],
        systemPrompt?: string,
        onToolCall?: (toolCalls: Array<{ id: string; name: string; arguments: any }>) => void,
        tools?: PiTool[],
        onToolCallDetected?: (toolCallName: string, index: number) => void
    ): AsyncGenerator<ChatResponse & { finishReason?: string; toolCalls?: any[] }, void, unknown> {
        let model: Model<Api> | undefined

        // Handle custom providers
        if (this.isCustomProvider()) {
            const { provider: customProvider, model: customModel } = await this.createCustomProvider()
            const models = createModels()
            models.setProvider(customProvider)
            model = customModel as Model<Api>
        } else {
            const piProvider = this.resolvePiProvider()
            model = piProvider ? getBuiltinModels(piProvider).find(m => m.id === (this.config.model || '')) : undefined
            if (!model) {
                throw new Error(`Model "${this.config.model}" not found for provider "${piProvider}" in pi-ai catalog`)
            }
        }

        const piTools = tools || this.getPiAiTools()
        const context = this.chatMessagesToContext(messages, systemPrompt, piTools)

        // Determine reasoning level from config
        const reasoning = this.getReasoningLevel(model)
        const eventStream = streamSimple(model, context, {
            apiKey: this.config.apiKey,
            reasoning,
        } as Record<string, unknown>)

        const toolCallsMap = new Map<number, ToolCall>()
        let detectedToolNames = new Map<number, string>()

        for await (const event of eventStream) {
            switch (event.type) {
                case 'text_delta':
                    yield { content: event.delta, done: false }
                    break
                case 'thinking_delta':
                    // Optionally yield thinking content; for now skip
                    break
                case 'toolcall_start':
                    // pi-ai provides contentIndex to identify which tool call
                    break
                case 'toolcall_delta':
                    // Accumulate streaming tool call args
                    {
                        const toolCall = event.partial.content[event.contentIndex]
                        if (toolCall && toolCall.type === 'toolCall') {
                            const existing = toolCallsMap.get(event.contentIndex)
                            if (!existing && toolCall.name) {
                                toolCallsMap.set(event.contentIndex, {
                                    type: 'toolCall',
                                    id: toolCall.id,
                                    name: toolCall.name,
                                    arguments: toolCall.arguments || {},
                                })
                                // Notify callback for tool name detection
                                if (onToolCallDetected) {
                                    const prev = detectedToolNames.get(event.contentIndex) || ''
                                    if (toolCall.name !== prev) {
                                        detectedToolNames.set(event.contentIndex, toolCall.name)
                                        onToolCallDetected(toolCall.name, event.contentIndex)
                                    }
                                }
                            } else if (existing && toolCall.arguments) {
                                existing.arguments = toolCall.arguments
                            }
                        }
                    }
                    break
                case 'toolcall_end':
                    // Final validated tool call
                    {
                        toolCallsMap.set(event.contentIndex, event.toolCall)
                        if (onToolCallDetected) {
                            const prev = detectedToolNames.get(event.contentIndex) || ''
                            if (event.toolCall.name !== prev) {
                                detectedToolNames.set(event.contentIndex, event.toolCall.name)
                                onToolCallDetected(event.toolCall.name, event.contentIndex)
                            }
                        }
                    }
                    break
                case 'done':
                    // Report tool calls if any
                    const finalizedToolCalls = Array.from(toolCallsMap.values())
                    if (finalizedToolCalls.length > 0 && onToolCall) {
                        onToolCall(
                            finalizedToolCalls.map(tc => ({
                                id: tc.id,
                                name: tc.name,
                                arguments: tc.arguments,
                            }))
                        )
                    }
                    if (event.reason === 'toolUse' && finalizedToolCalls.length > 0) {
                        yield { content: '', done: true, finishReason: 'tool_calls' }
                    } else {
                        yield { content: '', done: true, finishReason: event.reason }
                    }
                    return
                case 'error':
                    throw new Error(event.error?.errorMessage || event.reason || 'Stream error')
            }
        }
    }

    /**
     * Legacy raw fetch fallback for providers not in pi-ai catalog (e.g., GLM)
     */
    private async *generateStreamingFallback(
        messages: ChatMessage[],
        _promptTemplate?: string,
        _promptVariables?: Record<string, string | undefined>,
        _tools?: any[],
        _toolChoice?: string
    ): AsyncGenerator<any, void, unknown> {
        const messagesCopy = [...messages]

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
                ...(_tools && _tools.length > 0 ? { tools: _tools, tool_choice: _toolChoice || 'auto' } : {}),
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
                            const content = parsed.choices?.[0]?.delta?.content
                            if (content) {
                                yield { content, done: false }
                            }
                        } catch {
                            continue
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock()
        }
    }

    /**
     * Legacy raw fetch fallback with tool support for providers not in pi-ai catalog
     */
    private async *generateStreamingWithToolsFallback(
        messages: ChatMessage[],
        onToolCall?: (toolCalls: Array<{ id: string; name: string; arguments: any }>) => void,
        tools?: any[],
        onToolCallDetected?: (toolCallName: string, index: number) => void
    ): AsyncGenerator<any, void, unknown> {
        const messagesCopy = [...messages]

        const toolDefinitions = tools || toolRegistry.getToolDefinitions()

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
                tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
                tool_choice: toolDefinitions.length > 0 ? 'auto' : undefined,
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
        const toolCalls = new Map<number, any>()
        let finishReason: string | null = null
        const detectedToolNames = new Map<number, string>()

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
                            if (toolCalls.size > 0 && (finishReason === 'tool_calls' || finishReason === null) && onToolCall) {
                                const arr = Array.from(toolCalls.values())
                                    .filter((tc: any) => tc.function?.name)
                                    .map((tc: any) => {
                                        try {
                                            return {
                                                id: tc.id || '',
                                                name: tc.function.name,
                                                arguments: tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
                                            }
                                        } catch { return null }
                                    })
                                    .filter((tc): tc is { id: string; name: string; arguments: any } => tc !== null)
                                if (arr.length > 0) onToolCall(arr)
                            }
                            yield { content: '', done: true, finishReason: finishReason || undefined }
                            return
                        }

                        try {
                            const parsed = JSON.parse(data)
                            const choice = parsed.choices?.[0]

                            if (choice?.delta?.tool_calls) {
                                for (const tcd of choice.delta.tool_calls) {
                                    const idx = tcd.index
                                    if (!toolCalls.has(idx)) {
                                        toolCalls.set(idx, {
                                            id: tcd.id || '',
                                            type: 'function',
                                            function: { name: '', arguments: '' }
                                        })
                                    }
                                    const tc = toolCalls.get(idx)!
                                    if (tcd.id) tc.id = tcd.id
                                    if (tcd.function?.name) {
                                        tc.function.name += tcd.function.name
                                        if (onToolCallDetected) {
                                            const cur = tc.function.name
                                            const prev = detectedToolNames.get(idx) || ''
                                            if (cur !== prev && cur.length > 0) {
                                                detectedToolNames.set(idx, cur)
                                                onToolCallDetected(cur, idx)
                                            }
                                        }
                                    }
                                    if (tcd.function?.arguments) {
                                        tc.function.arguments += tcd.function.arguments
                                    }
                                }
                            }

                            if (choice?.finish_reason) {
                                finishReason = choice.finish_reason
                                if (finishReason === 'tool_calls' && toolCalls.size > 0 && onToolCall) {
                                    const arr = Array.from(toolCalls.values())
                                        .filter((tc: any) => tc.function?.name)
                                        .map((tc: any) => {
                                            try {
                                                return {
                                                    id: tc.id || '',
                                                    name: tc.function.name,
                                                    arguments: tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
                                                }
                                            } catch { return null }
                                        })
                                        .filter((tc): tc is { id: string; name: string; arguments: any } => tc !== null)
                                    if (arr.length > 0) onToolCall(arr)
                                }
                            }

                            const content = choice?.delta?.content
                            if (content) {
                                yield { content, done: false }
                            }
                        } catch { continue }
                    }
                }
            }
        } finally {
            reader.releaseLock()
        }
    }

    /**
     * Generate streaming response for a chat conversation
     */
    async *generateStreamingResponse(
        messages: ChatMessage[],
        promptTemplate?: string,
        promptVariables?: Record<string, string | undefined>
    ): AsyncGenerator<ChatResponse, void, unknown> {
        try {
            const messagesCopy = [...messages]
            let systemPrompt: string | undefined

            // Add system prompt if template is provided
            if (promptTemplate && promptVariables) {
                systemPrompt = this.loadPrompt(promptTemplate, promptVariables)
                messagesCopy.unshift({
                    role: 'system',
                    content: systemPrompt
                })
            }

            // console.log('sysprompt', systemPrompt)

            // Use pi-ai if supported, otherwise fallback
            if (this.isPiAiSupported()) {
                try {
                    for await (const chunk of this.generateStreamingWithPiAi(
                        messagesCopy,
                        systemPrompt
                    )) {
                        yield chunk
                    }
                    return
                } catch (error) {
                    console.warn('pi-ai streaming failed, falling back to raw fetch:', error)
                }
            }

            // Fallback to raw fetch
            for await (const chunk of this.generateStreamingFallback(
                messagesCopy,
                promptTemplate,
                promptVariables
            )) {
                yield chunk
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
            const messagesCopy = [...messages]
            let systemPrompt: string | undefined

            if (promptTemplate && promptVariables) {
                systemPrompt = this.loadPrompt(promptTemplate, promptVariables)
                messagesCopy.unshift({
                    role: 'system',
                    content: systemPrompt
                })
            }

            // Use pi-ai if supported
            if (this.isPiAiSupported()) {
                try {
                    for await (const chunk of this.generateStreamingWithToolsPiAi(
                        messagesCopy,
                        systemPrompt,
                        onToolCall,
                        undefined,
                        onToolCallDetected
                    )) {
                        yield chunk
                    }
                    return
                } catch (error) {
                    console.warn('pi-ai streaming with tools failed, falling back to raw fetch:', error)
                }
            }

            // Fallback
            for await (const chunk of this.generateStreamingWithToolsFallback(
                messagesCopy,
                onToolCall,
                tools,
                onToolCallDetected
            )) {
                yield chunk
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
            if (msg.role === 'user' || !msg.originalMessages) {
                currentMessages.push({
                    role: msg.role,
                    content: msg.content
                } as ChatMessage)
            } else {
                const t = msg.content.split(/(<\[.*?\] start>[\s\S]*?<\/\[.*?\] end>)/)
                const o = [...msg.originalMessages]
                if (t.length === o.length + 1) {
                    for (let i = 0; i < o.length; i++) {
                        if (o[i].role === 'tool') continue
                        o[i]['content'] = t[i].trim()
                    }
                    currentMessages.push(...o)
                }
                currentMessages.push({ role: msg.role, content: t[t.length - 1] } as ChatMessage)
            }
        }

        // Get current date information
        const now = new Date()
        const currentDate = now.toISOString().split('T')[0]
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
        const weekNumber = this.getWeekNumber(now)
        const year = now.getFullYear().toString()
        const month = (now.getMonth() + 1).toString().padStart(2, '0')
        const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][now.getMonth()]
        const start = currentMessages.length
        const messagesForTool: Map<string, ChatMessage[]> = new Map()

        let maxIterations = 20
        let iteration = 0
        let allResources: Array<{ index: number; url: string; title?: string; source?: string }> = []
        let shouldBreak = false
        let shouldStop = false

        console.log('currentMessages', currentMessages)

        while (iteration < maxIterations) {
            if (shouldStop) break
            iteration++

            let toolCallsToExecute: Array<{ id: string; name: string; arguments: any }> = []

            const handleToolCall = (toolCalls: Array<{ id: string; name: string; arguments: any }>) => {
                toolCallsToExecute = toolCalls
            }

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
                undefined
            )) {
                if (chunk.finishReason) {
                    finishReason = chunk.finishReason
                }
                yield {
                    ...chunk,
                    resources: allResources.length > 0 ? allResources : undefined
                }
            }

            console.log('Finish reason:', finishReason)

            if (toolCallsToExecute.length === 0 || finishReason === 'stop') {
                shouldBreak = true
                break
            }

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
                if (shouldStop) break
                console.log('Tool call:', toolCall)

                const wrappedOnStatusUpdate = onStatusUpdate
                    ? (status: 'start' | 'processing' | 'end', message: string) => {
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
                                    try { content = JSON.parse(existTool?.function.arguments || '{}').instruction || '' } catch { }
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

                assistantToolCalls.push({
                    id: toolCall.id,
                    type: 'function',
                    function: {
                        name: toolCall.name,
                        arguments: JSON.stringify(toolCall.arguments || {})
                    }
                })
            }

            if (assistantToolCalls.length > 0) {
                currentMessages.push({
                    role: 'assistant',
                    content: "",
                    tool_calls: assistantToolCalls
                })
            }

            for (const toolResult of toolResults) {
                currentMessages.push({
                    role: 'tool',
                    content: toolResult.content,
                    tool_call_id: toolResult.tool_call_id
                })
            }
        }

        if (iteration >= maxIterations && !shouldBreak) {
            console.log('Reached max iterations, generating summary response...')

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
                }
            )) {
                yield { ...chunk, resources: allResources.length > 0 ? allResources : undefined }
            }
        }

        onComplete?.(currentMessages.slice(start).map(msg => {
            if (msg.role === 'tool') {
                try {
                    const content = JSON.parse(msg.content)
                    content.data.messages = content.data.messages.map((m: any) => {
                        if (m.role === 'tool') {
                            const d = JSON.parse(m.content)
                            if (d.html) {
                                return {
                                    ...m, content: JSON.stringify({
                                        'success': d.success,
                                        'title': d.title,
                                        'url': d.url,
                                        'content': '...'
                                    })
                                }
                            } else {
                                return m
                            }
                        } else {
                            return m
                        }
                    })
                    return { ...msg, content: JSON.stringify(content) }
                } catch {
                    return msg
                }
            } else {
                return msg
            }
        }) as ChatMessage[])
    }
}
