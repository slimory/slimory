import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage } from 'electron'
import { createMenuWindow, showMenuWindow, hideMenuWindow, getMenuPopupBoundingRect, getMenuWindowTextInfo, setForegroundWindowFocus, clearMenuWindowTextInfo } from './menuWindow'
import { createChatWindow, showChatWindow, hideChatWindow } from './chatWindow'
import { createMessageWindow, showChatMessageWindow, showMessageWindow, hideMessageWindow, messageWindowWidth } from './messageWindow'
import { createFullChatWindow, showFullChatWindow, hideFullChatWindow, resetPosition } from './fullChatWindow'
import { createOnboardingWindow, showOnboardingWindow, closeOnboardingWindow } from './onboardingWindow'
import { createSettingsWindow, showSettingsWindow, closeSettingsWindow } from './settingsWindow'
import { startTextMonitor, setTextMonitorEnabled, getLastClickInfo } from './textMonitor'
import { uIOhook } from 'uiohook-napi'
import { screen } from 'electron'
import { ChatService, ChatMessage } from '../services/chatService'
import { chatConfig } from '../config/chatConfig'
import { desktopCapturer } from 'electron'
import { ConversationStorage, StoredMessage } from '../services/conversationStorage'
import { SettingsStorage } from '../services/settingsStorage'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { existsSync } from 'fs'
import { shell } from 'electron'
import { t, setLanguage } from './i18n'
import { getScriptStorageForWindow } from '../tools/webPilot/browserPool'
import { updateSelectedTextByCSharp } from './utils'

let tray: Tray | null = null

let menuWindow: BrowserWindow | null = null
let chatWindow: BrowserWindow | null = null
let messageWindow: BrowserWindow | null = null
let fullChatWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let isChatShowOnce: boolean = false
let chatService: ChatService
let conversationStorage: ConversationStorage
let settingsStorage: SettingsStorage
let hasSettings: boolean = false
let menuDirection: string = 'bottom'
let textMonitorDisabledBySnippingTool: boolean = false // Track if text monitor was disabled by Shift+Win+S

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (process.platform === 'win32') {
    app.setAppUserModelId(app.getName())
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
if (!isDev) {
    console.log = function() {}
}

type StreamingState = {
    shouldStop: boolean
    assistantContent: string
    conversationId: string | null
    resources?: Array<{ index: number; url: string; title?: string; source?: string }> // 添加 resources 字段
    generatedMessages?: Array<{ role: 'assistant' | 'user' | 'system' | 'tool'; content: string; tool_calls?: any[]; tool_call_id?: string }> // 添加 generatedMessages 字段
}

const streamingStates = new Map<string, StreamingState>()

// Disable GPU acceleration for better compatibility
app.disableHardwareAcceleration()

app.commandLine.appendSwitch('wm-window-animations-disabled')

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    console.log('Another instance is already running, exiting...')
    app.quit()
} else {
    app.on('second-instance', () => {
        console.log('Second instance attempted, focusing existing windows...')
        if (fullChatWindow && !fullChatWindow.isDestroyed()) {
            if (fullChatWindow.isMinimized()) {
                fullChatWindow.restore()
            }
            showFullChatWindowInCenter()
        } else if (menuWindow && !menuWindow.isDestroyed()) {
            if (menuWindow.isMinimized()) {
                menuWindow.restore()
            }
            menuWindow.focus()
        } else {
            showFullChatWindowInCenter()
        }
    })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
    // Initialize settings storage
    settingsStorage = new SettingsStorage()
    
    // Load settings and initialize chat service
    const savedSettings = settingsStorage.loadSettings()
    
    const initialConfig = savedSettings ? {
        baseUrl: savedSettings.baseUrl,
        apiKey: savedSettings.apiKey,
        model: savedSettings.model
    } : chatConfig
    
    // Initialize chat service
    chatService = new ChatService(initialConfig)
    
    // Initialize conversation storage
    conversationStorage = new ConversationStorage()

    // Check if this is first launch (no settings)
    hasSettings = savedSettings !== null && savedSettings.apiKey.trim() !== ''
    
    if (!hasSettings) {
        // First launch - show onboarding window
        setTimeout(() => {
            onboardingWindow = createOnboardingWindow()
            showOnboardingWindow(onboardingWindow)
        }, 300)
    }

    setTimeout(() => {
        menuWindow = createMenuWindow(getCurrentLanguage())
        chatWindow = createChatWindow()
        messageWindow = createMessageWindow()
        fullChatWindow = createFullChatWindow()
        if (hasSettings) {
            fullChatWindow.once('ready-to-show', () => {
                setTimeout(() => {
                    showFullChatWindowInCenter()
                }, 1500)
            })
        }
    }, 500);

    setTimeout(() => {
        createTray()
    }, 1000)

    const uiohook = uIOhook as any
    try {
        uiohook.start()
        console.log('✅ uIOhook started successfully')
    } catch (error) {
        console.log('⚠️ uIOhook already running (normal in dev mode)')
    }

    // Start monitoring 
    // selection
    startTextMonitor(
        async (selectedText: string, downX: number, downY: number, upX: number, upY: number) => {
            if (menuWindow && selectedText) {
                console.log('show menu window')
                menuDirection = await showMenuWindow(menuWindow, selectedText, downX, downY, upX, upY, getCurrentLanguage())
            }
        },
        () => {
            // Get disabled apps callback - return only names for textMonitor compatibility
            const disabledApps = settingsStorage.getDisabledApps()
            return disabledApps.map(app => app.name)
        },
        (app: string, displayName?: string) => {
            // Add available app callback
            settingsStorage.addAvailableApp(app, displayName)
        }
    )
    
    // Load word selection setting and apply it
    if (savedSettings) {
        setTextMonitorEnabled(savedSettings.wordSelectionEnabled !== false)
    }

    uiohook.on('mousedown', handleMouseDown)
    uiohook.on('keydown', handleKeyDown)
    uiohook.on('mouseup', handleMouseUp)

    // Register global shortcut for Ctrl+Space
    globalShortcut.register('CommandOrControl+Space', () => {
        console.log('🎯 Ctrl + Space - showing full chat window')
        showFullChatWindowInCenter()
    })

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open
        if (BrowserWindow.getAllWindows().length === 0) {
            menuWindow = createMenuWindow(getCurrentLanguage())
        }
    })
})

function getCurrentLanguage(): string {
    const settings = settingsStorage.loadSettings()
    return settings?.language || 'zh'
}

/**
 * Get language name in English from language code
 */
function getLanguageName(langCode: string): string {
    const languageMap: Record<string, string> = {
        'zh': 'Chinese',
        'en': 'English',
        'es': 'Spanish',
        'ja': 'Japanese',
        'de': 'German',
        'fr': 'French',
        'pt': 'Portuguese',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'bn': 'Bengali'
    }
    return languageMap[langCode] || 'English'
}

