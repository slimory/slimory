import { BrowserWindow, app, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let currentFullChatWindow: BrowserWindow | null = null
let positionX: number = 0
let positionY: number = 0
let fullChatWindowWidth: number = 0
let fullChatWindowHeight: number = 0

export function createFullChatWindow(): BrowserWindow {
    // Get screen dimensions
    const display = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = display.workAreaSize
    
    // Calculate window size: 40% width, 90% height
    fullChatWindowWidth = Math.floor(screenWidth * 0.45)
    fullChatWindowHeight = Math.floor(screenHeight)
    
    // Calculate center position
    positionX = Math.floor((screenWidth - fullChatWindowWidth) / 2)
    positionY = Math.floor((screenHeight - fullChatWindowHeight) / 2)

    const win = new BrowserWindow({
        width: fullChatWindowWidth,
        height: fullChatWindowHeight,
        x: positionX,
        y: positionY,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00FFFFFF',
        alwaysOnTop: false,
        skipTaskbar: false,
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

    // Load the full chat renderer
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    if (isDev) {
        // In development, load from Vite dev server
        win.loadURL('http://localhost:5173/fullChat.html')
    } else {
        // In production, load from file
        win.loadFile(path.join(__dirname, '../../dist/fullChat.html'))
    }

    win.on('hide', () => {
        console.log('💬 Full chat window hidden')
    })

    win.on('close', () => {
        console.log('💬 Full chat window closing')
        currentFullChatWindow = null
    })

    return win
}

export function resetPosition(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        window.setPosition(positionX, positionY)
    }
}

export function showFullChatWindow(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        window.setResizable(true)
        window.setSize(fullChatWindowWidth, fullChatWindowHeight)
        window.setResizable(false)
        window.show()
        window.focus()
        console.log('💬 Full chat window shown')
    }
    currentFullChatWindow = window
}

export function hideFullChatWindow(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        window.hide()
        console.log('💬 Full chat window hidden')
    }
    currentFullChatWindow = null
}

export function isFullChatWindowVisible(window: BrowserWindow): boolean {
    return window && !window.isDestroyed() && window.isVisible()
}

export function getFullChatWindow(): BrowserWindow | null {
    return currentFullChatWindow
}

