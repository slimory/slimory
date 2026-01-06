import { BrowserWindow, app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const messageWindowWidth = 418
const messageWindowHeight = 278

let currentMessageWindow: BrowserWindow | null = null

export { messageWindowWidth, messageWindowHeight }

export function createMessageWindow(): BrowserWindow {
    const win = new BrowserWindow({
        width: messageWindowWidth,
        height: messageWindowHeight,
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

    // Load the message renderer
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    if (isDev) {
        // In development, load from Vite dev server
        win.loadURL('http://localhost:5173/message.html')
    } else {
        // In production, load from file
        win.loadFile(path.join(__dirname, '../../dist/message.html'))
    }

    win.on('hide', () => {
        // console.log('💬 Message window hidden')
    })

    win.on('close', () => {
        console.log('💬 Message window closing')
        currentMessageWindow = null
    })

    return win
}

export function showMessageWindow(
    window: BrowserWindow,
    menuBounds: Electron.Rectangle,
    menuDirection: string
): string {
    const menuX = menuBounds.x
    const menuY = menuBounds.y
    const menuHeight = menuBounds.height
    // Calculate position relative to menu window
    let messageX = menuX
    let messageY = menuY
    let direction = 'bottom'

    // Adjust horizontal position if needed
    if (messageX < 0) messageX = 10

    // Adjust vertical position if needed
    if (messageY < 0) messageY = 10

    if (menuDirection === 'top') {
        messageY = menuY - (messageWindowHeight - menuHeight)
    } else {
        messageY = menuY
    }
    direction = menuDirection

    window.setResizable(true)
    window.setSize(messageWindowWidth, messageWindowHeight)
    window.setResizable(false)

    window.setPosition(Math.floor(messageX), Math.floor(messageY), false)
    window.show()

    console.log('💬 Translation message window shown at position:', { x: messageX, y: messageY })
    console.log('💬 Menu window position:', { x: menuX, y: menuY }, direction)

    // Store reference to current window
    currentMessageWindow = window
    return direction
}

export function showChatMessageWindow(
    window: BrowserWindow,
    chatWindow: BrowserWindow,
    menuDirection: string
): string {
    // Get chat window bounds
    const chatBounds = chatWindow.getBounds()

    // Calculate available space below chat window
    const chatBottomY = chatBounds.y + chatBounds.height
    // const availableSpaceBelow = screenHeight - chatBottomY

    let messageX = chatBounds.x
    let messageY = chatBottomY - 24
    let direction = "bottom"

    // Adjust horizontal position if needed
    if (messageX < 0) messageX = 10

    // Adjust vertical position if needed
    if (messageY < 0) messageY = 10

    if (menuDirection === 'top') {
        messageY = chatBounds.y - messageWindowHeight + 24
        direction = 'top'
    }

    window.setResizable(true)
    window.setSize(messageWindowWidth, messageWindowHeight)
    window.setResizable(false)

    window.setPosition(Math.floor(messageX), Math.floor(messageY), false)
    window.showInactive()

    // Store reference to current window
    currentMessageWindow = window
    return direction
}

export function hideMessageWindow(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        // Send hide event to renderer process to clear content
        window.hide()
        window.setResizable(true)
        window.setSize(messageWindowWidth, messageWindowHeight)
        window.setResizable(false)
        console.log('💬 Message window hidden')
    }
    currentMessageWindow = null
}

export function getMessageWindow(): BrowserWindow | null {
    return currentMessageWindow
}
