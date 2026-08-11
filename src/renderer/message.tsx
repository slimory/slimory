import { useState, useEffect, useRef, useCallback } from 'react'
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
    const [toastMessage, setToastMessage] = useState<string>('')
    const [showToast, setShowToast] = useState(false)
    const [panelCenterX, setPanelCenterX] = useState(0)
    const [toastTop, setToastTop] = useState(0)
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Compute toast position: prefer below the message-panel (outside); fall back to the bottom
    // of the panel (inside) when there is not enough room below within the message window.
    const updateToastPosition = useCallback(() => {
        const panel = messagePanelRef.current
        if (!panel) return
        const rect = panel.getBoundingClientRect()

        // Center horizontally relative to the actual message-panel width
        setPanelCenterX(rect.left + rect.width / 2)

        const TOAST_HEIGHT = 34
        const GAP = 8
        const BOTTOM_MARGIN = 28
        const windowHeight = window.innerHeight

        // Preferred: below the panel (outside), leaving a small gap
        const preferredTop = rect.bottom + GAP
        if (preferredTop + TOAST_HEIGHT <= windowHeight - BOTTOM_MARGIN) {
            setToastTop(preferredTop)
        } else {
            // Fallback: inside bottom of the panel when it fills the window
            setToastTop(windowHeight - TOAST_HEIGHT - BOTTOM_MARGIN)
        }
    }, [])

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
            // Hide toast as well
            setShowToast(false)
            setToastMessage('')
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current)
                toastTimerRef.current = null
            }
        }

        // Listen for toast messages
        const handleShowToast = (_event: any, message: string) => {
            // Recompute position in case the panel size changed before the toast appeared
            updateToastPosition()
            setToastMessage(message)
            setShowToast(true)
            // Clear any existing timer before starting a new one
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current)
            }
            // Auto-hide toast after 2 seconds
            toastTimerRef.current = setTimeout(() => {
                setShowToast(false)
            }, 2000)
        }

        // Register IPC listeners
        if (window.electronAPI) {
            window.electronAPI.onShowMessage(handleShowMessage)
            window.electronAPI.onChatResponseChunk(handleChatResponseChunk)
            window.electronAPI.onChatResponseError(handleChatResponseError)
            window.electronAPI.onHideMessage(handleHideMessage)
            window.electronAPI.onShowToast(handleShowToast)
        }

        return () => {
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current)
            }
        }
    }, [updateToastPosition])

    // Monitor panel width vs screen width for overflow detection, and track panel center for toast positioning
    useEffect(() => {
        const panel = messagePanelRef.current
        if (!panel) return

        const checkWidth = () => {
            const panelRect = panel.getBoundingClientRect()

            // Update toast position (center X + top) relative to the actual message-panel size
            updateToastPosition()

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
    }, [streamingState.content, messagesData?.messages, updateToastPosition])

    if (!messagesData) {
        return <div></div>
    }

    return (
        <div style={{ display: isHidden ? 'none' : 'block', width: '100vw', height: '100vh', background: 'transparent' }}>
            <MessagePanel
                messageData={messagesData.messages[messagesData.messages.length - 1]}
                streamingState={streamingState}
                directionState={directionState}
                ref={messagePanelRef}
            />
            {/* Toast notification - shown below the message-panel (or inside its bottom when the panel fills the window) */}
            {showToast && (
                <div
                    className="toast-notification"
                    style={{
                        top: toastTop,
                        left: panelCenterX,
                    }}
                >
                    {toastMessage}
                </div>
            )}
        </div>
    )
}

createRoot(document.getElementById('root')!).render(
    <MessageApp />,
)
