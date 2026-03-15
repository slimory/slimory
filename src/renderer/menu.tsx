import { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import MenuPopup from './components/MenuPopup'
import './index.css'
import './i18n'
import i18n from './i18n'

interface CustomAction {
    id: string
    name: string
    prompt: string
    icon?: string
}

interface MenuData {
    text: string
    x: number
    y: number
    actions?: string[]
}

function MenuApp() {
    const [menuData, setMenuData] = useState<MenuData | null>(null)
    const [customActions, setCustomActions] = useState<CustomAction[]>([])

    useEffect(() => {
        console.log('MenuApp mounted, registering IPC listeners...')

        // Fetch custom actions on mount
        const loadCustomActions = async () => {
            if (window.electronAPI && window.electronAPI.getCustomActions) {
                const result = await window.electronAPI.getCustomActions()
                if (result.success) {
                    setCustomActions(result.actions || [])
                }
            }
        }
        loadCustomActions()

        // Listen for show-menu event from main process
        const handleShowMenu = async (_event: any, data: MenuData) => {
            console.log('Received show-menu event:', data)
            // Reload custom actions when menu is shown (in case they changed)
            await loadCustomActions()
            // Get language and set it for MenuPopup
            if (window.electronAPI) {
                const language = await window.electronAPI.getLanguage()
                i18n.changeLanguage(language)
            }
            setMenuData(data)
        }

        // Register IPC listeners
        if (window.electronAPI) {
            console.log('electronAPI available, registering listeners')
            window.electronAPI.onShowMenu(handleShowMenu)
        } else {
            console.error('electronAPI not available!')
        }
    }, [])

    const handleAction = (action: string) => {
        console.log(`Action clicked: ${action}`)
        if (window.electronAPI) {
            window.electronAPI.sendMenuAction(action, menuData?.text || '')
        }
    }

    return (
        <div style={{ width: '100vw', height: '100vh', background: 'transparent' }}>
            <MenuPopup
                selectedText={menuData?.text || ""}
                onAction={handleAction}
                actions={menuData?.actions}
                customActions={customActions}
            />
        </div>
    )
}

createRoot(document.getElementById('root')!).render(
    <MenuApp />,
)

