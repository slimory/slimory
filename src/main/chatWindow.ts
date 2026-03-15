import { BrowserWindow, app, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const chatPanelWidth = 318
const chatPanelHeight = 72

let currentChatWindow: BrowserWindow | null = null

export { chatPanelWidth, chatPanelHeight }

export function createChatWindow(): BrowserWindow {
    const win = new BrowserWindow({
        width: chatPanelWidth,
        height: chatPanelHeight,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00FFFFFF',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        focusable: true,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: false
        }
    })

    // Load the chat renderer
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    if (isDev) {
        // In development, load from Vite dev server
        win.loadURL('http://localhost:5174/chat.html')
    } else {
        // In production, load from file
        win.loadFile(path.join(__dirname, '../../dist/chat.html'))
    }

    win.on('hide', () => {
        // console.log('💬 Chat window hidden')
    })

    win.on('close', () => {
        console.log('💬 Chat window closing')
        currentChatWindow = null
    })

    return win
}

export function showChatWindow(
    window: BrowserWindow,
    selectedText: string,
    x: number,
    y: number,
    isTranslation: boolean = false,
    command: string = 'ask'
): void {
    // Get screen bounds to ensure chat stays on screen
    const display = screen.getPrimaryDisplay()
    const { width: screenWidth } = display.workAreaSize

    // Calculate position to keep chat on screen
    let chatX = x
    let chatY = y


    if (chatX < 0) chatX = 10
    if (chatX + chatPanelWidth > screenWidth) {
        chatX = screenWidth - chatPanelWidth - 10
    }

    // Ensure window is fully visible
    // window.setOpacity(1)

    window.setResizable(true)
    window.setSize(chatPanelWidth, chatPanelHeight)
    window.setResizable(false)

    // window.setPosition(Math.floor(chatX / scaleFactor), Math.floor(chatY / scaleFactor), false)
    window.setPosition(Math.floor(chatX), Math.floor(chatY), false)
    window.show()

    console.log('💬 Chat window shown at position:', { x: chatX, y: chatY })

    // Store reference to current window
    currentChatWindow = window

    // Send the selected text to the renderer process
    window.webContents.send('show-chat', selectedText, isTranslation, command)
}

export function hideChatWindow(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        window.hide()
        window.setResizable(true)
        window.setSize(chatPanelWidth, chatPanelHeight)
        window.setResizable(false)
        console.log('💬 Chat window hidden')
    }
    currentChatWindow = null
}

export function getChatWindow(): BrowserWindow | null {
    return currentChatWindow
}

