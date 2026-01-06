import { useEffect, forwardRef, useState, useCallback } from 'react'
import './MessagePanel.css'
import MarkdownRenderer from './MarkdownRenderer'

interface MessageData {
    role: 'user' | 'assistant'
    content: string
}

interface StreamingState {
    isStreaming: boolean
    content: string
    error?: string
}

interface DirectionState {
    direction: string
}

interface MessagePanelProps {
    messageData: MessageData
    streamingState: StreamingState
    directionState: DirectionState
}

const MessagePanel = forwardRef<HTMLDivElement, MessagePanelProps>(({ messageData, streamingState, directionState }, ref) => {
    const [isUserScrolled, setIsUserScrolled] = useState(false)
    const [isNearBottom, setIsNearBottom] = useState(true)

    // Smart auto-scroll logic
    useEffect(() => {
        if (streamingState.isStreaming && ref && typeof ref === 'object' && ref.current) {
            const element = ref.current
            
            // Only auto-scroll if user hasn't manually scrolled up
            if (isNearBottom && !isUserScrolled) {
                element.scrollTop = element.scrollHeight
            }
        }
    }, [streamingState.content, streamingState.isStreaming, ref, isNearBottom, isUserScrolled])

    // Handle scroll events to detect user interaction (throttled for performance)
    const handleScroll = useCallback(() => {
        if (ref && typeof ref === 'object' && ref.current) {
            const element = ref.current
            const { scrollTop, scrollHeight, clientHeight } = element
            
            // Check if user is near bottom (within 50px)
            const nearBottom = scrollHeight - scrollTop - clientHeight < 5
            
            // Only update state if values actually changed to prevent unnecessary re-renders
            setIsNearBottom(prev => prev !== nearBottom ? nearBottom : prev)
            
            // If user scrolls up manually, mark as user-scrolled
            if (!nearBottom) {
                setIsUserScrolled(prev => prev !== true ? true : prev)
            } else {
                // If user scrolls back to bottom, reset the flag
                setIsUserScrolled(prev => prev !== false ? false : prev)
            }
        }
    }, [ref])

    // Add scroll event listener with throttling for better performance
    useEffect(() => {
        if (ref && typeof ref === 'object' && ref.current) {
            const element = ref.current
            let timeoutId: NodeJS.Timeout | null = null
            
            const throttledHandleScroll = () => {
                if (timeoutId) return // Skip if already scheduled
                
                timeoutId = setTimeout(() => {
                    handleScroll()
                    timeoutId = null
                }, 16) // ~60fps throttling
            }
            
            element.addEventListener('scroll', throttledHandleScroll, { passive: true })
            
            return () => {
                element.removeEventListener('scroll', throttledHandleScroll)
                if (timeoutId) {
                    clearTimeout(timeoutId)
                }
            }
        }
    }, [ref, handleScroll])

    // Reset scroll state when new content starts streaming
    useEffect(() => {
        if (streamingState.isStreaming && streamingState.content === '') {
            // New streaming session started, reset scroll state
            setIsUserScrolled(false)
            setIsNearBottom(true)
        }
    }, [streamingState.isStreaming, streamingState.content])

    const renderContent = () => {
        if (streamingState.error) {
            return (
                <div className="error-text">
                    ⚠️ {streamingState.error}
                </div>
            )
        }

        if (streamingState.isStreaming) {
            return (
                streamingState.content ? <div className="streaming-text">
                    <MarkdownRenderer content={streamingState.content} />
                </div> : <span className="cursor">|</span>
            )
        }

        if (streamingState.content) {
            return (
                <div className="response-text">
                    <MarkdownRenderer content={streamingState.content} />
                </div>
            )
        }

        return (
            <div className="user-text">
                <MarkdownRenderer content={messageData.content} />
            </div>
        )
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        // Only hide if clicking on the overlay itself, not on the message panel
        if (e.target === e.currentTarget) {
            // Hide both message window and chat window
            if (window.electronAPI) {
                window.electronAPI.closeMessageWindow()
                window.electronAPI.closeChatWindow()
            }
        }
    }

    return (
        <div 
            className="message-panel-overlay" 
            onClick={handleOverlayClick}
            style={directionState.direction === "top" ? { display: 'flex', alignItems: 'flex-end' } : { display: 'flex', alignItems: 'flex-start' }}
        >
            <div className="message-panel" ref={ref} onClick={(e) => e.stopPropagation()}>
                {renderContent()}
            </div>
        </div>
    )
})

export default MessagePanel
