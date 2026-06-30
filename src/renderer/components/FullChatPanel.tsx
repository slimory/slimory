import React, { useState, useRef, useEffect } from 'react'
import './FullChatPanel.css'
import sendIcon from '../assets/icons/send.svg'
import stopIcon from '../assets/icons/stop.svg'
import slimoryIcon from '../assets/icons/slimey.png'
import plusIcon from '../assets/icons/plus.svg'
import minimizeIcon from '../assets/icons/minimize.svg'
import closeIcon from '../assets/icons/close.svg'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import MarkdownRenderer from './MarkdownRenderer'

interface Message {
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    resources?: Array<{ index: number; url: string; title?: string }>
    originalMessages?: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_calls?: any[]; tool_call_id?: string }> // 添加 originalMessages 字段
}

interface StreamingState {
    isStreaming: boolean
    content: string
    error?: string
}

interface Conversation {
    id: string
    title: string
    lastMessage: string
    timestamp: string
}

const FullChatPanel = () => {
    const { t } = useTranslation()
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const [streamingState, setStreamingState] = useState<StreamingState>({
        isStreaming: false,
        content: ''
    })
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isDropdownShown, setIsDropdownShown] = useState(false) // controls 'show' class
    const [dropdownPosition, setDropdownPosition] = useState({ top: -1, left: -1 })
    const [isHeaderOpaque, setIsHeaderOpaque] = useState(false)
    const [isUserScrolled, setIsUserScrolled] = useState(false)
    const [isNearBottom, setIsNearBottom] = useState(true)
    const [isReady, setIsReady] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const streamingContentRef = useRef('')
    const stopStreamingRef = useRef(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const dropdownButtonRef = useRef<HTMLButtonElement>(null)
    const currentConversationIdRef = useRef<string>('')
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [currentConversationTitle, setCurrentConversationTitle] = useState<string>('Conversations')
    const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null)
    
    // State to track expanded/collapsed tool sections
    const [expandedToolSections, setExpandedToolSections] = useState<Set<string>>(new Set())

    // Format timestamp to relative time string
    const formatTimestamp = (timestamp: number): string => {
        const now = Date.now()
        const diff = now - timestamp
        const seconds = Math.floor(diff / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)
        const weeks = Math.floor(days / 7)
        
        if (seconds < 60) return 'Just now'
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
        if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`
        if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
        
        const date = new Date(timestamp)
        return date.toLocaleDateString()
    }
    
    // Transform stored conversations to UI format
    const transformConversations = (storedConversations: any[]): Conversation[] => {
        return storedConversations.map(conv => ({
            id: conv.id,
            title: conv.title,
            lastMessage: conv.messages && conv.messages.length > 0 
                ? conv.messages[conv.messages.length - 1].content.slice(0, 50) + (conv.messages[conv.messages.length - 1].content.length > 50 ? '...' : '')
                : 'No messages',
            timestamp: formatTimestamp(conv.updatedAt || conv.createdAt)
        }))
    }
    
    // Load conversations for dropdown
    const loadConversations = async () => {
        if (!window.electronAPI) return
        
        try {
            const result = await window.electronAPI.getAllConversations()
            if (result.success && result.conversations) {
                const transformed = transformConversations(result.conversations)
                setConversations(transformed)
                
                // Update current conversation title if it exists in the list
                const currentConv = transformed.find(conv => conv.id === currentConversationIdRef.current)
                if (currentConv) {
                    setCurrentConversationTitle(currentConv.title)
                }
            }
        } catch (error) {
            console.error('Error loading conversations:', error)
        }
    }

    const loadConversationById = async (conversationId: string = currentConversationIdRef.current) => {
        stopStreamingRef.current = false
        // Load messages for the latest conversation
        const result = await window.electronAPI.loadConversation(conversationId)
        if (result.success && result.messages.length > 0) {
            // Convert stored messages to Message format (remove timestamp)
            const loadedMessages: Message[] = result.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                resources: msg.resources,
                originalMessages: msg.originalMessages
            }))
            setMessages(loadedMessages)
            setStreamingState(prev => ({
                ...prev,
                content: result.streamingContent || '',
                isStreaming: result.isStreaming
            }))
            
            // Scroll to bottom after loading messages
            // Use setTimeout to ensure DOM has updated
            setTimeout(() => {
                if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
                    // Reset scroll state when loading conversation
                    setIsUserScrolled(false)
                    setIsNearBottom(true)
                }
            }, 100)
        } else {
            setMessages([])
            setStreamingState(prev => ({
                ...prev,
                content: '',
                isStreaming: false
            }))
        }
        return result.messages.length > 0
    }

    const loadHistory = async () => {
        if (!window.electronAPI) {
            return
        }
        
        try {
            // Get all conversations
            const conversationsResult = await window.electronAPI.getAllConversations()
            
            if (conversationsResult.success && conversationsResult.conversations.length > 0) {
                // Conversations exist - get the latest one (first in sorted array)
                const latestConversation = conversationsResult.conversations[0]
                currentConversationIdRef.current = latestConversation.id
                setCurrentConversationTitle(latestConversation.title || t('conversation.newConversation'))
                loadConversationById()
                // Load conversations for dropdown
                setConversations(transformConversations(conversationsResult.conversations))
            } else {
                // No conversations exist - create a new one with a unique ID
                const newConversationId = `conv-${Date.now()}`
                currentConversationIdRef.current = newConversationId
                setMessages([]) // Start with empty messages
                setConversations([]) // No conversations to show
                setCurrentConversationTitle(t('conversation.newConversation'))
            }
        } catch (error) {
            console.error('Error loading conversation history:', error)
            // On error, start fresh
            const newConversationId = `conv-${Date.now()}`
            currentConversationIdRef.current = newConversationId
            setMessages([])
            setConversations([])
            setCurrentConversationTitle(t('conversation.newConversation'))
        }
    }
    
    // Load conversation history on mount - check if conversations exist and load the latest
    useEffect(() => {
        loadHistory()
    }, [])
    
    useEffect(() => {
        if (!window.electronAPI) return
        
        const handleWindowShown = async (_info: any) => {
            const language = await window.electronAPI.getLanguage()
            i18n.changeLanguage(language)
            const convoExist = await loadConversationById()
            if (!convoExist) {
                setCurrentConversationTitle(t('conversation.newConversation'))
            }
            setIsReady(true)
        }
        
        window.electronAPI.onFullChatWindowShown(handleWindowShown)
    }, [])

    // Smart auto-scroll: only scroll if user is near bottom and hasn't manually scrolled up
    useEffect(() => {
        if (messagesContainerRef.current && streamingState.isStreaming) {
            // Only auto-scroll if user is near bottom and hasn't manually scrolled up
            if (isNearBottom && !isUserScrolled) {
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
            }
        }
    }, [messages, streamingState.content, isNearBottom, isUserScrolled])

    // Handle scroll events: detect user interaction and update header opacity
    useEffect(() => {
        const messagesContainer = messagesContainerRef.current
        if (!messagesContainer) return

        let timeoutId: NodeJS.Timeout | null = null

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainer
            
            // Update header opacity
            setIsHeaderOpaque(scrollTop > 30)
            
            // Check if user is near bottom (within 50px)
            const nearBottom = scrollHeight - scrollTop - clientHeight < 5
            
            // Update near bottom state
            setIsNearBottom(prev => prev !== nearBottom ? nearBottom : prev)
            
            // If user scrolls up manually, mark as user-scrolled
            if (!nearBottom) {
                setIsUserScrolled(prev => prev !== true ? true : prev)
            } else {
                // If user scrolls back to bottom, reset the flag
                setIsUserScrolled(prev => prev !== false ? false : prev)
            }
        }

        // Throttle scroll events for better performance
        const throttledHandleScroll = () => {
            if (timeoutId) return // Skip if already scheduled
            
            timeoutId = setTimeout(() => {
                handleScroll()
                timeoutId = null
            }, 16) // ~60fps throttling
        }

        messagesContainer.addEventListener('scroll', throttledHandleScroll, { passive: true })
        
        // Check initial scroll position
        handleScroll()

        return () => {
            messagesContainer.removeEventListener('scroll', throttledHandleScroll)
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [])

    // Reset scroll state when new streaming starts
    useEffect(() => {
        if (streamingState.isStreaming && streamingState.content === '') {
            // New streaming session started, reset scroll state
            setIsUserScrolled(false)
            setIsNearBottom(true)
        }
    }, [streamingState.isStreaming, streamingState.content])

    const calculatePosition = () => {
        const buttonRect = dropdownButtonRef.current?.getBoundingClientRect()
        if (!buttonRect) return
        
        const viewportHeight = window.innerHeight
        const spaceBelow = viewportHeight - buttonRect.bottom
        const spaceAbove = buttonRect.top
        const gap = 20
        
        // Use actual dropdown height if available, otherwise estimate
        let dropdownHeight = 400 // default max-height
        if (dropdownRef.current) {
            dropdownHeight = dropdownRef.current.scrollHeight
        } else {
            // Estimate based on number of items
            dropdownHeight = Math.min(325, conversations.length * 60 + 20)
        }
        
        // Check if there's enough space below, if not show above
        const shouldShowAbove = spaceBelow < dropdownHeight + gap && spaceAbove > spaceBelow
        
        // setShowDropdownAbove(shouldShowAbove)
        
        if (shouldShowAbove) {
            // Position above the button
            setDropdownPosition({
                top: buttonRect.top + window.scrollY - dropdownHeight - gap,
                left: buttonRect.left + window.scrollX
            })
        } else {
            // Position below the button (default)
            setDropdownPosition({
                top: buttonRect.bottom + window.scrollY + gap - 12,
                left: buttonRect.left + window.scrollX
            })
        }
    }

    const openDropdown = () => {
        setIsDropdownOpen(true)          // mount
        calculatePosition()
        // Reload conversations when opening dropdown
        loadConversations()
        requestAnimationFrame(() => {    // next frame → allow CSS transition
            setIsDropdownShown(true)
        })
    }
    
    const closeDropdown = () => {
        setIsDropdownShown(false)        // start fade-out
        setTimeout(() => {
            setIsDropdownOpen(false)     // unmount after CSS duration
        }, 150) // match your CSS: 1s
    }
    
    const handleDropdownClick = () => {
        if (!isDropdownOpen) openDropdown()
        else closeDropdown()
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target as Node) &&
                dropdownButtonRef.current &&
                !dropdownButtonRef.current.contains(event.target as Node)
            ) {
                closeDropdown()
            }
        }

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isDropdownOpen])

    // Listen for streaming chunks and status updates
    useEffect(() => {
        const handleChatResponseChunk = async (_event: any, chunk: { content: string; done: boolean; resources?: Array<{ index: number; url: string; title?: string; source?: string }>; originalMessages?: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_calls?: any[]; tool_call_id?: string }>; finishReason?: string; conversationId?: string }) => {
            // Ignore chunks if stop was requested
            if (stopStreamingRef.current) {
                if (chunk.done) {
                    // Reset stop flag when streaming is done
                    stopStreamingRef.current = false
                }
                return
            }

            if (currentConversationIdRef.current !== chunk.conversationId) {
                return
            }
            
            if (chunk.done) {
                if (chunk.finishReason !== 'tool_calls') {
                    setStreamingState(prev => ({
                        ...prev,
                        isStreaming: false,
                        content: '' // Clear streaming content when done
                    }))
                    if (streamingContentRef.current.trim()) {
                        const assistantMessage: Message = {
                            role: 'assistant' as const,
                            content: streamingContentRef.current,
                            resources: (chunk.resources || []).map(r => ({
                                index: r.index,
                                url: r.url,
                                title: r.title,
                                source: r.source
                            })),
                            originalMessages: chunk.originalMessages
                        }
                        
                        // Use functional update to prevent duplicate messages
                        setMessages(prev => {
                            // Check if this exact message was already added
                            const lastMessage = prev[prev.length - 1]
                            if (lastMessage && 
                                lastMessage.role === 'assistant' && 
                                lastMessage.content === assistantMessage.content) {
                                return prev // Message already exists, don't add again
                            }
                            return [...prev, assistantMessage]
                        })
                        
                        streamingContentRef.current = ''
                    }
                }
            } else {
                streamingContentRef.current = chunk.content
                // Update streaming state from ref to avoid accumulation issues
                setStreamingState(prev => ({
                    ...prev,
                    content: streamingContentRef.current,
                    resources: (chunk.resources || []).map(r => ({
                        index: r.index,
                        url: r.url,
                        title: r.title,
                        source: r.source
                    }))
                }))
            }
        }

        const handleChatResponseError = (_event: any, error: string) => {
            console.error('Chat response error:', error)
            setStreamingState({
                isStreaming: false,
                content: '',
                error: error
            })
            streamingContentRef.current = ''
        }

        if (window.electronAPI) {
            window.electronAPI.onChatResponseChunk(handleChatResponseChunk)
            window.electronAPI.onChatResponseError(handleChatResponseError)
        }

        return () => {
            // Clean up listeners and reset streaming state
            if (window.electronAPI) {
                if ('removeChatResponseChunk' in window.electronAPI) {
                    (window.electronAPI as any).removeChatResponseChunk()
                }
                if ('removeChatResponseError' in window.electronAPI) {
                    (window.electronAPI as any).removeChatResponseError()
                }
            }
            streamingContentRef.current = ''
            setStreamingState({
                isStreaming: false,
                content: ''
            })
        }
        // Using ref for currentConversationId so we don't need it in dependencies
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Auto-resize textarea
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    
    // Focus textarea when window is shown
    useEffect(() => {
        const focusTextarea = () => {
            if (textareaRef.current) {
                textareaRef.current.focus()
            }
        }
        
        // Focus on mount
        focusTextarea()
        
        // Focus when window becomes visible
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                focusTextarea()
            }
        }
        
        document.addEventListener('visibilitychange', handleVisibilityChange)
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [inputValue])

    // Listen for language updates
    useEffect(() => {
        if (!window.electronAPI) return
        
        const handleLanguageUpdated = (_event: any, language: string) => {
            console.log('Language updated:', language)
            i18n.changeLanguage(language)
        }
        
        window.electronAPI.onLanguageUpdated(handleLanguageUpdated)
        
        return () => {
            // Cleanup if needed
        }
    }, [])

    const handleMinimize = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.currentTarget.style.background = 'transparent'
        if (window.electronAPI) {
            window.electronAPI.minimizeFullChatWindow()
        }
    }

    const handleClose = () => {
        handleHide()
    }

    const handleHide = () => {
        window.electronAPI.closeFullChatWindow()
    }

    useEffect(() => {
        if (!window.electronAPI) return
        window.electronAPI.onHideFullChatWindow(handleHide)
    }, [])

    const handleSend = async () => {
        if (!inputValue.trim() || streamingState.isStreaming) return
        
        // Prevent double-sending
        const messageContent = inputValue.trim()
        setInputValue('')
        
        // Reset stop flag for new request
        stopStreamingRef.current = false
        
        // Add user message
        const userMessage: Message = { role: 'user', content: messageContent }
        
        // Calculate updated messages first
        const updatedMessages = [...messages, userMessage]
        
        // Use functional update to ensure we have the latest messages state and prevent duplicates
        setMessages(prev => {
            // Check if this message was already added (prevent duplicates)
            const lastMessage = prev[prev.length - 1]
            if (lastMessage && lastMessage.role === 'user' && lastMessage.content === messageContent) {
                return prev // Message already exists, don't add again
            }
            return updatedMessages
        })
        
        // Save user message immediately (only if we have a conversation ID)
        if (window.electronAPI && currentConversationIdRef.current) {
            try {
                // Extract only the fields needed for saveMessage (role is guaranteed to be 'user')
                window.electronAPI.saveMessage({
                    role: userMessage.role as 'user' | 'assistant',
                    content: userMessage.content
                }, currentConversationIdRef.current)
                
                // If this is the first message, update the title from the message content
                if (messages.length === 0) {
                    const title = messageContent.trim().slice(0, 50)
                    setCurrentConversationTitle(title.length < messageContent.trim().length ? `${title}...` : title)
                }
            } catch (error) {
                console.error('Error saving user message:', error)
            }
        }
        
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            // Keep textarea focused for continuous input
            textareaRef.current.focus()
        }
        
        // Start streaming state
        setStreamingState({
            isStreaming: true,
            content: ''
        })
        streamingContentRef.current = ''

        try {
            // Generate chat response (pass conversationId so backend can save assistant message)
            // Filter and map messages to match expected type (only 'user' | 'assistant' roles)
            const messagesForAPI = updatedMessages
                .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                .map(msg => ({
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content,
                    originalMessages: msg.originalMessages
                }))
            await window.electronAPI.generateChatResponse('', messagesForAPI, 'chat', currentConversationIdRef.current || 'default')
        } catch (error) {
            console.error('Error generating chat response:', error)
            setStreamingState({
                isStreaming: false,
                content: '',
                error: 'Failed to generate response. Please check your API configuration.'
            })
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleStop = async () => {
        stopStreamingRef.current = true
        setStreamingState({
            isStreaming: false,
            content: ''
        })

        // Notify backend to stop and save current message
        if (window.electronAPI) {
            try {
                await window.electronAPI.stopChatResponse(currentConversationIdRef.current || 'default')
            } catch (error) {
                console.error('Error stopping chat response:', error)
            }
        }
        
        // Add current streaming content as a partial message if any
        if (streamingContentRef.current.trim()) {
            const assistantMessage = {
                role: 'assistant' as const,
                content: streamingContentRef.current + '[!Streaming stopped by user!]'
            }
            setMessages(prev => [...prev, assistantMessage])
            
            streamingContentRef.current = ''
        }
    }

    const handleButtonClick = () => {
        if (streamingState.isStreaming) {
            handleStop()
        } else {
            handleSend()
        }
    }

    const handleNewChat = async () => {
 
        if (messages.length == 0) {
            return
        }
        
        // Create a new conversation ID
        const newConversationId = `conv-${Date.now()}`
        currentConversationIdRef.current = newConversationId
        setCurrentConversationTitle(t('conversation.newConversation'))
        
        // Clear messages
        setMessages([])
        
        // Clear input
        setInputValue('')
        
        // Reset streaming state
        setStreamingState({
            isStreaming: false,
            content: ''
        })
        streamingContentRef.current = ''
        stopStreamingRef.current = false
        
        // Reload conversations to update dropdown
        loadConversations()
        
        // Focus the textarea for immediate input
        if (textareaRef.current) {
            textareaRef.current.focus()
        }
        // handleContainerMouseEnter()
    }
    
    const handleConversationClick = async (conversationId: string) => {
        if (conversationId === currentConversationIdRef.current) {
            // Already viewing this conversation
            setIsDropdownOpen(false)
            return
        }
        
        // Find the conversation to get its title
        const conversation = conversations.find(conv => conv.id === conversationId)
        if (conversation) {
            setCurrentConversationTitle(conversation.title)
        }
        
        // Set current conversation ID
        currentConversationIdRef.current = conversationId
        loadConversationById();
        
        // Close dropdown
        setIsDropdownOpen(false)
    }

    const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
        e.stopPropagation() // Prevent triggering conversation click
        setDeletingConversationId(conversationId)
    }

    const handleCancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        setDeletingConversationId(null)
    }

    const handleConfirmDelete = async (e: React.MouseEvent, conversationId: string) => {
        e.stopPropagation()
        
        if (!window.electronAPI) return
        
        try {
            const result = await window.electronAPI.deleteConversation(conversationId)
            if (result.success) {
                // If deleted conversation is the current one, create a new conversation
                if (conversationId === currentConversationIdRef.current) {
                    const newConversationId = `conv-${Date.now()}`
                    currentConversationIdRef.current = newConversationId
                    setCurrentConversationTitle(t('conversation.newConversation'))
                    setMessages([])
                    setStreamingState({
                        isStreaming: false,
                        content: ''
                    })
                    // Close dropdown if it's open
                    if (isDropdownOpen) {
                        closeDropdown()
                    }
                }
                
                // Reload conversations list
                loadConversations()
            }
        } catch (error) {
            console.error('Error deleting conversation:', error)
        }
        
        setDeletingConversationId(null)
    }

    const parseMessageContent = (content: string, messageId: string | number): Array<{ 
        type: 'text' | 'toolSection'
        content: string
        toolSection?: {
            toolName: string
            title: string  // message from start status
            messages: Array<{ status: string; content: string }>
            sectionId: string  // unique ID for this tool section
        }
    }> => {
        const parts: Array<{ 
            type: 'text' | 'toolSection'
            content: string
            toolSection?: {
                toolName: string
                title: string
                messages: Array<{ status: string; content: string }>
                sectionId: string
            }
        }> = []
        
        // Regex to match complete tool markers: <[toolName] status>message</[toolName] status>
        // Use [\s\S]*? instead of .*? to match newlines as well
        const toolMarkerRegex = /<\[([^\]]+)\]\s+(start|processing|end)>([\s\S]*?)<\/\[\1\]\s+\2>/g
        
        // Extract all complete markers
        const completeMatches: Array<{ toolName: string; status: string; content: string; startIndex: number; endIndex: number }> = []
        toolMarkerRegex.lastIndex = 0
        let match
        while ((match = toolMarkerRegex.exec(content)) !== null) {
            completeMatches.push({
                toolName: match[1],
                status: match[2],
                content: match[3],
                startIndex: match.index,
                endIndex: match.index + match[0].length
            })
        }
        
        // Process matches to build tool sections and extract text
        let pos = 0
        let sectionIdx = 0
        let currentToolSection: {
            toolName: string
            title: string
            messages: Array<{ status: string; content: string }>
        } | null = null
        
        for (const match of completeMatches) {
            // Add text before this marker
            if (match.startIndex > pos) {
                const textBefore = content.substring(pos, match.startIndex).trim()
                if (textBefore) {
                    parts.push({ type: 'text', content: textBefore })
                }
            }
            
            if (match.status === 'start') {
                // Start new section
                currentToolSection = {
                    toolName: match.toolName,
                    title: match.content,
                    messages: []
                }
                // If there's a previous incomplete section, save it
                if (currentToolSection) {
                    // 在 sectionId 中包含 messageId
                    const sectionId = `tool-${currentConversationIdRef.current}-${messageId}-${currentToolSection.toolName}-${sectionIdx++}`
                    parts.push({
                        type: 'toolSection',
                        content: '',
                        toolSection: {
                            toolName: currentToolSection.toolName,
                            title: currentToolSection.title,
                            messages: currentToolSection.messages,
                            sectionId
                        }
                    })
                }
            } else if (currentToolSection && match.toolName === currentToolSection.toolName) {
                // Add to current section
                currentToolSection.messages.push({
                    status: match.status,
                    content: match.content
                })
            }
            
            pos = match.endIndex
        }
        
        // Add remaining text after last marker
        if (pos < content.length) {
            const remainingText = content.substring(pos).trim()
            if (remainingText) {
                parts.push({ type: 'text', content: remainingText })
            }
        }
        
        // If no parts found, return whole content as text
        if (parts.length === 0) {
            return [{ type: 'text', content: content.trim() }]
        }
        
        return parts
    }

    const toggleToolSection = (sectionId: string) => {
        setExpandedToolSections(prev => {
            const newSet = new Set(prev)
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId)
            } else {
                newSet.add(sectionId)
            }
            return newSet
        })
    }

    const renderMessage = (message: Message, index: number) => {
        if (message.role === 'user') {
            return (
                <div key={index} className={`message ${message.role}`}>
                    <div className="message-content">
                        {message.content.replace('[!Streaming stopped by user!]', '')}
                    </div>
                </div>
            )
        }
        
        // For assistant messages, parse and render separately
        const content = message.content.replace('[!Streaming stopped by user!]', '')
        const parts = parseMessageContent(content, index)
        
        return (
            <div key={index} className={`message ${message.role}`}>
                {parts.map((part, partIndex) => {
                    if (part.type === 'toolSection' && part.toolSection) {
                        const { toolSection } = part
                        const isExpanded = expandedToolSections.has(toolSection.sectionId)
                        
                        return (
                            <div key={partIndex} className="tool-section">
                                <div 
                                    className="tool-section-header"
                                    onClick={() => toggleToolSection(toolSection.sectionId)}
                                >
                                    <span className="tool-section-icon">
                                        <svg
                                            className="transition-transform duration-200"
                                            style={{
                                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                width: '12px',
                                                height: '12px'
                                            }}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </span>
                                    <span className={toolSection.messages.some(msg => msg.status === 'end') ? 'tool-section-title' : 'tool-section-title-masked'}>
                                        {toolSection.title}
                                    </span>
                                </div>
                                {isExpanded && (
                                    <div className="tool-section-content">
                                        {toolSection.messages.map((msg, msgIndex) => (
                                            <div key={msgIndex} className="tool-message-item">
                                                <span className="tool-message-text">{msg.content}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    } else {
                        return (
                            <div key={partIndex} className="message-content">
                                <MarkdownRenderer 
                                    content={part.content} 
                                    resources={message.resources}
                                />
                            </div>
                        )
                    }
                })}
            </div>
        )
    }
    
    const renderStreamingMessage = (messageIndex: number) => {
        if (streamingState.error) {
            return (
                <div className="message assistant">
                    <div className="message-content error">
                        ⚠️ {streamingState.error}
                    </div>
                </div>
            )
        }

        if (streamingState.isStreaming && streamingState.content) {
            // Use 'streaming' as the messageId, or use messages.length
            const parts = parseMessageContent(streamingState.content, messageIndex)
            
            // Need to get streaming resources from somewhere (may need to be added to streamingState)
            // Temporarily use an empty array, or fetch from streamingState
            const streamingResources = (streamingState as any).resources || []
            
            return (
                <div className="message assistant">
                    {parts.map((part, partIndex) => {
                        if (part.type === 'toolSection' && part.toolSection) {
                            const { toolSection } = part
                            const isExpanded = expandedToolSections.has(toolSection.sectionId)
                            
                            return (
                                <div key={partIndex} className="tool-section">
                                    <div 
                                        className="tool-section-header"
                                        onClick={() => toggleToolSection(toolSection.sectionId)}
                                    >
                                        <span className="tool-section-icon">
                                            <svg
                                                className="transition-transform duration-200"
                                                style={{
                                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                    width: '12px',
                                                    height: '12px'
                                                }}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </span>
                                        <span className={toolSection.messages.some(msg => msg.status === 'end') ? 'tool-section-title' : 'tool-section-title-masked'}>
                                            {toolSection.title}
                                        </span>
                                    </div>
                                    {isExpanded && (
                                        <div className="tool-section-content">
                                            {toolSection.messages.map((msg, msgIndex) => (
                                                <div key={msgIndex} className="tool-message-item">
                                                    <span className="tool-message-text">{msg.content}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        } else {
                            return (
                                <div key={partIndex} className="message-content">
                                    <MarkdownRenderer 
                                        content={part.content} 
                                        resources={streamingResources}
                                    />
                                    {partIndex === parts.length - 1 && <span className="cursor">|</span>}
                                </div>
                            )
                        }
                    })}
                </div>
            )
        }

        return null
    }

    const handlePanelMouseEnter = () => {
        // Disable click-through when the mouse enters the panel (content area)
        const header = document.querySelector(".full-chat-header") as HTMLElement
        if (header) {
            (header.style as any).WebkitAppRegion = 'drag'
        }
        if (window.electronAPI && window.electronAPI.setWindowIgnoreMouse) {
            window.electronAPI.setWindowIgnoreMouse('full-chat', false, false)
        }
    }

    // Listen for the mouseenter event on the document
    useEffect(() => {
        // Track mouse position
        let mouseX = 0
        let mouseY = 0
        
        const handleMouseMove = (event: MouseEvent) => {
            mouseX = event.clientX
            mouseY = event.clientY
        }
        
        const handleDocumentMouseEnter = (event: MouseEvent) => {
            // Check if the mouse is inside the panel; if so, do not handle it, let the panel's event handler process it
            const target = event.target as HTMLElement
            const panel = document.querySelector('.full-chat-panel')
            
            if (!panel) return

            const dropdown = document.querySelector('.conversation-dropdown-menu')
            if ((panel && panel.contains(target)) || (dropdown && dropdown.contains(target))) {
                return
            }

            const header = document.querySelector(".full-chat-header") as HTMLElement
            if (header) {
                (header.style as any).WebkitAppRegion = 'no-drag'
            }
            
            if (window.electronAPI && window.electronAPI.setWindowIgnoreMouse) {
                window.electronAPI.setWindowIgnoreMouse('full-chat', true, true)
            }
        }

        // Determine if the mouse is within the full-chat-panel range
        const isMouseInPanel = (): boolean => {
            const panel = document.querySelector('.full-chat-panel') as HTMLElement
            if (!panel) return false
            
            const rect = panel.getBoundingClientRect()
            return (
                mouseX >= rect.left &&
                mouseX <= rect.right &&
                mouseY >= rect.top &&
                mouseY <= rect.bottom
            )
        }

        window.electronAPI.onWindowMoved((_event: any, _windowName: string, status: string) => {
            if (status === 'start') {
                if (window.electronAPI && window.electronAPI.setWindowIgnoreMouse) {
                    window.electronAPI.setWindowIgnoreMouse('full-chat', false, false)
                }
            } else if (status === 'end') {
                if (window.electronAPI && window.electronAPI.setWindowIgnoreMouse) {
                    if (isMouseInPanel()) {
                        window.electronAPI.setWindowIgnoreMouse('full-chat', false, false)
                    } else {
                        window.electronAPI.setWindowIgnoreMouse('full-chat', true, true)
                    }
                }
            }
        })

        document.addEventListener('mousemove', handleMouseMove)
        document.body.addEventListener('mouseover', handleDocumentMouseEnter)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.body.removeEventListener('mouseover', handleDocumentMouseEnter)
        }
    }, [])

    return (
        <div 
            className={`full-chat-container`} 
        >
            <div 
                className={`full-chat-panel ${isReady ? 'ready' : ''}`} 
                onMouseEnter={handlePanelMouseEnter}
            >
                <div className="full-chat-content">
                    <div 
                        className={`full-chat-header ${isHeaderOpaque ? 'opaque' : ''}`} 
                        // style={{ WebkitAppRegion: 'drag', position: 'relative' } as React.CSSProperties}
                        >
                        <div className="conversation-dropdown">
                            <button
                                ref={dropdownButtonRef}
                                className="conversation-dropdown-toggle"
                                onClick={() => handleDropdownClick()}
                                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                            >
                                <img src={slimoryIcon} alt="Conversations" className="slimory-icon" />
                                <span className="conversation-dropdown-text">{currentConversationTitle}</span>
                                <svg 
                                    className="conversation-dropdown-arrow"
                                    width="12" 
                                    height="12" 
                                    viewBox="0 0 12 12" 
                                    fill="none"
                                >
                                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                        </div>
                        <button
                            // className="icon-button tooltip"
                            className="icon-button tooltip"
                            onClick={handleNewChat}
                            data-tooltip={t('tooltip.newChat')}
                            style={{ 
                                WebkitAppRegion: 'no-drag',
                                marginTop: '20px',
                                marginRight: '5px',
                                marginLeft: 'auto'
                            } as React.CSSProperties}
                        >
                            <img src={plusIcon} className="icon" alt="Add new chat" />
                        </button>
                        <button
                            className="tooltip"
                            data-tooltip={t('tooltip.minimize')}
                            onClick={handleMinimize}
                            style={{
                                marginTop: '22px',
                                marginRight: '5px',
                                width: '32px',
                                height: '32px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px',
                                borderRadius: '16px',
                                transition: 'background 0.2s ease',
                                WebkitAppRegion: 'no-drag'
                            } as React.CSSProperties}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                            }}
                        >
                            <img 
                                src={minimizeIcon} 
                                alt="Minimize" 
                                style={{ 
                                    width: '20px', 
                                    height: '20px',
                                    filter: 'invert(0.3)'
                                }} 
                            />
                        </button>
                        <button
                            className="tooltip"
                            data-tooltip={t('tooltip.close')}
                            onClick={handleClose}
                            style={{
                                marginTop: '22px',
                                marginRight: '22px',
                                width: '32px',
                                height: '32px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px',
                                borderRadius: '16px',
                                transition: 'background 0.2s ease',
                                WebkitAppRegion: 'no-drag'
                            } as React.CSSProperties}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                            }}
                        >
                            <img 
                                src={closeIcon} 
                                alt="Close" 
                                style={{ 
                                    width: '20px', 
                                    height: '20px',
                                    filter: 'invert(0.3)'
                                }} 
                            />
                        </button>
                    </div>
                    <div 
                        ref={messagesContainerRef}
                        className="full-chat-messages no-scrollbar"
                        style={ { "paddingBottom": messages.length > 0 ? "20px":"8px" } }
                        onClick={(e) => e.stopPropagation()}>
                        {messages.map((message, index) => renderMessage(message, index))}
                        {renderStreamingMessage(messages.length)}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="full-chat-input-container">
                        <textarea
                            ref={textareaRef}
                            className="full-chat-input"
                            // placeholder={isRecording ? 'Recording...' : t('chat.placeholder')}
                            placeholder={t('chat.placeholder')}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            style={{ resize: 'none' }}
                            rows={1}
                            autoFocus
                            // disabled={isRecording || isTranscribing}
                        />
                        <button
                            className="full-chat-send-btn"
                            onClick={handleButtonClick}
                            disabled={!streamingState.isStreaming && !inputValue.trim()}
                        >
                            {streamingState.isStreaming ? (
                                <img src={stopIcon} alt="Stop" className="send-icon" />
                            ) : (
                                <img src={sendIcon} alt={t('alt.send')} className="send-icon" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
            {isDropdownOpen && (
                <div 
                    ref={dropdownRef}
                    className={`conversation-dropdown-menu no-scrollbar ${isDropdownShown ? 'show' : ''}`}
                    style={{
                        position: 'fixed',
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`
                    }}
                    onMouseEnter={handlePanelMouseEnter}
                >
                    {conversations.length > 0 ? (
                        conversations.map((conv) => (
                            <div
                                key={conv.id}
                                className="conversation-item"
                                onClick={() => handleConversationClick(conv.id)}
                            >
                                <div className="conversation-item-content">
                                    <div className={`conversation-item-title ${conv.id === currentConversationIdRef.current ? 'current' : ''}`}>{conv.title}</div>
                                    <div className="conversation-item-meta">
                                        <span className="conversation-item-last-message">{conv.lastMessage}</span>
                                        <span className="conversation-item-timestamp">{conv.timestamp}</span>
                                    </div>
                                </div>
                                {deletingConversationId === conv.id ? (
                                    <div className="conversation-delete-confirm" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="conversation-delete-btn confirm"
                                            onClick={(e) => handleConfirmDelete(e, conv.id)}
                                        >
                                            {t('tools.webPilot.delete')}
                                        </button>
                                        <button
                                            className="conversation-delete-btn cancel"
                                            onClick={handleCancelDelete}
                                        >
                                            {t('tools.webPilot.cancel')}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="conversation-delete-icon"
                                        onClick={(e) => handleDeleteClick(e, conv.id)}
                                        title={t('tools.webPilot.delete')}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="conversation-item" style={{ opacity: 0.6, cursor: 'default' }}>
                            <div className="conversation-item-title">{t('conversation.noConversations')}</div>
                            <div className="conversation-item-meta">
                                <span className="conversation-item-last-message">{t('conversation.startNewConversation')}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default FullChatPanel