// Update tray menu with current language
const updateTrayMenu = () => {
    if (!tray) return
    
    const currentLanguage = getCurrentLanguage()
    setLanguage(currentLanguage)
    
    if (!hasSettings) {
        const contextMenu = Menu.buildFromTemplate([
            {
                label: t('tray.quit'),
                click: () => {
                    app.quit()
                }
            }
        ])
        tray.setContextMenu(contextMenu)
        return
    }
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: t('tray.chat'),
            sublabel: "Ctrl+Space",
            click: () => {
                showFullChatWindowInCenter()
            }
        },
        {
            label: t('tray.settings'),
            click: () => {
                showSettingsWindowInCenter()
            }
        },
        {
            label: t('tray.quit'),
            click: () => {
                app.quit()
            }
        }
    ])
    
    tray.setContextMenu(contextMenu)
}

const createTray = () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    
    let iconPath: string = ""
    let icon: Electron.NativeImage = nativeImage.createEmpty()
    
    if (app.isPackaged) {
        const possiblePaths = [
            path.join(process.resourcesPath, 'build', 'icon.ico'),
            path.join(process.resourcesPath, 'icon.ico'),
            path.join(app.getAppPath(), 'build', 'icon.ico'),
            path.join(app.getAppPath(), 'icon.ico'),
            path.join(path.dirname(process.execPath), 'resources', 'build', 'icon.ico'),
            path.join(path.dirname(process.execPath), 'resources', 'icon.ico'),
        ]
        
        for (const tryPath of possiblePaths) {
            if (existsSync(tryPath)) {
                iconPath = tryPath
                console.log('✅ Found tray icon at:', iconPath)
                break
            }
        }
        
        if (!iconPath) {
            console.warn('⚠️ Tray icon not found, trying app icon')
            const appIconPath = path.join(
                path.dirname(process.execPath),
                'resources',
                'app.ico'
            )
            if (existsSync(appIconPath)) {
                iconPath = appIconPath
            }
        }
    } else {
        iconPath = path.join(__dirname, '../../build/icon.ico')
    }
    
    try {
        if (iconPath && existsSync(iconPath)) {
            icon = nativeImage.createFromPath(iconPath)
            
            if (icon.isEmpty()) {
                console.error('❌ Icon file is empty or invalid:', iconPath)
            } else {
                console.log('✅ Tray icon loaded successfully')
            }
        } else {
            console.warn('⚠️ Icon path not found:', iconPath)
        }
    } catch (error) {
        console.error('❌ Error loading tray icon:', error)
    }
    
    const iconSize = process.platform === 'win32' ? 16 : 22
    const resizedIcon = icon.resize({ width: iconSize, height: iconSize })
    
    if (process.platform === 'win32') {
        resizedIcon.setTemplateImage(false)
    }
    
    tray = new Tray(resizedIcon)
    
    tray.setToolTip('Slimory')

    updateTrayMenu()
    
    tray.on('click', () => {
        if (fullChatWindow && !fullChatWindow.isDestroyed()) {
            if (fullChatWindow.isVisible()) {
                fullChatWindow.hide()
            } else {
                showFullChatWindowInCenter()
            }
        }
    })
}

let isSettingsWindowMoving = false
// Function to show full chat window
const showSettingsWindowInCenter = () => {
    if (!settingsWindow || settingsWindow.isDestroyed()) {
        settingsWindow = createSettingsWindow()

        settingsWindow.on('moved', () => {
            isSettingsWindowMoving = false
            // Notify fullChatWindow that settings window has finished moving
            if (fullChatWindow && !fullChatWindow.isDestroyed()) {
                fullChatWindow.webContents.send('window-move-status', 'settings', 'end')
            }
        })
        
        settingsWindow.on('move', () => {
            // Notify fullChatWindow that settings window is starting to move
            if (fullChatWindow && !fullChatWindow.isDestroyed() && !isSettingsWindowMoving) {
                console.log('hello')
                isSettingsWindowMoving = true
                fullChatWindow.webContents.send('window-move-status', 'settings','start')
            }
        })
    }
    showSettingsWindow(settingsWindow)
}

const showFullChatWindowInCenter = async () => {
    if (!hasSettings) return
    if (onboardingWindow && onboardingWindow.isVisible()) return
    if (!fullChatWindow || fullChatWindow.isDestroyed()) {
		fullChatWindow = createFullChatWindow()
	}
	if (fullChatWindow.isVisible()) {
        if (fullChatWindow.isFocused()) {
            // hideFullChatWindow(fullChatWindow)
            fullChatWindow.webContents.send("hide-full-chat-window")
        } else {
            showFullChatWindow(fullChatWindow)
            fullChatWindow.webContents.send('full-chat-window-shown')
        }
		return
	}
    
    resetPosition(fullChatWindow)
    showFullChatWindow(fullChatWindow)
    fullChatWindow.webContents.send('full-chat-window-shown')
}

const handleKeyDown = async (event: any) => {
    // console.log('handleKeyDown', event)
    // Detect Shift + Win + S (Windows Snipping Tool shortcut)
    // In uiohook, Windows key is represented as metaKey
    // S key keycode is typically 31 (lowercase) or 83 (uppercase)
    const isShift = event.shiftKey === true
    const isWin = event.metaKey === true || (event as any).super === true
    const isS = event.keycode === 31 || event.keycode === 83
    
    if (isShift && isWin && isS) {
        console.log('🎯 Shift + Win + S detected - disabling text monitor')
        textMonitorDisabledBySnippingTool = true
        setTextMonitorEnabled(false)
    }
    
    if (!event.ctrlKey && (menuWindow && menuWindow.isVisible())) {
        hideMenuWindow(menuWindow, getCurrentLanguage())
    }

    if (event.keycode === 1 && textMonitorDisabledBySnippingTool) {
        resetTextMonitor()
    }
}

const resetTextMonitor = () => {
    textMonitorDisabledBySnippingTool = false
    // Get current settings to restore the original enabled state
    const savedSettings = settingsStorage.loadSettings()
    const shouldBeEnabled = savedSettings?.wordSelectionEnabled !== false
    setTextMonitorEnabled(shouldBeEnabled)
}

const handleMouseUp = async (_event: any) => {
    if (textMonitorDisabledBySnippingTool) {
        resetTextMonitor()
    }
}

