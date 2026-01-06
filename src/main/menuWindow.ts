import { BrowserWindow, app } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { screen } from 'electron'
import { getTextInfoFromCSharp, getForegroundWindow, setForegroundWindow } from './utils'
import { messageWindowHeight } from './messageWindow'
import { SettingsStorage } from '../services/settingsStorage'

const settingsStorage = new SettingsStorage()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const windowHeight = 64
const windowWidth = 500

let isReady: boolean = false
let currentForegroundWindowHwnd: bigint = 0n

let menuWindowTextInfo: { fullText?: string; selectedText?: string; selectionStart?: number; selectionEnd?: number } | null = null

export function setIsReady(ready: boolean) {
    console.log('Setting isReady to:', ready)
    isReady = ready
}

export function getIsReady(): boolean {
    return isReady
}

// Dynamic window width based on language
// function getWindowWidth(language: string = 'en'): number {
//     const widths = {
//         'en': 277,  // English
//         'zh': 233,   // Chinese
//         'ja': 233,   // Chinese
//         'ar': 233,   // Arabic
//         'hi': 277,   // Hindi
//         'bn': 420,   // Bengali
//     }
//     return widths[language as keyof typeof widths] || 316
// }

export { windowHeight }

/**
 * Get the actual width and height of the menu-popup element by executing JavaScript in the window
 */
export async function getMenuPopupBoundingRect(window: BrowserWindow): Promise<{ x: number; y: number; width: number; height: number } | null> {
    try {
        const size = await window.webContents.executeJavaScript(`
            (() => {
                const menuPopup = document.querySelector('.menu-popup');
                if (!menuPopup) {
                    return null;
                }
                const rect = menuPopup.getBoundingClientRect();
                return { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
            })()
        `) as { x: number; y: number; width: number; height: number } | null
        
        return size
    } catch (error) {
        console.error('Error getting menu-popup size:', error)
        return null
    }
}

export function createMenuWindow(_language: string = 'en'): BrowserWindow {
    const win = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00FFFFFF',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        focusable: false,
        // acceptFirstMouse: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: false
        }
    })

    // Load the menu renderer
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    if (isDev) {
        // In development, load from Vite dev server
        win.loadURL('http://localhost:5173/menu.html')
    } else {
        // In production, load from file
        win.loadFile(path.join(__dirname, '../../dist/menu.html'))
    }

    // Also hide when window is minimized
    win.on('minimize', () => {
        console.log('📦 Window minimized, hiding menu')
        hideMenuWindow(win)
    })

    // Hide when user switches to another application
    win.on('hide', () => {
        // console.log('👁️ Window hidden')
    })

    win.on('close', () => {
        clearMenuWindowTextInfo()
    })

    return win
}

export async function showMenuWindow(
    window: BrowserWindow,
    selectedText: string,
    downX: number,
    downY: number,
    upX: number,
    upY: number,
    _language: string = 'en'
): Promise<string> {
    setIsReady(false)
    currentForegroundWindowHwnd = getForegroundWindow()
    
    const primaryDisplay = screen.getPrimaryDisplay()
    let { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

    // Menu window size (approximate)
    const menuPopupSize = await getMenuPopupBoundingRect(window)
    let menuWidth = windowWidth
    let menuHeight = windowHeight
    if (menuPopupSize) {
        menuWidth = menuPopupSize.width
    }

    let menuX = (downX < upX ? downX : upX) - 16
    let menuY = upY + 1 // Offset below cursor
    let direction = 'bottom'

    // Adjust if menu would go off screen
    if (menuX < 0) menuX = 1
    if (menuX + menuWidth > screenWidth) menuX = screenWidth - menuWidth - 20
    if (menuY + messageWindowHeight + windowHeight - 16 > screenHeight) {
        menuY = downY - menuHeight - 11
        direction = 'top'
    }

    window.setResizable(true)
    window.setSize(windowWidth, windowHeight)
    window.setResizable(false)

    window.setPosition(Math.floor(menuX), Math.floor(menuY), false)
    window.show()

    // Get menu actions from settings
    const menuActions = settingsStorage.getMenuActions()

    // Send the selected text to the renderer process
    window.webContents.send('show-menu', {
        text: selectedText,
        x: menuX,
        y: menuY,
        actions: menuActions
    })

    try {
        const textInfo = await getTextInfoFromCSharp() as { fullText?: string; selectedText?: string; selectionStart?: number; selectionEnd?: number } | null
        if (textInfo) {
            menuWindowTextInfo = textInfo
            console.log('Saved text info for menu window:', textInfo)
        }
    } catch (error) {
        console.error('Failed to get text info when showing menu:', error)
    }

    setTimeout(() => {
        setIsReady(true)
    }, 200)
    return direction
}

export function hideMenuWindow(window: BrowserWindow, _language: string = 'en'): void {
    console.log("Hiding menu window")
    window.hide()
    window.setResizable(true)
    window.setSize(windowWidth, windowHeight)
    window.setResizable(false)
    setIsReady(false)
}

export function getMenuWindowTextInfo(): { fullText?: string; selectedText?: string; selectionStart?: number; selectionEnd?: number } | null {
    return menuWindowTextInfo
}

export function clearMenuWindowTextInfo(): void {
    menuWindowTextInfo = null
}

export function setForegroundWindowFocus(): void {
    console.log('Setting foreground window focus to:', currentForegroundWindowHwnd)
    if (currentForegroundWindowHwnd !== 0n) {
        setForegroundWindow(currentForegroundWindowHwnd)
    }
}