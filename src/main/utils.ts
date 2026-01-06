import { clipboard } from 'electron'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
import { exec, execFile } from 'child_process'
import { promisify } from 'util'
const execAsync = promisify(exec)
import path from 'path'
import { app } from 'electron'

let GetForegroundWindow: (() => bigint) | null = null
let SetForegroundWindow: ((hwnd: bigint) => boolean) | null = null
let SendMessageW: ((hwnd: bigint, msg: number, wParam: bigint, lParam: bigint) => number) | null = null
let keybd_event: ((vk: number, scan: number, flags: number, extraInfo: bigint) => void) | null = null
let GetWindowTextW: ((hWnd: bigint, text: Buffer, count: number) => number) | null = null
let GetWindowThreadProcessId: ((hWnd: bigint, process_id: Buffer) => number) | null = null
let OpenProcess: ((access: number, inherit: number, pid: number) => bigint) | null = null
let CloseHandle: ((hObject: bigint) => number) | null = null
let QueryFullProcessImageNameW: ((hProcess: bigint, flags: number, name: Buffer, size: Buffer) => number) | null = null
let koffi: any = null

if (process.platform === 'win32') {
    try {
        koffi = require('koffi')
        const user32 = koffi.load('user32.dll')
        const kernel32 = koffi.load('kernel32.dll')

        GetForegroundWindow = user32.func('void* __stdcall GetForegroundWindow()')
        SetForegroundWindow = user32.func('bool __stdcall SetForegroundWindow(void*)')
        SendMessageW = user32.func('intptr_t __stdcall SendMessageW(void*, uint32_t, uintptr_t, intptr_t)')
        keybd_event = user32.func('void __stdcall keybd_event(uint8_t, uint8_t, uint32_t, uintptr_t)')
        GetWindowTextW = user32.func('int __stdcall GetWindowTextW(void* hWnd, char16* lpString, int nMaxCount)')
        GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void* hWnd, uint32* processId)')
        OpenProcess = kernel32.func('void* __stdcall OpenProcess(uint32 access, int inherit, uint32 pid)')
        CloseHandle = kernel32.func('int __stdcall CloseHandle(void* hObject)')
        QueryFullProcessImageNameW = kernel32.func('int __stdcall QueryFullProcessImageNameW(void* hProcess, uint32 flags, char16* name, uint32* size)')
        console.log('✅ Windows API functions loaded successfully')
    } catch (error) {
        console.error('⚠️ Failed to load Windows API functions:', error)
        console.log('Will fallback to keyboard simulation method')
    }
}

function getExePath(name: string) {
    let exePath: string
    if (app.isPackaged) {
        exePath = path.join(process.resourcesPath, `${name}.exe`)
    } else {
        const { fileURLToPath } = require('url')
        const { dirname } = require('path')
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = dirname(__filename)
        exePath = path.join(__dirname, `../../resources/${name}.exe`)
    }
    return exePath
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
}

function upperFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

export const getActiveWindowInfo = () => {
    if (!GetForegroundWindow || !GetWindowTextW || !GetWindowThreadProcessId || !OpenProcess || !CloseHandle || !QueryFullProcessImageNameW || !koffi)
        return null

    const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    const hwnd = GetForegroundWindow()
    if (!hwnd) return null

    const titleBuffer = Buffer.alloc(512 * 2)
    const titleLength = GetWindowTextW(hwnd, titleBuffer, titleBuffer.length / 2)
    const windowTitle = titleLength > 0 ? koffi.decode(titleBuffer, 'char16', titleLength) : ''
    const pidPtr = koffi.alloc('uint32', 1)
    GetWindowThreadProcessId(hwnd, pidPtr)
    const processId = koffi.decode(pidPtr, 'uint32')
    let processName = ''
    const hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, processId)
    if (hProcess && hProcess !== 0n && hProcess !== null) {
        const nameBuffer = Buffer.alloc(4096 * 2);
        const sizePtr = Buffer.alloc(4);
        sizePtr.writeUInt32LE(4096, 0);
        const ok = QueryFullProcessImageNameW(hProcess, 0, nameBuffer, sizePtr);
        if (ok) {
            const usedChars = koffi.decode(sizePtr, 'uint32'); // 实际写入的字符数
            const fullPath = koffi.decode(nameBuffer, 'char16', usedChars);
            // console.log('fullPath:', fullPath);
            processName = fullPath.split('\\').pop() || '';
        } else {
            console.warn('QueryFullProcessImageNameW failed');
        }
        CloseHandle(hProcess);
    } else {
        console.warn('OpenProcess failed');
    }

    const processExeName = processName.replace('.exe', '').toLowerCase()
    const appDisplayName = windowTitle.match(/^[a-zA-Z]:\\/) ?
        upperFirst(windowTitle.split("\\").pop().replace('.exe', '').toLowerCase())
        : upperFirst(windowTitle.split(' - ').pop()) || upperFirst(processExeName)

    return { windowTitle, processId, processExeName: processExeName, appDisplayName: appDisplayName }
}

function getSelectedTextFromCSharp() {
    console.log('getSelectedTextFromCSharp')
    return new Promise((resolve, _reject) => {
        execFile(getExePath('GetSelectedText'), [], { encoding: 'utf8' }, (err, stdout) => {
            if (err) {
                console.error('Error executing GetSelectedText.exe:', err)
                return resolve('')
            }
            resolve(stdout)
        })
    })
}

