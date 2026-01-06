import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { ChatMessage } from './chatService'

export interface StoredMessage {
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    resources?: Array<{ index: number; url: string; title?: string; source?: string }> // 添加 resources 字段（可选，向后兼容）
    originalMessages?: ChatMessage[]
}

export interface Conversation {
    id: string
    title: string
    messages: StoredMessage[]
    createdAt: number
    updatedAt: number
}

export class ConversationStorage {
    private storageDir: string
    private conversationsFile: string
    private defaultConversationId = 'default'

    constructor() {
        // Use Electron's userData directory for storing conversations
        this.storageDir = app.getPath('userData')
        this.conversationsFile = path.join(this.storageDir, 'conversations.json')
        
        // Ensure storage directory exists
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true })
        }
    }

    /**
     * Load all conversations from storage
     */
    loadConversations(): Record<string, Conversation> {
        try {
            if (!fs.existsSync(this.conversationsFile)) {
                return {}
            }
            
            const data = fs.readFileSync(this.conversationsFile, 'utf-8')
            return JSON.parse(data)
        } catch (error) {
            console.error('Error loading conversations:', error)
            return {}
        }
    }

    /**
     * Save all conversations to storage
     */
    private saveConversations(conversations: Record<string, Conversation>): void {
        try {
            fs.writeFileSync(this.conversationsFile, JSON.stringify(conversations, null, 2), 'utf-8')
        } catch (error) {
            console.error('Error saving conversations:', error)
            throw error
        }
    }

    /**
     * Load messages for a specific conversation
     */
    loadConversation(conversationId: string = this.defaultConversationId): StoredMessage[] {
        const conversations = this.loadConversations()
        const conversation = conversations[conversationId]
        return conversation?.messages || []
    }

    /**
     * Save a message to a conversation
     */
    saveMessage(
        message: StoredMessage,
        conversationId: string = this.defaultConversationId
    ): void {
        const conversations = this.loadConversations()
        
        if (!conversations[conversationId]) {
            // Create new conversation
            conversations[conversationId] = {
                id: conversationId,
                title: this.generateTitle(message.content),
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
        }

        // Add message to conversation
        conversations[conversationId].messages.push(message)
        conversations[conversationId].updatedAt = Date.now()

        // Update title if it's the first message
        if (conversations[conversationId].messages.length === 1) {
            conversations[conversationId].title = this.generateTitle(message.content)
        }

        this.saveConversations(conversations)
    }

    /**
     * Save multiple messages at once (useful for batch saves)
     */
    saveMessages(
        messages: StoredMessage[],
        conversationId: string = this.defaultConversationId
    ): void {
        const conversations = this.loadConversations()
        
        if (!conversations[conversationId]) {
            // Create new conversation
            const firstMessage = messages[0]
            conversations[conversationId] = {
                id: conversationId,
                title: firstMessage ? this.generateTitle(firstMessage.content) : 'New Conversation',
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
        }

        // Add all messages to conversation
        conversations[conversationId].messages.push(...messages)
        conversations[conversationId].updatedAt = Date.now()

        // Update title if it's the first message
        if (conversations[conversationId].messages.length === messages.length && messages[0]) {
            conversations[conversationId].title = this.generateTitle(messages[0].content)
        }

        this.saveConversations(conversations)
    }

    /**
     * Clear a conversation
     */
    clearConversation(conversationId: string = this.defaultConversationId): void {
        const conversations = this.loadConversations()
        if (conversations[conversationId]) {
            conversations[conversationId].messages = []
            conversations[conversationId].updatedAt = Date.now()
            this.saveConversations(conversations)
        }
    }

    /**
     * Delete a conversation completely
     */
    deleteConversation(conversationId: string): void {
        const conversations = this.loadConversations()
        if (conversations[conversationId]) {
            delete conversations[conversationId]
            this.saveConversations(conversations)
        }
    }

    /**
     * Get all conversations (for conversation list)
     */
    getAllConversations(): Conversation[] {
        const conversations = this.loadConversations()
        return Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt)
    }

    /**
     * Generate a title from the first message
     */
    private generateTitle(content: string): string {
        // Take first 50 characters as title
        const title = content.trim().slice(0, 50)
        return title.length < content.length ? `${title}...` : title
    }
}
