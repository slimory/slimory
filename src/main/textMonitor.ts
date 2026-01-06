import { uIOhook } from 'uiohook-napi'
import { screen } from 'electron'
import { captureSelectedText, getActiveWindowInfo } from './utils'

// const defaultForbiddenApps: string[] = ["cursor", "windowsterminal", "electron", "slimory", "powershell"]

let isMonitoring = false
let isEnabled = false
let activeWindow = ""
let selectionCallback: ((text: string, downX: number, downY: number, upX: number, upY: number) => void) | null = null
let getDisabledAppsCallback: (() => string[]) | null = null
let addAvailableAppCallback: ((app: string, displayName?: string) => void) | null = null

const dataStore = {
    mouseUpX: 0,
    mouseUpY: 0,
    mouseDownX: 0,
    mouseDownY: 0,
    isForbidden: false,
    activeWindow: "",
    currentText: "",
    lastSelectedTextInfo: {
        text: "",
        mouseDownX: 0,
        mouseDownY: 0,
        mouseUpX: 0,
        mouseUpY: 0
    }
}

function shouldIgnore(selectedText: string) {
    if (selectedText !== dataStore.lastSelectedTextInfo.text) {
        return false
    }
    const line0: [number, number][] = dataStore.mouseDownX < dataStore.mouseUpX ?
    [[dataStore.mouseDownX, dataStore.mouseDownY], [dataStore.mouseUpX, dataStore.mouseUpY]] :
    [[dataStore.mouseUpX, dataStore.mouseUpY], [dataStore.mouseDownX, dataStore.mouseDownY]]
    const line1: [number, number][] = dataStore.lastSelectedTextInfo.mouseDownX < dataStore.lastSelectedTextInfo.mouseUpX ?
    [[dataStore.lastSelectedTextInfo.mouseDownX, dataStore.lastSelectedTextInfo.mouseDownY], [dataStore.lastSelectedTextInfo.mouseUpX, dataStore.lastSelectedTextInfo.mouseUpY]] :
    [[dataStore.lastSelectedTextInfo.mouseUpX, dataStore.lastSelectedTextInfo.mouseUpY], [dataStore.lastSelectedTextInfo.mouseDownX, dataStore.lastSelectedTextInfo.mouseDownY]]
    const distStart = Math.sqrt(Math.pow(line0[0][0] - line1[0][0], 2) + Math.pow(line0[0][1] - line1[0][1], 2))
    const distEnd = Math.sqrt(Math.pow(line0[1][0] - line1[1][0], 2) + Math.pow(line0[1][1] - line1[1][1], 2))
    return distStart + distEnd > 100
}

export function startTextMonitor(
    callback: (text: string, downX: number, downY: number, upX: number, upY: number) => void,
    getDisabledApps?: () => string[],
    addAvailableApp?: (app: string, displayName?: string) => void
): void {
    if (isMonitoring) return

    isMonitoring = true
    selectionCallback = callback
    getDisabledAppsCallback = getDisabledApps || null
    addAvailableAppCallback = addAvailableApp || null

    const uiohook = uIOhook as any

    uiohook.on('mousedown', async (event: any) => {
        if (!isEnabled) return
        dataStore.mouseDownX = event.x
        dataStore.mouseDownY = event.y
        dataStore.currentText = ""
    })

    uiohook.on('mouseup', async (event: any) => {
        if (!isEnabled) return
        
        dataStore.mouseUpX = event.x
        dataStore.mouseUpY = event.y
        const deltaX = Math.abs(event.x - dataStore.mouseDownX)
        const deltaY = Math.abs(event.y - dataStore.mouseDownY)
        const info = getActiveWindowInfo()
        activeWindow = info?.processExeName || ''
        console.log('active window:', info)
        const appDisplayName = info?.appDisplayName || ''
        
        // Check if app is disabled
        const disabledApps = getDisabledAppsCallback ? getDisabledAppsCallback() : []
        const normalizedActiveWindow = activeWindow.toLowerCase().trim()
        dataStore.isForbidden = disabledApps.includes(normalizedActiveWindow)
        dataStore.activeWindow = activeWindow

        if (!dataStore.isForbidden && (deltaX > 5 || deltaY > 5)) {
            const selectedText = await captureSelectedText(activeWindow)
            if (selectedText && selectionCallback) {
                console.log('selectedText:', selectedText)
                const scaleFactor = screen.getPrimaryDisplay().scaleFactor
                const cursorPosition = { x: dataStore.mouseUpX, y: dataStore.mouseUpY }
                if (shouldIgnore(selectedText)) return
                dataStore.lastSelectedTextInfo.text = selectedText
                dataStore.lastSelectedTextInfo.mouseDownX = dataStore.mouseDownX
                dataStore.lastSelectedTextInfo.mouseDownY = dataStore.mouseDownY
                dataStore.lastSelectedTextInfo.mouseUpX = dataStore.mouseUpX
                dataStore.lastSelectedTextInfo.mouseUpY = dataStore.mouseUpY
                dataStore.currentText = selectedText
                selectionCallback(
                    selectedText,
                    dataStore.mouseDownX / scaleFactor,
                    dataStore.mouseDownY / scaleFactor,
                    cursorPosition.x / scaleFactor,
                    cursorPosition.y / scaleFactor
                )
                // Add to available apps if not exists
                if (addAvailableAppCallback && activeWindow.toLowerCase().trim()) {
                    addAvailableAppCallback(activeWindow, appDisplayName)
                }
            }
        }

    })
}

export function setTextMonitorEnabled(enabled: boolean): void {
    isEnabled = enabled
    console.log(`Text monitor ${enabled ? 'enabled' : 'disabled'}`)
}

export function getLastClickInfo(): { mouseUpX: number, mouseUpY: number, mouseDownX: number, mouseDownY: number, currentText: string } {
    return {
        mouseUpX: dataStore.lastSelectedTextInfo.mouseUpX,
        mouseUpY: dataStore.lastSelectedTextInfo.mouseUpY,
        mouseDownX: dataStore.lastSelectedTextInfo.mouseDownX,
        mouseDownY: dataStore.lastSelectedTextInfo.mouseDownY,
        currentText: dataStore.lastSelectedTextInfo.text
    }
}