export function getTextInfoFromCSharp() {
    return new Promise((resolve, _reject) => {
        execFile(getExePath('GetSelectedText'), ['--json'], { encoding: 'utf8' }, (err, stdout) => {
            if (err) {
                console.error('Error executing GetSelectedText.exe:', err)
                return resolve(null)
            }
            try {
                resolve(JSON.parse(stdout.trim()))
            } catch {
                resolve(null)
            }
        })
    })
}

export function updateSelectedTextByCSharp(oldText:string, text: string, direction: string) {
    console.log('updateSelectedTextByCSharp', text)
    return new Promise((resolve, _reject) => {
        execFile(getExePath('UpdateSelectedText'), [oldText, text, direction], { encoding: 'utf8' }, (err, _stdout) => {
            console.log('updateSelectedTextByCSharp stdout:', _stdout)
            if (err) {
                console.error('Error executing UpdateSelectedText.exe:', err)
                return resolve(null)
            }
            resolve(true)
        })
    })
}

async function waitClipboardChange(timeout = 500): Promise<string> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
        const text = clipboard.readText()
        if (text && !text.startsWith('__CLIPBOARD_PLACEHOLDER__')) {
            return text
        }
        await sleep(100)
    }
    return ""
}

async function captureSelectedTextWithKoffi() {
    console.log('captureSelectedTextWithKoffi')
    if (!GetForegroundWindow || !SetForegroundWindow || !SendMessageW || !keybd_event) return ""

    const KEYEVENTF_KEYUP = 0x0002
    const VK_CONTROL = 0x11
    const VK_C = 0x43
    const hwnd = GetForegroundWindow()
    if (!hwnd) return ""

    const prevText = clipboard.readText() || ''
    const PLACEHOLDER = "__CLIPBOARD_PLACEHOLDER__" + Date.now()
    clipboard.writeText(PLACEHOLDER)

    SetForegroundWindow(hwnd)
    
    keybd_event(VK_CONTROL, 0, 0, 0n)
    keybd_event(VK_C, 0, 0, 0n)
    keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0n)
    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0n)

    const newText = await waitClipboardChange()
    if (!newText || newText.startsWith('__CLIPBOARD_PLACEHOLDER__')) {
        if (!prevText.startsWith('__CLIPBOARD_PLACEHOLDER__')) {
            clipboard.writeText(prevText)
        }
        return ""
    }

    if (!prevText.startsWith('__CLIPBOARD_PLACEHOLDER__')) {
        clipboard.writeText(prevText)
    }
    return newText
}

export async function updateSelectedTextByKoffi(text: string) {
    if (!keybd_event || !GetForegroundWindow || !SetForegroundWindow) return
    const KEYEVENTF_KEYUP = 0x0002
    const VK_CONTROL = 0x11
    const VK_V = 0x56
    const prevText = clipboard.readText()
    console.log('write text to clipboard:', text)
    
    clipboard.writeText(text)
    await sleep(50)
    keybd_event(VK_CONTROL, 0, 0, 0n)
    keybd_event(VK_V, 0, 0, 0n)
    keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0n)
    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0n)
    
    await sleep(100)
    if (prevText) {
        clipboard.writeText(prevText)
    }
}

/**
 * Using command line to simulate keyboard input for obtaining selected text (cross-platform fallback solution)
 */
const captureSelectedTextWithCommand = async (): Promise<string> => {
    try {
        console.log('captureSelectedTextWithCommand')
        console.log('process.platform', process.platform)
        const prevText = clipboard.readText()
        // Simulate Ctrl/Cmd+C using system commands
        if (process.platform === 'darwin') {
            // macOS: Use AppleScript
            await execAsync(`osascript -e 'tell application "System Events" to keystroke "c" using command down'`)
        } else if (process.platform === 'win32') {
            // Windows: Use PowerShell with SendKeys
            await execAsync('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^c\')"')
        } else {
            // Linux: Use xdotool
            await execAsync('xdotool key ctrl+c')
        }

        // Wait for clipboard to update
        await new Promise(resolve => setTimeout(resolve, 50))

        // Get the copied text
        const selectedText = clipboard.readText().trim()
        clipboard.writeText(prevText)
        console.log("📋 Selected text (Keyboard):", selectedText)
        return selectedText
    } catch (error) {
        console.error('Error capturing selected text with keyboard:', error)
        console.log('Make sure you have selected text before pressing the hotkey.')
        return ""
    }
}

export async function captureSelectedText(currentApp: string): Promise<string> {
    try {
        if (process.platform === 'win32') {
            let text = await getSelectedTextFromCSharp() as string
            if (text) return text
            else if (!['cmd', 'powershell', 'windowsterminal'].includes(currentApp.toLowerCase().trim())) return await captureSelectedTextWithKoffi()
            else return ""
        }
        return await captureSelectedTextWithCommand()
    } catch (error) {
        console.error('Error capturing selected text:', error)
        return ""
    }
}

export const getActiveWindowWithCmd = async () => {
    try {
        const command = `%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoProfile -Command "Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")]public static extern IntPtr GetForegroundWindow();[DllImport(\\"user32.dll\\")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);' -Name U -Namespace W;$h=[W.U]::GetForegroundWindow();$p=0;[W.U]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null;(Get-Process -Id $p).Name"`;

        const { stdout } = await execAsync(command)
        return stdout
    } catch (error) {
        console.error('Error getting active window:', error);
        return ""
    }
}

export function getForegroundWindow(): bigint {
    if (!GetForegroundWindow) return 0n
    return GetForegroundWindow()
}

export function setForegroundWindow(hwnd: bigint): boolean {
    if (!SetForegroundWindow) return false
    return SetForegroundWindow(hwnd)
}