const handleMouseDown = async (event: any) => {
    try {
        
        const clickX = event.x
        const clickY = event.y

        const display = screen.getDisplayNearestPoint({ x: clickX, y: clickY })
        const scaleFactor = display.scaleFactor

        // console.log('current click position:', { clickX, clickY })

        // Check menu window
        if (menuWindow && menuWindow.isVisible()) {
            const menuBounds = menuWindow.getBounds()
            const menuPopupSize = await getMenuPopupBoundingRect(menuWindow)
            if (menuPopupSize) {
                menuBounds.width = menuPopupSize.width
                menuBounds.height = menuPopupSize.height
                menuBounds.y = menuBounds.y + menuPopupSize.y
                menuBounds.x = menuBounds.x + menuPopupSize.x
            }
            const menuScaledBounds = {
                x: menuBounds.x * scaleFactor,
                y: menuBounds.y * scaleFactor,
                width: menuBounds.width * scaleFactor,
                height: menuBounds.height * scaleFactor
            }

            const isOutsideMenu =
                clickX < menuScaledBounds.x ||
                clickX > menuScaledBounds.x + menuScaledBounds.width ||
                clickY < menuScaledBounds.y ||
                clickY > menuScaledBounds.y + menuScaledBounds.height

            if (isOutsideMenu) {
                console.log('🖱️ Click detected outside menu window at:', { clickX, clickY })
                hideMenuWindow(menuWindow, getCurrentLanguage())
            } else {
                console.log('🖱️ Click detected inside menu window')
                return // Don't check other windows if clicking inside menu
            }
        }

        if (chatWindow && chatWindow.isVisible()) {
            const chatBounds = chatWindow.getBounds()
            const chatScaledBounds = {
                x: chatBounds.x * scaleFactor,
                y: chatBounds.y * scaleFactor,
                width: chatBounds.width * scaleFactor,
                height: chatBounds.height * scaleFactor
            }

            const isOutsideChat =
                clickX < chatScaledBounds.x ||
                clickX > chatScaledBounds.x + chatScaledBounds.width ||
                clickY < chatScaledBounds.y ||
                clickY > chatScaledBounds.y + chatScaledBounds.height

            if (isOutsideChat) {
                console.log('🖱️ Click detected outside chat window at:', { clickX, clickY })

                // Check if message window is also visible
                if (messageWindow && messageWindow.isVisible()) {
                    const messageBounds = messageWindow.getBounds()
                    const messageScaledBounds = {
                        x: messageBounds.x * scaleFactor,
                        y: messageBounds.y * scaleFactor,
                        width: messageBounds.width * scaleFactor,
                        height: messageBounds.height * scaleFactor
                    }

                    const isOutsideMessage =
                        clickX < messageScaledBounds.x ||
                        clickX > messageScaledBounds.x + messageScaledBounds.width ||
                        clickY < messageScaledBounds.y ||
                        clickY > messageScaledBounds.y + messageScaledBounds.height

                    if (isOutsideMessage) {
                        console.log('🖱️ Click detected outside both chat and message windows')
                        messageWindow.webContents.send('hide-message')
                        setTimeout(() => {
                            if (chatWindow && !chatWindow.isDestroyed()) {
                                hideChatWindow(chatWindow)
                            }
                            if (messageWindow && !messageWindow.isDestroyed()) {
                                hideMessageWindow(messageWindow)
                            }
                        }, 50)
                    } else {
                        console.log('🖱️ Click detected inside message window')
                        setTimeout(() => {
                            if (messageWindow && !messageWindow.isFocused()) {
                                console.log('message window is not focused')
                                messageWindow.webContents.send('hide-message')
                                setTimeout(() => {
                                    if (chatWindow && !chatWindow.isDestroyed()) {
                                        hideChatWindow(chatWindow)
                                    }
                                    if (messageWindow && !messageWindow.isDestroyed()) {
                                        hideMessageWindow(messageWindow)
                                    }
                                }, 100)
                            }
                        }, 100)
                        return // Don't hide chat window if clicking inside message window
                    }
                } else {
                    // Only chat window is visible, hide it
                    hideChatWindow(chatWindow)
                }
            } else {
                console.log('🖱️ Click detected inside chat window')
                return // Don't check message window if clicking inside chat window
            }
        } else if (messageWindow && messageWindow.isVisible()) {
            const messageBounds = messageWindow.getBounds()
            const messageScaledBounds = {
                x: messageBounds.x * scaleFactor,
                y: messageBounds.y * scaleFactor,
                width: messageBounds.width * scaleFactor,
                height: messageBounds.height * scaleFactor
            }

            const isOutsideMessage =
                clickX < messageScaledBounds.x ||
                clickX > messageScaledBounds.x + messageScaledBounds.width ||
                clickY < messageScaledBounds.y ||
                clickY > messageScaledBounds.y + messageScaledBounds.height

            if (isOutsideMessage) {
                console.log('🖱️ Click detected outside message window at:', { clickX, clickY })
                messageWindow.webContents.send('hide-message')
                setTimeout(() => {
                    if (messageWindow && !messageWindow.isDestroyed()) {
                        hideMessageWindow(messageWindow)
                    }
                }, 100)
            } else {
                console.log('🖱️ Click detected inside message window')
                setTimeout(() => {
                    if (messageWindow && !messageWindow.isFocused()) {
                        console.log('message window is not focused')
                        messageWindow.webContents.send('hide-message')
                        setTimeout(() => {
                            if (messageWindow && !messageWindow.isDestroyed()) {
                                hideMessageWindow(messageWindow)
                            }
                        }, 50)
                    }
                }, 100)
                return // Don't check other windows if clicking inside message window
            }
        }
    } catch (error) {
        console.error('❌ Error in mouse handler:', error)
    }
}

// Export for cleanup on app quit
export function cleanupMouseHook(): void {
    try {
        uIOhook.removeAllListeners()
        uIOhook.stop()
    } catch (error) {
        // Ignore errors during cleanup
    }
}

