import { BrowserWindow, app, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let currentSettingsWindow: BrowserWindow | null = null

export function createSettingsWindow(): BrowserWindow {
    // Get screen dimensions
    const display = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = display.workAreaSize
    
    // Calculate window size: compact and fit content
    const settingsWindowWidth = 520
    const settingsWindowHeight = 660
    
    // Calculate center position
    const centerX = Math.floor((screenWidth - settingsWindowWidth) / 2)
    const centerY = Math.floor((screenHeight - settingsWindowHeight) / 2)

    const win = new BrowserWindow({
        width: settingsWindowWidth,
        height: settingsWindowHeight,
        x: centerX,
        y: centerY,
        show: true,
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

    // Load the settings renderer
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    if (isDev) {
        // In development, load from Vite dev server
        win.loadURL('http://localhost:5174/settings.html')
    } else {
        // In production, load from file
        win.loadFile(path.join(__dirname, '../../dist/settings.html'))
    }

    win.on('close', () => {
        console.log('⚙️ Settings window closing')
        currentSettingsWindow = null
    })

    return win
}

export function showSettingsWindow(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        window.show()
        window.focus()
        console.log('⚙️ Settings window shown')
    }
    currentSettingsWindow = window
}

export function hideSettingsWindow(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        window.hide()
        console.log('⚙️ Settings window hidden')
    }
    currentSettingsWindow = null
}

export function closeSettingsWindow(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        window.close()
        console.log('⚙️ Settings window closed')
    }
    currentSettingsWindow = null
}

export function isSettingsWindowVisible(window: BrowserWindow): boolean {
    return window && !window.isDestroyed() && window.isVisible()
}

export function getSettingsWindow(): BrowserWindow | null {
    return currentSettingsWindow
}

