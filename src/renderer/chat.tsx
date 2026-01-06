import { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import ChatPanel from './components/ChatPanel'
import './index.css'
import './i18n'
import i18n from './i18n'

function ChatApp() {
    const [selectedText, setSelectedText] = useState<string>('')
    const [command, setCommand] = useState<string>('ask')
    const [clearMessagesFlag, setClearMessagesFlag] = useState<(boolean)>(false)
    const [language, setLanguage] = useState<string>('zh')

    useEffect(() => {
        console.log('ChatApp mounted, registering IPC listeners...')

        // Get initial language
        const loadLanguage = async () => {
            if (window.electronAPI) {
                try {
                    const lang = await window.electronAPI.getLanguage()
                    setLanguage(lang)
                    i18n.changeLanguage(lang)
                } catch (error) {
                    console.error('Failed to load language:', error)
                }
            }
        }

        loadLanguage()

        // Listen for language updates
        const handleLanguageUpdated = (_event: any, lang: string) => {
            setLanguage(lang)
            i18n.changeLanguage(lang)
        }

        // Listen for show-chat event from main process
        const handleShowChat = (_event: any, text: string, _translation: boolean = false, cmd: string = 'ask') => {
            console.log('Received show-chat event with text:', text, 'command:', cmd)
            setSelectedText(text)
            setCommand(cmd)

            // Clear messages when showing chat
            setClearMessagesFlag((prev) => !prev)
        }

        // Register IPC listeners
        if (window.electronAPI) {
            console.log('electronAPI available, registering listeners')
            window.electronAPI.onShowChat(handleShowChat)
            window.electronAPI.onLanguageUpdated(handleLanguageUpdated)
        } else {
            console.error('electronAPI not available!')
        }
    }, [])

    return (
        <div style={{ width: '100vw', height: '100vh', background: 'transparent' }}>
            <ChatPanel
                selectedText={selectedText}
                command={command}
                clearMessagesFlag={clearMessagesFlag}
                language={language}
            />
        </div>
    )
}

createRoot(document.getElementById('root')!).render(
    <ChatApp />,
)