// Clean up before app quits
app.on('before-quit', () => {
    console.log('🛑 App quitting, stopping all monitors')
    cleanupMouseHook()
    
    // Unregister all global shortcuts
    globalShortcut.unregisterAll()
    console.log('✅ All global shortcuts unregistered')
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('will-quit', () => {
    cleanupMouseHook()
})

// IPC handlers
ipcMain.on('hide-menu', () => {
    console.log('Hiding menu window')
    if (menuWindow) {
        hideMenuWindow(menuWindow, getCurrentLanguage())
    }
})

ipcMain.on('menu-action', async (_event, data: { action: string; text: string }) => {
    console.log(`Menu action: ${data.action} for text: ${data.text}`)
    
    if (data.action === 'ask') {
        // Open chat window for QA action
        // Create chat window if it doesn't exist
        if (!chatWindow || chatWindow.isDestroyed()) {
            chatWindow = createChatWindow()
        }

        // Get menu window position to position chat window nearby
        if (menuWindow) {
            const menuBounds = menuWindow.getBounds()
            const x = menuBounds.x
            const y = menuBounds.y
            console.log('menuBounds', menuBounds)

            if (isChatShowOnce) {
                showChatWindow(chatWindow, data.text, x, y, false, data.action)
            } else {
                setTimeout(() => {
                    if (chatWindow) {
                        showChatWindow(chatWindow, data.text, x, y, false, data.action)
                    }
                }, 100)
                isChatShowOnce = true
            }
            hideMenuWindow(menuWindow, getCurrentLanguage())
        }
    } else if (data.action === 'translate') {
        // Open message window in translation mode
        if (messageWindow && menuWindow) {
            // Create message window if it doesn't exist
            if (!messageWindow || messageWindow.isDestroyed()) {
                messageWindow = createMessageWindow()
            }
            const menuBounds = menuWindow.getBounds()
            const messageData = [{
                role: 'user' as const,
                content: `${data.text}`
            }]
            const direction = showMessageWindow(messageWindow, menuBounds, menuDirection)
            messageWindow.webContents.send('show-message', messageData, data.text, true, 'translate', direction)
        }
    } else if (data.action === 'explain') {
        if (messageWindow && menuWindow) {
            // Create message window if it doesn't exist
            if (!messageWindow || messageWindow.isDestroyed()) {
                messageWindow = createMessageWindow()
            }
            const menuBounds = menuWindow.getBounds()
            const messageData = [{
                role: 'user' as const,
                content: `${data.text}`
            }]
            const direction = showMessageWindow(messageWindow, menuBounds, menuDirection)
            messageWindow.webContents.send('show-message', messageData, data.text, true, 'explain', direction)
        }
    } else if (data.action === 'modify') {
        // Open chat window for modify action
        // Create chat window if it doesn't exist
        if (!chatWindow || chatWindow.isDestroyed()) {
            chatWindow = createChatWindow()
        }

        // Get menu window position to position chat window nearby
        if (menuWindow) {
            const menuBounds = menuWindow.getBounds()
            const x = menuBounds.x
            const y = menuBounds.y
            console.log('menuBounds', menuBounds)

            if (isChatShowOnce) {
                showChatWindow(chatWindow, data.text, x, y, false, data.action)
            } else {
                setTimeout(() => {
                    if (chatWindow) {
                        showChatWindow(chatWindow, data.text, x, y, false, data.action)
                    }
                }, 100)
                isChatShowOnce = true
            }
            hideMenuWindow(menuWindow, getCurrentLanguage())
        }
    }
    
    // Hide the menu after action
    if (menuWindow && data.action !== 'modify' && data.action !== 'qa') {
        hideMenuWindow(menuWindow, getCurrentLanguage())
    }
})

ipcMain.on('open-chat-window', (_event, selectedText: string) => {
    console.log('Opening chat window with text:', selectedText)

    // Create chat window if it doesn't exist
    if (!chatWindow || chatWindow.isDestroyed()) {
        chatWindow = createChatWindow()
    }

    // Get menu window position to position chat window nearby
    if (menuWindow) {
        const menuBounds = menuWindow.getBounds()
        const x = menuBounds.x
        const y = menuBounds.y
        console.log('menuBounds', menuBounds)

        if (isChatShowOnce) {
            showChatWindow(chatWindow, selectedText, x, y, false, 'ask')
        } else {
            setTimeout(() => {
                if (chatWindow) {
                    showChatWindow(chatWindow, selectedText, x, y, false, 'ask')
                }
            }, 100)
            isChatShowOnce = true
        }
        hideMenuWindow(menuWindow, getCurrentLanguage())
    }
})

ipcMain.on('close-chat-window', () => {
    console.log('Closing chat window')
    if (chatWindow && !chatWindow.isDestroyed()) {
        hideChatWindow(chatWindow)
    }
})

ipcMain.on('close-full-chat-window', () => {
    console.log('Closing full chat window')
    if (fullChatWindow && !fullChatWindow.isDestroyed()) {
        hideFullChatWindow(fullChatWindow)
    }
})

ipcMain.on('minimize-full-chat-window', () => {
    console.log('Minimizing full chat window')
    if (fullChatWindow && !fullChatWindow.isDestroyed()) {
        fullChatWindow.minimize()
    }
})

// Helper function to get window by name
function getWindowByName(windowName: string): BrowserWindow | null {
    switch (windowName) {
        case 'full-chat':
            return fullChatWindow
        case 'menu':
            return menuWindow
        case 'chat':
            return chatWindow
        case 'message':
            return messageWindow
        case 'settings':
            return settingsWindow
        case 'onboarding':
            return onboardingWindow
        default:
            return null
    }
}

// Generic IPC handler for setting window ignore mouse events
ipcMain.on('set-window-ignore-mouse', (_event, windowName: string, ignore: boolean, forward: boolean = false) => {
    const window = getWindowByName(windowName)
    if (window && !window.isDestroyed()) {
        window.setIgnoreMouseEvents(ignore, { forward })
    }
})

// Keep the old IPC handler for backward compatibility
ipcMain.on('set-full-chat-window-ignore-mouse', (_event, ignore: boolean, forward: boolean = false) => {
    if (fullChatWindow && !fullChatWindow.isDestroyed()) {
        fullChatWindow.setIgnoreMouseEvents(ignore, { forward })
    }
})

ipcMain.on('close-message-window', () => {
    console.log('Closing message window')
    if (messageWindow && !messageWindow.isDestroyed()) {
        hideMessageWindow(messageWindow)
    }
})

ipcMain.on('close-onboarding-window', () => {
    console.log('Closing onboarding window')
    if (onboardingWindow && !onboardingWindow.isDestroyed()) {
        closeOnboardingWindow(onboardingWindow)
        onboardingWindow = null
        if (hasSettings) {
            showFullChatWindowInCenter()
        }
    }
})

ipcMain.on('quit-app', () => {
    console.log('Quitting app')
    app.quit()
})

ipcMain.on('close-settings-window', () => {
    console.log('Closing settings window')
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        closeSettingsWindow(settingsWindow)
        settingsWindow.destroy()
        settingsWindow = null
    }
})

ipcMain.on('close-webpilot-window', (event) => {
    console.log('Closing webPilot window')
    // Find the window that sent this event
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window && !window.isDestroyed()) {
        window.close()
    }
})

