import { useState, useRef, useEffect } from 'react'
import './ChatPanel.css'
import sendIcon from '../assets/icons/send.svg'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

interface ChatPanelProps {
    selectedText: string
    command: string
    clearMessagesFlag: boolean
    language: string
}

const ChatPanel = ({ selectedText, command, clearMessagesFlag, language }: ChatPanelProps) => {
    const { t } = useTranslation()
    
    // Update i18n language when language prop changes
    useEffect(() => {
        i18n.changeLanguage(language)
    }, [language])
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    // Expose clearMessages function to parent
    useEffect(() => {
        setMessages([])
    }, [clearMessagesFlag])

    // Focus input when chat is shown (when clearMessagesFlag changes)
    useEffect(() => {
        if (selectedText && inputRef.current) {
            // Use setTimeout to ensure the component is fully rendered
            setTimeout(() => {
                inputRef.current?.focus()
            }, 0)
        }
    }, [clearMessagesFlag, selectedText])

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Listen for complete assistant messages from message window
    useEffect(() => {
        const handleChatResponseComplete = (_event: any, message: { role: 'user' | 'assistant'; content: string }) => {
            setMessages(prev => [...prev, message])
        }

        // Register IPC listener
        if (window.electronAPI) {
            window.electronAPI.onChatResponseComplete(handleChatResponseComplete)
        }

        return () => {
            // Cleanup listeners if needed
        }
    }, [])

    const handleSend = () => {
        if (!inputValue.trim()) return

        // Add user message
        const userMessage: Message = { role: 'user', content: inputValue }
        const updatedMessages = [...messages, userMessage]
        setMessages(updatedMessages)

        // if (inputRef.current) {
        //     inputRef.current.focus()
        // }

        // Open message window with all messages (use command prop)
        if (window.electronAPI) {
            if (command === 'modify') {
                // wait for input value to be cleared
                setTimeout(() => {
                    window.electronAPI.openMessageWindow(updatedMessages, selectedText, command)
                }, 100)
            } else {
                window.electronAPI.openMessageWindow(updatedMessages, selectedText, command)
            }
        }

        setInputValue('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        // Only hide if clicking on the overlay itself
        if (e.target === e.currentTarget) {
            // Hide both message window and chat window
            if (window.electronAPI) {
                window.electronAPI.closeMessageWindow()
                window.electronAPI.closeChatWindow()
            }
        }
    }

    return (
        <div className="chat-panel-overlay" onClick={handleOverlayClick}>
            <div className="chat-panel">
                <div className="chat-input-container">
                    <input
                        ref={inputRef}
                        type="text"
                        className="chat-input"
                        placeholder={t('chat.placeholder')}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    <button
                        className="chat-send-btn"
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                    >
                        <img src={sendIcon} alt={t('alt.send')} className="send-icon" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ChatPanel

