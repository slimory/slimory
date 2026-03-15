import { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import MessagePanel from './components/MessagePanel'
import './components/MessagePanel.css'

interface MessageData {
    role: 'user' | 'assistant'
    content: string
}

interface MessagesData {
    messages: MessageData[]
    selectedText: string
    isNewSession: boolean
    command: string
    direction: string
}

interface StreamingState {
    isStreaming: boolean
    content: string
    error?: string
}

interface DirectionState {
    direction: string
}

const MessageApp = () => {
    const [messagesData, setMessagesData] = useState<MessagesData | null>(null)
    const [streamingState, setStreamingState] = useState<StreamingState>({
        isStreaming: false,
        content: ''
    })
    const streamingContentRef = useRef('')
    const [directionState, setDirectionState] = useState<DirectionState>({
        direction: ''
    })

    const [isHidden, setIsHidden] = useState(false)
    const [command, setCommand] = useState('')
    const messagePanelRef = useRef<HTMLDivElement>(null)
    const currentSessionIdRef = useRef<string>('')

    useEffect(() => {
        // Listen for message data from main process
        const handleShowMessage = async (_event: any, messages: MessageData[], selectedText: string, _isNewSession: boolean, command: string, direction: string, sessionId?: string) => {
            setIsHidden(false)
            setMessagesData({
                messages,
                selectedText,
                isNewSession: _isNewSession,
                command,
                direction
            })
            setDirectionState({ direction })
            setCommand(command)
            streamingContentRef.current = ''
            // Store session ID to filter stale streaming chunks
            currentSessionIdRef.current = sessionId || ''
            
            // Get the last message (should be the user's question)
            const lastMessage = messages[messages.length - 1]
            // If this is a user question, generate AI response
            if (lastMessage && lastMessage.role === 'user') {
                setStreamingState({
                    isStreaming: true,
                    content: ''
                })

                try {
                    // Start the chat response generation with full conversation history
                    // Use 'default' conversationId for message window (backend will save assistant message)
                    await window.electronAPI.generateChatResponse(selectedText, messages, command, sessionId)
                } catch (error) {
                    console.error('Error generating chat response:', error)
                    setStreamingState({
                        isStreaming: false,
                        content: '',
                        error: 'Failed to generate response. Please check your API configuration.'
                    })
                }
            }
        }

        // Listen for streaming chunks
        const handleChatResponseChunk = (_event: any, chunk: { content: string; done: boolean; sessionId?: string }) => {
            // Ignore chunks from previous sessions
            if (chunk.sessionId && chunk.sessionId !== currentSessionIdRef.current) {
                return
            }
            if (isHidden) {
                return
            }
            if (chunk.done) {
                setStreamingState(prev => ({
                    ...prev,
                    isStreaming: false
                }))
                // if (streamingContentRef.current.trim()) {
                //     const assistantMessage = {
                //         role: 'assistant' as const,
                //         content: streamingContentRef.current
                //     }
                //     // Send to ChatPanel via main process
                //     if (window.electronAPI) {
                //         window.electronAPI.sendChatResponseComplete(assistantMessage)
                //     }
                // }
            } else {
                streamingContentRef.current += chunk.content
                setStreamingState(prev => ({
                    ...prev,
                    content: prev.content + chunk.content
                }))
            }
        }

        // Listen for errors
        const handleChatResponseError = (_event: any, error: string) => {
            console.error('Chat response error:', error)
            setStreamingState({
                isStreaming: false,
                content: '',
                error: error
            })
        }

        // Listen for hide message event to clear content
        const handleHideMessage = () => {
            setIsHidden(true)
            setMessagesData(null)
            setStreamingState({
                isStreaming: false,
                content: ''
            })
            setDirectionState({ direction: '' })
        }

        // Register IPC listeners
        if (window.electronAPI) {
            window.electronAPI.onShowMessage(handleShowMessage)
            window.electronAPI.onChatResponseChunk(handleChatResponseChunk)
            window.electronAPI.onChatResponseError(handleChatResponseError)
            window.electronAPI.onHideMessage(handleHideMessage)
        }
    }, [])

    // Monitor panel width vs screen width for overflow detection
    useEffect(() => {
        const panel = messagePanelRef.current
        if (!panel) return

        const checkWidth = () => {
            const panelRect = panel.getBoundingClientRect()
            
            // Get desktop screen dimensions
            const desktopScreenWidth = window.screen.width
            
            const exceedsScreenWidth = window.screenX + panelRect.left + panelRect.width - desktopScreenWidth
            
            if (exceedsScreenWidth > 0) {
                // Adjust message window position by moving it left by the exceeded amount
                if (window.electronAPI && 'adjustMessageWindowPosition' in window.electronAPI) {
                    const adjustmentAmount = -Math.floor(exceedsScreenWidth)
                    ;(window.electronAPI as any).adjustMessageWindowPosition(adjustmentAmount, command)
                }
            }
        }

        // Check on mount and when content changes
        checkWidth()

        // Use ResizeObserver to monitor size changes
        const resizeObserver = new ResizeObserver(checkWidth)
        resizeObserver.observe(panel)

        // Also listen for window resize
        window.addEventListener('resize', checkWidth)

        return () => {
            resizeObserver.disconnect()
            window.removeEventListener('resize', checkWidth)
        }
    }, [streamingState.content, messagesData?.messages])

    if (!messagesData) {
        return <div></div>
    }

    return <div style={{ display: isHidden ? 'none' : 'block', width: '100vw', height: '100vh', background: 'transparent' }}>
        <MessagePanel 
            messageData={messagesData.messages[messagesData.messages.length - 1]}
            streamingState={streamingState}
            directionState={directionState}
            ref={messagePanelRef}
        />
    </div>
}

createRoot(document.getElementById('root')!).render(
    <MessageApp />,
)