ipcMain.handle('remove-script-association', async (_event, cleanUrl: string) => {
    try {
        const scriptStorage = getScriptStorageForWindow()
        const success = scriptStorage.removeCleanUrlAssociation(cleanUrl)
        return { success }
    } catch (error) {
        console.error('Error removing script association:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
})

ipcMain.handle('save-script', async (_event, cleanUrl: string, script: string, scriptName: string) => {
    try {
        const scriptStorage = getScriptStorageForWindow()
        const matchedScript = scriptStorage.findMatchingScript(cleanUrl)
        const matchedCleanUrl = matchedScript ? matchedScript.cleanUrl : cleanUrl
        const success = scriptStorage.saveScript(matchedCleanUrl, script, scriptName)
        return { success }
    } catch (error) {
        console.error('Error saving script:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
})

ipcMain.handle('delete-script-by-id', async (_event, scriptId: string) => {
    try {
        const scriptStorage = getScriptStorageForWindow()
        const success = scriptStorage.deleteScriptById(scriptId)
        return { success }
    } catch (error) {
        console.error('Error deleting script by ID:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
})

ipcMain.on('adjust-message-window-position', (_event, xOffset, _command) => {
    
    // Validate xOffset is a number
    if (typeof xOffset !== 'number' || isNaN(xOffset)) {
        console.error('Invalid xOffset value:', xOffset)
        return
    }
    
    if (messageWindow && !messageWindow.isDestroyed()) {
        const currentBounds = messageWindow.getBounds()
        const display = screen.getPrimaryDisplay()
        let newX = currentBounds.x
        newX = display.workAreaSize.width - messageWindowWidth - 10
        messageWindow.setPosition(newX, currentBounds.y, false)
    }
})

ipcMain.on('open-message-window', (_event, messageData: { role: 'user' | 'assistant'; content: string }[], selectedText: string, command: string) => {
    console.log('Opening message window with data:', messageData, selectedText, 'command:', command)

    // Create message window if it doesn't exist
    if (!messageWindow || messageWindow.isDestroyed()) {
        messageWindow = createMessageWindow()
    }
    if (command === 'ask') {
        if (chatWindow && messageWindow) {
            if (messageWindow.isVisible()) {
                messageWindow.webContents.send('show-message', messageData, selectedText, false, command, menuDirection)
            } else {
                let direction = showChatMessageWindow(messageWindow, chatWindow, menuDirection)
                messageWindow.webContents.send('show-message', messageData, selectedText, true, command, direction)
            }
        }
    } else if (command === 'modify') {
        if (chatWindow) {
            const bounds = chatWindow.getBounds()
            let direction = showMessageWindow(messageWindow, bounds, menuDirection)
            hideChatWindow(chatWindow)
            messageWindow.webContents.send('show-message', messageData, selectedText, true, command, direction)
        }
    }
})

// Handle chat response complete - forward to ChatPanel
ipcMain.on('chat-response-complete', (_event, message: { role: 'user' | 'assistant'; content: string }) => {
    console.log('Chat response complete, forwarding to ChatPanel:', message)
    
    // Send the assistant message to ChatPanel
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('chat-response-complete', message)
    }
})

ipcMain.handle('stop-chat-response', async (_event, conversationId: string = 'default') => {
    console.log('Stop chat response requested for conversation:', conversationId)
    const streamingState = streamingStates.get(conversationId)
    if (streamingState) {
        streamingState.shouldStop = true
        
        // Save current assistant message if there's content
        if (streamingState.assistantContent.trim() && streamingState.conversationId) {
            try {
                const assistantMessage = {
                    role: 'assistant' as const,
                    content: streamingState.assistantContent.trim() + '[!Streaming stopped by user!]'
                }
                const storedMessage = {
                    role: assistantMessage.role,
                    content: assistantMessage.content,
                    timestamp: Date.now(),
                    resources: streamingState.resources // 添加 resources
                }
                conversationStorage.saveMessage(storedMessage, streamingState.conversationId)
                console.log('Saved stopped assistant message to conversation:', streamingState.conversationId)
            } catch (error) {
                console.error('Error saving stopped assistant message:', error)
            }
        }
        
        return { success: true }
    }
    return { success: false, error: 'No active streaming response' }
})

// Chat service IPC handler
ipcMain.handle('generate-chat-response', async (_event, selectedText: string, messages: { role: 'user' | 'assistant'; content: string; originalMessages?: ChatMessage[] }[], command: string, conversationId: string = 'default') => {
    console.log('Generating chat response for:', { selectedText, command, conversationId })
    try {
        let streamingResponse: AsyncGenerator<any, void, unknown> | undefined = undefined
        let assistantContent = ''
        let allResources: Array<{ index: number; url: string; title?: string; source?: string }> = [] // 收集 resources
        const currentLang = getCurrentLanguage()
        const currentLanguageName = getLanguageName(currentLang)

        let textInfo: { fullText?: string; selectedText?: string; selectionStart?: number; selectionEnd?: number } | null = null    
        if (menuWindow && !menuWindow.isDestroyed()) {
            textInfo = getMenuWindowTextInfo()
            if (textInfo) {
                console.log('Saved text info:', textInfo)
            }
        }

        if (command == 'translate') {
            const lastMessage = messages[messages.length - 1]
            const translationMessages = [
                {
                    role: 'user' as const,
                    content: lastMessage.content
                }
            ]
            
            streamingResponse = chatService.generateStreamingResponse(
                translationMessages,
                'translate',
                {
                    selectedText: selectedText,
                    targetLanguage: currentLanguageName
                },
                false
            )
        } else if (command == 'ask') {
            streamingResponse = chatService.generateStreamingResponse(
                messages,
                'ask',
                {
                    selectedText: selectedText,
                    fullText: textInfo?.fullText,
                    currentLanguage: currentLanguageName
                },
                false
            )
        } else if (command == 'modify') {
            streamingResponse = chatService.generateStreamingResponse(
                messages,
                'modify',
                {
                    selectedText: selectedText,
                    fullText: textInfo?.fullText,
                    userRequirements: messages[messages.length - 1].content
                },
                false
            )
        } else if (command == 'explain') {
            streamingResponse = chatService.generateStreamingResponse(
                messages,
                'explain',
                {
                    selectedText: selectedText,
                    fullText: textInfo?.fullText,
                    currentLanguage: currentLanguageName
                },
                false
            )
        } else if (command == 'chat') {
            // Initialize streaming state for this conversation
            const streamingState: StreamingState = {
                shouldStop: false,
                assistantContent: '',
                conversationId: conversationId || null
            }
            streamingStates.set(conversationId, streamingState)
            // Use agent mode with tools
            console.log('Using agent mode with tools')
            streamingResponse = chatService.answerUserQuestionWithTools(
                messages,
                currentLang,
                currentLanguageName,
                conversationId,
                // onStatusUpdate callback
                (_messageId: string, toolName: string, status: 'start' | 'processing' | 'end', message: string) => {
                    const state = streamingStates.get(conversationId)
                    if (state?.shouldStop) {
                        console.log('Streaming stopped by user request')
                        return true
                    }
                    const toolStatusChunk = `\n<[${toolName}] ${status}>${message}</[${toolName}] ${status}>`
                    assistantContent += toolStatusChunk

                    if (fullChatWindow && !fullChatWindow.isDestroyed() && fullChatWindow.isVisible()) {
                        fullChatWindow.webContents.send('chat-response-chunk', { content: assistantContent, done: false, conversationId: conversationId })
                    }
                    return false
                },
                // onComplete callback - store generated messages for saving after streaming completes
                (generatedMessages) => {
                    // Store generated messages in streamingState for saving after streaming completes
                    const state = streamingStates.get(conversationId)
                    if (state) {
                        state.generatedMessages = generatedMessages
                    }
                }
            )
        }
        
        // Collect assistant message content as chunks arrive
        assistantContent = ''
        
        if (streamingResponse) {
            // Send chunks as they arrive
            for await (const chunk of streamingResponse) {
                // Check if stop was requested for this conversation
                const streamingState = streamingStates.get(conversationId)
                if (streamingState?.shouldStop) {
                    console.log('Streaming stopped by user request')
                    streamingStates.delete(conversationId)
                    break
                }
                
                if (chunk.resources && Array.isArray(chunk.resources)) {
                    chunk.resources.forEach((resource: { index: number; url: string; title?: string; source?: string }) => {
                        if (!allResources.find(r => r.index === resource.index && r.url === resource.url)) {
                            allResources.push(resource)
                        }
                    })
                }
                
                // Collect content for saving later
                if (chunk.content) {
                    assistantContent += chunk.content
                    if (streamingState) {
                        streamingState.assistantContent = assistantContent
                    }
                }
                
                if (command == 'chat' && streamingState && fullChatWindow && !fullChatWindow.isDestroyed() && fullChatWindow.isVisible()) {
                    fullChatWindow.webContents.send('chat-response-chunk', { 
                        ...chunk,
                        done: false,
                        content: assistantContent,
                        resources: allResources.length > 0 ? allResources : undefined,
                        originalMessages: streamingState.generatedMessages,
                        conversationId: conversationId
                    })
                } else if ((command == 'translate' || command == 'explain' || command == 'ask' || command == 'modify') && 
                    messageWindow && !messageWindow.isDestroyed() && messageWindow.isVisible()) {
                    messageWindow.webContents.send('chat-response-chunk', chunk)
                }
            }
        }
        
        const streamingState = streamingStates.get(conversationId)
        // Update selected text for 'modify' command after streaming completes
        if (command === 'modify' && assistantContent) {
            try {
                setForegroundWindowFocus()
                if (selectedText.endsWith('\r') && !assistantContent.endsWith('\r')) {
                    assistantContent += '\r'
                }
                // Update the selected text with the modified version
                const clickInfo = getLastClickInfo()
                console.log('clickInfo', clickInfo)
                const direction = (clickInfo.mouseDownX < clickInfo.mouseUpX || clickInfo.mouseDownY < clickInfo.mouseUpY) ? 'toEnd' : 'toStart'
                console.log('direction', direction)
                await updateSelectedTextByCSharp(selectedText, assistantContent, direction)
                if (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible()) {
                    chatWindow.webContents.send('chat-response-complete', {
                        role: 'assistant' as const,
                        content: assistantContent
                    })
                }
                if (messageWindow && !messageWindow.isDestroyed()) {
                    messageWindow.webContents.send('hide-message')
                    setTimeout(() => {
                        if (messageWindow && !messageWindow.isDestroyed()) {
                            hideMessageWindow(messageWindow)
                        }
                    }, 100)
                }
                // updateSelectedTextByKoffi(assistantContent)
                clearMenuWindowTextInfo()
                console.log('Updated selected text with modified version')
            } catch (error) {
                console.error('Error updating selected text:', error)
            }
        }
        else if (command === 'ask' && assistantContent) {
            if (chatWindow && !chatWindow.isDestroyed()) {
                console.log('sending chat-response-complete to chatWindow')
                chatWindow.webContents.send('chat-response-complete', {
                    role: 'assistant' as const,
                    content: assistantContent
                })
            }
        }
        // Save generated messages for 'chat' command (agent mode)
        else if (command === 'chat' && streamingState && !streamingState.shouldStop && streamingState.generatedMessages && conversationId) {
            try {
                const storedMessage = {
                    role: 'assistant' as const,
                    content: assistantContent.trim(),
                    timestamp: Date.now(),
                    resources: allResources.length > 0 ? allResources : undefined,
                    originalMessages: streamingState.generatedMessages
                }
                conversationStorage.saveMessage(storedMessage, conversationId)
                if (fullChatWindow && !fullChatWindow.isDestroyed() && fullChatWindow.isVisible()) {
                    console.log('Sending chat-response-chunk to fullChatWindow')
                    fullChatWindow.webContents.send('chat-response-chunk', {
                        done: true,
                        finishReason: 'stop',
                        resources: allResources.length > 0 ? allResources : undefined,
                        originalMessages: streamingState.generatedMessages,
                        conversationId: conversationId
                    })
                }
            } catch (error) {
                console.error('Error saving generated messages:', error)
            } finally {
                // Clear streaming state for this conversation
                streamingStates.delete(conversationId)
            }
        }
        
        return { success: true }
    } catch (error) {
        console.error('Error generating chat response:', error)
        // Clear streaming state for this conversation on error
        streamingStates.delete(conversationId)
        if (fullChatWindow && !fullChatWindow.isDestroyed() && fullChatWindow.isVisible()) {
            fullChatWindow.webContents.send('chat-response-error', error instanceof Error ? error.message : String(error))
        }
        if (messageWindow && !messageWindow.isDestroyed()) {
            messageWindow.webContents.send('chat-response-error', error instanceof Error ? error.message : String(error))
        }
        throw error
    }
})

ipcMain.handle('capture-desktop-screenshot', async (_event) => {
	try {
        if (!fullChatWindow || fullChatWindow.isDestroyed()) {
            return { success: false, error: 'Full chat window not found' }
        }
        
        // Find the display for the given bounds (DIP)
        const bounds = fullChatWindow.getBounds() // DIP
		const display = screen.getDisplayMatching(bounds)
        
        // Request thumbnail at native (physical) resolution
        // Limit thumbnail size to prevent errors (max 4096x4096 for safety)
        const maxThumbnailSize = 4096
        const targetWidth = Math.min(
            Math.round(display.size.width * display.scaleFactor),
            maxThumbnailSize
        )
        const targetHeight = Math.min(
            Math.round(display.size.height * display.scaleFactor),
            maxThumbnailSize
        )

        // Validate values
        if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight) || 
            targetWidth <= 0 || targetHeight <= 0) {
            return { success: false, error: `Invalid display dimensions: ${targetWidth}x${targetHeight}` }
        }

        console.log('targetWidth', targetWidth, 'targetHeight', targetHeight)

        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: targetWidth, height: targetHeight }
        })

        // Match by display_id
        const displayId = String(display.id)
        const source =
            sources.find(s => s.display_id === displayId) ||
            // Fallback to primary if not matched
            sources.find(s => s.id.toLowerCase().includes('screen'))

        if (!source) {
            return { success: false, error: 'No matching screen source found' }
        }

        const fullThumb = source.thumbnail
        const thumbSize = fullThumb.getSize()

        // Compute workArea rect in physical px
        const scale = display.scaleFactor
        const offsetX = 0
        const offsetY = 0
        const cropW = Math.round(display.workArea.width * scale)
        const cropH = Math.round(display.workArea.height * scale)

        console.log('cropW', cropW, 'cropH', cropH, 'thumbSize', thumbSize)

        // Validate crop parameters
        const cropX = Math.max(0, Math.min(offsetX, thumbSize.width - 1))
        const cropY = Math.max(0, Math.min(offsetY, thumbSize.height - 1))
        const cropWidth = Math.max(1, Math.min(
            cropW, 
            thumbSize.width - cropX
        ))
        const cropHeight = Math.max(1, Math.min(
            cropH, 
            thumbSize.height - cropY
        ))

        // Ensure all values are valid integers
        if (!Number.isFinite(cropX) || !Number.isFinite(cropY) ||
            !Number.isFinite(cropWidth) || !Number.isFinite(cropHeight) ||
            cropWidth <= 0 || cropHeight <= 0) {
            return { 
                success: false, 
                error: `Invalid crop parameters: x=${cropX}, y=${cropY}, w=${cropWidth}, h=${cropHeight}` 
            }
        }

        // Crop to workArea only
        const workAreaThumb = fullThumb.crop({
            x: Math.floor(cropX),
            y: Math.floor(cropY),
            width: Math.floor(cropWidth),
            height: Math.floor(cropHeight),
        })

        const { width, height } = workAreaThumb.getSize()
        
        if (width <= 0 || height <= 0) {
            return { success: false, error: `Invalid cropped image size: ${width}x${height}` }
        }
        
        const buf = workAreaThumb.toBitmap() // raw BGRA buffer
        let sum = 0
        for (let i = 0; i < buf.length; i += 4) {
            const b = buf[i]
            const g = buf[i + 1]
            const r = buf[i + 2]
            // Rec. 709 luminance
            const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
            sum += y
        }
        const avgLuma = sum / (width * height) // 0–255 scale
        const brightness = avgLuma / 255      // 0–1

        console.log('brightness', brightness)

        const dataURL = workAreaThumb.toDataURL() // PNG data URL
        
        return {
            success: true,
            screenshot: dataURL,
            screenWidth: cropW,
            screenHeight: cropH,
            scaleFactor: display.scaleFactor,
            brightness: brightness
        }
    } catch (err) {
        console.error('Screenshot capture error:', err)
        return { success: false, error: String(err) }
    }
})

