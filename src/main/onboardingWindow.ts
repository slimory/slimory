import { BrowserWindow, app, screen } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let currentOnboardingWindow: BrowserWindow | null = null

export function createOnboardingWindow(): BrowserWindow {
    // Get screen dimensions
    const display = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = display.workAreaSize
    
    // Calculate window size: compact and fit content
    const onboardingWindowWidth = 520
    const onboardingWindowHeight = 580
    
    // Calculate center position
    const centerX = Math.floor((screenWidth - onboardingWindowWidth) / 2)
    const centerY = Math.floor((screenHeight - onboardingWindowHeight) / 2)

    const win = new BrowserWindow({
        width: onboardingWindowWidth,
        height: onboardingWindowHeight,
        x: centerX,
        y: centerY,
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

    // Load the onboarding renderer
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    if (isDev) {
        // In development, load from Vite dev server
        win.loadURL('http://localhost:5173/onboarding.html')
    } else {
        // In production, load from file
        win.loadFile(path.join(__dirname, '../../dist/onboarding.html'))
    }

    win.on('close', () => {
        console.log('🎓 Onboarding window closing')
        currentOnboardingWindow = null
    })

    return win
}

export function showOnboardingWindow(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        window.show()
        window.focus()
        console.log('🎓 Onboarding window shown')
    }
    currentOnboardingWindow = window
}

export function hideOnboardingWindow(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        window.hide()
        console.log('🎓 Onboarding window hidden')
    }
    currentOnboardingWindow = null
}

export function closeOnboardingWindow(window: BrowserWindow): void {
    if (window && !window.isDestroyed()) {
        window.close()
        console.log('🎓 Onboarding window closed')
    }
    currentOnboardingWindow = null
}

export function isOnboardingWindowVisible(window: BrowserWindow): boolean {
    return window && !window.isDestroyed() && window.isVisible()
}

export function getOnboardingWindow(): BrowserWindow | null {
    return currentOnboardingWindow
}