ipcMain.on('screenshot-ready', () => {
	if (fullChatWindow && !fullChatWindow.isDestroyed()) {
		showFullChatWindow(fullChatWindow)
	}
})

ipcMain.handle('get-window-bounds', () => {
	if (fullChatWindow && !fullChatWindow.isDestroyed()) {
		const bounds = fullChatWindow.getBounds() // DIP
		const display = screen.getDisplayMatching(bounds)
		return {
			bounds,
			scaleFactor: display.scaleFactor,
			screenWidth: display.size.width,     // physical px
			screenHeight: display.size.height    // physical px
		}
	}
	return {}
})

// Conversation storage IPC handlers
ipcMain.handle('load-conversation', (_event, conversationId: string = 'default'): { success: boolean; messages: StoredMessage[]; isStreaming?: boolean; error?: string; streamingContent?: string } => {
    try {
        const messages = conversationStorage.loadConversation(conversationId)
        const streamingState = streamingStates.get(conversationId)
        return { success: true, messages: messages, isStreaming: (streamingState && !streamingState.shouldStop) || false, streamingContent: streamingState?.assistantContent || '' }
    } catch (error) {
        console.error('Error loading conversation:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error), messages: [] }
    }
})

ipcMain.handle('save-message', (_event, message: { role: 'user' | 'assistant'; content: string; resources?: Array<{ index: number; url: string; title?: string; source?: string }> }, conversationId: string = 'default') => {
    try {
        console.log('Saving message:', message, 'to conversation:', conversationId)
        const storedMessage = {
            role: message.role,
            content: message.content,
            timestamp: Date.now(),
            resources: message.resources
        }
        conversationStorage.saveMessage(storedMessage, conversationId)
        return { success: true }
    } catch (error) {
        console.error('Error saving message:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('get-all-conversations', () => {
    try {
        const conversations = conversationStorage.getAllConversations()
        return { success: true, conversations }
    } catch (error) {
        console.error('Error getting conversations:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error), conversations: [] }
    }
})

ipcMain.handle('clear-conversation', (_event, conversationId: string = 'default') => {
    try {
        conversationStorage.clearConversation(conversationId)
        return { success: true }
    } catch (error) {
        console.error('Error clearing conversation:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('delete-conversation', (_event, conversationId: string) => {
    try {
        conversationStorage.deleteConversation(conversationId)
        // Also clear streaming state if exists
        streamingStates.delete(conversationId)
        return { success: true }
    } catch (error) {
        console.error('Error deleting conversation:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('open-external-url', async (_event, url: string) => {
    try {
        await shell.openExternal(url)
        return { success: true }
    } catch (error) {
        console.error('Error opening external URL:', error)
        return { success: false, error: String(error) }
    }
})

ipcMain.handle('save-settings', async (_event, provider: string, apiKey: string) => {
    try {
        const providerConfig = settingsStorage.getProviderConfig(provider)
        if (!providerConfig) {
            return { success: false, error: 'Invalid provider' }
        }

        // Save API key for this provider
        const saved = settingsStorage.saveProviderApiKey(provider, apiKey)
        if (!saved) {
            return { success: false, error: 'Failed to save API key' }
        }

        // Load existing settings to preserve language and wordSelectionEnabled
        const existingSettings = settingsStorage.loadSettings()
        const currentLanguage = getCurrentLanguage()

        // Update language and wordSelectionEnabled if needed
        if (existingSettings) {
            const settings = {
                provider: provider,
                apiKey: apiKey,
                baseUrl: providerConfig.baseUrl,
                model: providerConfig.model,
                language: existingSettings.language || currentLanguage || 'zh',
                wordSelectionEnabled: existingSettings.wordSelectionEnabled !== false
            }
            settingsStorage.saveSettings(settings)
        }

        // Set as current provider and update chat service configuration
        settingsStorage.setCurrentProvider(provider)
        hasSettings = true
        chatService.updateConfig({
            baseUrl: providerConfig.baseUrl,
            apiKey: apiKey,
            model: providerConfig.model
        })

        // Update tray menu after settings are saved
        updateTrayMenu()

        return { success: true }
    } catch (error) {
        console.error('Error saving settings:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('verify-api-key', async (_event, provider: string, apiKey: string) => {
    try {
        const providerConfig = settingsStorage.getProviderConfig(provider)
        if (!providerConfig) {
            return { success: false, error: 'Invalid provider' }
        }

        // Create a temporary chat service instance for verification
        const tempChatService = new ChatService({
            baseUrl: providerConfig.baseUrl,
            apiKey: apiKey,
            model: providerConfig.model
        })

        // Send a simple test message
        const testMessages = [{ role: 'user' as const, content: 'Hello' }]
        let hasResponse = false
        let errorMessage = ''

        try {
            for await (const chunk of tempChatService.generateStreamingResponse(testMessages, undefined, undefined, false)) {
                if (chunk.done) {
                    hasResponse = true
                    break
                }
                // Just consume the stream to verify it works
                if (chunk.content) {
                    hasResponse = true
                    break
                }
            }
        } catch (error) {
            console.error('Error verifying API key:', error)
            errorMessage = error instanceof Error ? error.message : String(error)
            return { success: false, error: errorMessage }
        }

        if (hasResponse) {
            return { success: true }
        } else {
            return { success: false, error: 'No response received' }
        }
    } catch (error) {
        console.error('Error verifying API key:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('get-available-providers', () => {
    try {
        const providers = settingsStorage.getAvailableProviders()
        const providerConfigs = providers.map(provider => {
            const config = settingsStorage.getProviderConfig(provider)
            return {
                provider: provider,
                providerName: config?.provider || '',
                baseUrl: config?.baseUrl || '',
                model: config?.model || ''
            }
        })
        return { success: true, providers: providerConfigs }
    } catch (error) {
        console.error('Error getting providers:', error)
        return { success: false, providers: [], error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('get-all-settings', () => {
    try {
        const settings = settingsStorage.loadSettings()
        if (!settings) {
            return { success: false, hasSettings: false }
        }
        const menuActions = settingsStorage.getMenuActions()
        return { 
            success: true, 
            hasSettings: true, 
            settings: { 
                provider: settings.provider, 
                baseUrl: settings.baseUrl, 
                model: settings.model,
                language: settings.language || 'zh',
                wordSelectionEnabled: settings.wordSelectionEnabled !== false,
                menuActions: menuActions
            } 
        }
    } catch (error) {
        console.error('Error getting all settings:', error)
        return { success: false, hasSettings: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('get-language', () => {
    return getCurrentLanguage()
})

ipcMain.handle('save-language', async (_event, language: string) => {
    try {
        const currentSettings = settingsStorage.loadSettings()
        if (!currentSettings) {
            // If no settings exist, create a minimal settings object
            const settings = {
                provider: '',
                apiKey: '',
                baseUrl: '',
                model: '',
                language: language,
                wordSelectionEnabled: true
            }
            settingsStorage.saveSettings(settings)
            // Update tray menu with new language
            updateTrayMenu()
            // Notify fullChatWindow to update language
            if (fullChatWindow && !fullChatWindow.isDestroyed()) {
                fullChatWindow.webContents.send('language-updated', language)
            }

            if (chatWindow && !chatWindow.isDestroyed()) {
                chatWindow.webContents.send('language-updated', language)
            }

            // menuWindow?.destroy()
            // menuWindow = createMenuWindow(language)

            return { success: true }
        }

        if (currentSettings.language === language) {
            return { success: true }
        }

        // menuWindow?.destroy()
        // menuWindow = createMenuWindow(language)
        
        const updatedSettings = {
            ...currentSettings,
            language: language
        }
        
        const saved = settingsStorage.saveSettings(updatedSettings)
        if (!saved) {
            return { success: false, error: 'Failed to save settings' }
        }
        
        // Update tray menu with new language
        updateTrayMenu()
        
        // Notify fullChatWindow to update language
        if (fullChatWindow && !fullChatWindow.isDestroyed()) {
            fullChatWindow.webContents.send('language-updated', language)
        }

        if (chatWindow && !chatWindow.isDestroyed()) {
            chatWindow.webContents.send('language-updated', language)
        }
        
        return { success: true }
    } catch (error) {
        console.error('Error saving language setting:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('save-word-selection-enabled', async (_event, enabled: boolean) => {
    try {
        const currentSettings = settingsStorage.loadSettings()
        if (!currentSettings) {
            return { success: false, error: 'No existing settings found' }
        }
        
        const currentLanguage = getCurrentLanguage()
        
        const updatedSettings = {
            ...currentSettings,
            wordSelectionEnabled: enabled,
            language: currentSettings.language || currentLanguage || 'zh'
        }
        
        const saved = settingsStorage.saveSettings(updatedSettings)
        if (!saved) {
            return { success: false, error: 'Failed to save settings' }
        }
        
        // Apply the setting immediately
        setTextMonitorEnabled(enabled)
        
        return { success: true }
    } catch (error) {
        console.error('Error saving word selection setting:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('get-available-apps', async () => {
    try {
        const apps = settingsStorage.getAvailableApps()
        return { success: true, apps }
    } catch (error) {
        console.error('Error getting available apps:', error)
        return { success: false, apps: [], error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('get-disabled-apps', async () => {
    try {
        const apps = settingsStorage.getDisabledApps()
        return { success: true, apps }
    } catch (error) {
        console.error('Error getting disabled apps:', error)
        return { success: false, apps: [], error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('add-disabled-app', async (_event, app: string) => {
    try {
        const saved = settingsStorage.addDisabledApp(app)
        if (!saved) {
            return { success: false, error: 'Failed to add disabled app' }
        }
        return { success: true }
    } catch (error) {
        console.error('Error adding disabled app:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('remove-disabled-app', async (_event, app: string) => {
    try {
        const saved = settingsStorage.removeDisabledApp(app)
        if (!saved) {
            return { success: false, error: 'Failed to remove disabled app' }
        }
        return { success: true }
    } catch (error) {
        console.error('Error removing disabled app:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('get-menu-actions', async () => {
    try {
        const actions = settingsStorage.getMenuActions()
        return { success: true, actions }
    } catch (error) {
        console.error('Error getting menu actions:', error)
        return { success: false, actions: ['explain', 'translate', 'ask'], error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('save-menu-actions', async (_event, actions: string[]) => {
    try {
        const saved = settingsStorage.saveMenuActions(actions)
        if (!saved) {
            return { success: false, error: 'Failed to save menu actions' }
        }
        return { success: true }
    } catch (error) {
        console.error('Error saving menu actions:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('get-provider-api-key', async (_event, provider: string) => {
    try {
        const apiKey = settingsStorage.getProviderApiKey(provider)
        if (apiKey) {
            return { success: true, apiKey: apiKey }
        } else {
            return { success: true, apiKey: null }
        }
    } catch (error) {
        console.error('Error getting provider API key:', error)
        return { success: false, apiKey: null, error: error instanceof Error ? error.message : String(error) }
    }
})

ipcMain.handle('set-current-provider', async (_event, provider: string) => {
    try {
        // Check if provider has a verified API key
        const apiKey = settingsStorage.getProviderApiKey(provider)
        if (!apiKey) {
            return { success: false, error: 'Provider does not have a verified API key' }
        }

        // Get provider config
        const providerConfig = settingsStorage.getProviderConfig(provider)
        if (!providerConfig) {
            return { success: false, error: 'Invalid provider' }
        }

        // Set as current provider
        const setResult = settingsStorage.setCurrentProvider(provider)
        if (!setResult) {
            return { success: false, error: 'Failed to set current provider' }
        }

        // Update chat service configuration
        chatService.updateConfig({
            baseUrl: providerConfig.baseUrl,
            apiKey: apiKey,
            model: providerConfig.model
        })

        return { success: true }
    } catch (error) {
        console.error('Error setting current provider:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
})