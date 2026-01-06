import { BrowserWindow, Menu } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { ScriptStorage } from '../../services/scriptStorage'
import { getCleanUrl, matchCleanUrls } from './urlUtils'
import { t } from '../../main/i18n'

/**
 * BrowserWindow pool manager
 * Manages reusable BrowserWindow instances to avoid creating too many windows
 */
class BrowserWindowPool {
    private pools: Map<string, BrowserWindow[]> = new Map()
    private inUse: Map<string, Set<BrowserWindow>> = new Map()
    private lastUsed: Map<BrowserWindow, number> = new Map()
    private cleanupInterval: NodeJS.Timeout | null = null
    private scriptStorage: ScriptStorage
    
    private readonly MAX_WINDOWS_PER_DOMAIN = 3
    private readonly IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes
    private readonly CLEANUP_INTERVAL = 60 * 1000 // 1 minute

    constructor() {
        this.scriptStorage = new ScriptStorage()
        this.startCleanupTimer()
    }

    /**
     * Get a BrowserWindow from the pool for a specific domain
     * @param domain - Domain name (e.g., 'youtube.com')
     * @param show - Whether to show the window (default: false)
     * @param newWindow - Whether to force create a new window instead of reusing (default: false)
     * @returns BrowserWindow instance
     */
    acquire(domain: string, show: boolean = false, newWindow: boolean = false): BrowserWindow {
        const pool = this.pools.get(domain) || []
        const inUseSet = this.inUse.get(domain) || new Set()

        // If newWindow is true, always create a new window
        if (newWindow) {
            const newWindowInstance = this.createWindow(show)
            pool.push(newWindowInstance)
            this.pools.set(domain, pool)
            inUseSet.add(newWindowInstance)
            this.inUse.set(domain, inUseSet)
            this.lastUsed.set(newWindowInstance, Date.now())
            
            return newWindowInstance
        }

        // Try to reuse an available window from the pool
        for (const window of pool) {
            if (!inUseSet.has(window) && !window.isDestroyed()) {
                inUseSet.add(window)
                this.inUse.set(domain, inUseSet)
                this.lastUsed.set(window, Date.now())
                
                if (show) {
                    window.show()
                }
                
                return window
            }
        }

        // Create a new window if pool is not full
        if (pool.length < this.MAX_WINDOWS_PER_DOMAIN) {
            const newWindowInstance = this.createWindow(show)
            pool.push(newWindowInstance)
            this.pools.set(domain, pool)
            inUseSet.add(newWindowInstance)
            this.inUse.set(domain, inUseSet)
            this.lastUsed.set(newWindowInstance, Date.now())
            
            return newWindowInstance
        }

        // If pool is full, wait for a window to become available or reuse the oldest
        // For simplicity, we'll reuse the first available window (shouldn't happen often)
        if (pool.length > 0) {
            const window = pool[0]
            if (!window.isDestroyed()) {
                inUseSet.add(window)
                this.inUse.set(domain, inUseSet)
                this.lastUsed.set(window, Date.now())
                
                if (show) {
                    window.show()
                }
                
                return window
            }
        }

        // Fallback: create a new window even if pool is full
        const newWindowInstance = this.createWindow(show)
        pool.push(newWindowInstance)
        this.pools.set(domain, pool)
        inUseSet.add(newWindowInstance)
        this.inUse.set(domain, inUseSet)
        this.lastUsed.set(newWindowInstance, Date.now())
        
        return newWindowInstance
    }

    /**
     * Return a BrowserWindow to the pool
     * @param domain - Domain name
     * @param window - BrowserWindow to return
     * @param keepVisible - If true, keep the window visible when returning to pool (default: false)
     */
    release(domain: string, window: BrowserWindow, keepVisible: boolean = false): void {
        const inUseSet = this.inUse.get(domain)
        if (inUseSet) {
            inUseSet.delete(window)
            this.lastUsed.set(window, Date.now())
        }

        // Hide the window when returning to pool (unless keepVisible is true)
        if (!keepVisible && !window.isDestroyed() && window.isVisible()) {
            window.hide()
        }
    }

    /**
     * Clear all cache for Electron window
     */
    async clearAllCache(mainWindow: BrowserWindow) {
        const ses = mainWindow.webContents.session
        
        try {
            // 1. Clear HTTP cache
            await ses.clearCache()
            console.log('HTTP cache cleared')
            
            // 2. Clear all storage data
            await ses.clearStorageData({
            storages: [
                'cookies',
                'cookies', 
                'filesystem',
                'indexdb',
                'localstorage',
                'shadercache',
                'websql',
                'serviceworkers',
                'cachestorage'
            ],
            quotas: ['temporary']
            })
            console.log('Storage data cleared')
            
            // 3. Clear preloaded code cache
            await ses.clearCodeCaches({})
            console.log('Code cache cleared')
            
            // 4. Clear network-related data
            await ses.clearHostResolverCache()
            console.log('DNS resolver cache cleared')
            
            // 5. Force reload (optional)
            mainWindow.webContents.reloadIgnoringCache()
            
            return true
        } catch (error) {
            console.error('Failed to clear cache:', error)
            return false
        }
    }

    /**
     * Create a new BrowserWindow
     */
    private createWindow(show: boolean = false): BrowserWindow {
        // Get preload path
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = dirname(__filename)
        // const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
        // const preloadPath = isDev
        //     ? path.join(__dirname, '../../preload/preload.js')
        //     : path.join(process.resourcesPath || __dirname, 'preload/preload.js')
        // console.log('preloadPath',isDev, __dirname, preloadPath)
        const preloadPath = path.join(__dirname, '../preload/preload.js')
        const window = new BrowserWindow({
            show,
            width: 1280,
            height: 720,
            frame: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                preload: preloadPath,
                // Enable experimental features
                // experimentalFeatures: true,
                // Enable WebGL
                webgl: true,
                // devTools: true
            }
        })

        // Load a blank page first after creation to avoid residual content
        window.loadURL('about:blank')

        // Remove menu bar
        Menu.setApplicationMenu(null)

        // this.clearAllCache(window)

        // Handle new window requests - navigate in current window instead
        window.webContents.setWindowOpenHandler(({ url }) => {
            // Navigate current window to the new URL instead of opening new window
            window.loadURL(url)
            return { action: 'deny' } // Deny creating new window
        })

        // Inject custom toolbar when page is ready
        window.webContents.once('did-finish-load', () => {
            console.log("did-finish-load")
            this.injectNavigationToolbar(window)
        })

        // Re-inject toolbar on navigation
        window.webContents.on('did-navigate', () => {
            console.log('did-navigate')
            setTimeout(() => {
                this.injectNavigationToolbar(window)
            }, 200)
        })

        window.webContents.on('did-navigate-in-page', () => {
            console.log('did-navigate-in-page')
            setTimeout(() => {
                window.webContents.executeJavaScript(`(function() {
                    const toolbar = document.body.querySelector('.webpilot-navigation-toolbar')
                    return toolbar ? true : false
                })()`).then(result => {
                    if (!result) {
                        this.injectNavigationToolbar(window)
                    }
                })
            }, 3000)
        })

        // Handle window close
        window.on('closed', () => {
            this.removeWindow(window)
        })

        // window.on('ready-to-show', () => {
        //     window.webContents.openDevTools()
        // })

        // Helper function to find fullChatWindow
        const findFullChatWindow = (): BrowserWindow | null => {
            const allWindows = BrowserWindow.getAllWindows()
            for (const win of allWindows) {
                if (!win.isDestroyed()) {
                    const url = win.webContents.getURL()
                    if (url.includes('fullChat.html')) {
                        return win
                    }
                }
            }
            return null
        }

        // Notify fullChatWindow when this window starts moving
        window.on('move', () => {
            const fullChatWindow = findFullChatWindow()
            if (fullChatWindow && !fullChatWindow.isDestroyed()) {
                fullChatWindow.webContents.send('window-move-status', 'webPilot', 'start')
            }
        })

        // Notify fullChatWindow when this window finishes moving
        window.on('moved', () => {
            const fullChatWindow = findFullChatWindow()
            if (fullChatWindow && !fullChatWindow.isDestroyed()) {
                fullChatWindow.webContents.send('window-move-status', 'webPilot', 'end')
            }
        })

        return window
    }

    /**
     * Inject navigation toolbar at the bottom center of the page
     */
    injectNavigationToolbar(window: BrowserWindow, generatedCode: {code: String; name: String} | null = null): void {
        // Get current URL and scripts before injecting
        const currentUrl = window.webContents.getURL()
        let currentCleanUrl = ''
        let currentScript: string | null = null
        let allScripts: Array<{ scriptId: string, scriptName: string, script: string, cleanUrls: string[] }> = []
        
        try {
            if (currentUrl && currentUrl !== 'about:blank') {
                currentCleanUrl = getCleanUrl(currentUrl)
                // Find matching script
                const matchingScript = this.scriptStorage.findMatchingScript(currentCleanUrl, matchCleanUrls)
                if (matchingScript) {
                    currentScript = matchingScript.script
                }
            }
            allScripts = this.scriptStorage.getAllScripts()
        } catch (error) {
            console.error('[BrowserPool] Error getting scripts:', error)
        }

        // Inject CSS for navigation toolbar
        window.webContents.insertCSS(`
            /* Navigation Toolbar - Fixed at bottom center */
            .webpilot-navigation-toolbar {
                position: fixed;
                bottom: 16px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(0, 0, 0, 0.1);
                border-radius: 24px;
                padding: 8px 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 999997;
                user-select: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                transition: opacity 0.3s ease;
            }
            
            .webpilot-navigation-toolbar:hover {
                opacity: 1;
            }
            
            .webpilot-toolbar-button {
                width: 30px;
                height: 30px;
                border: none;
                background: transparent;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background-color 0.2s, transform 0.1s;
                color: #5f6368;
                position: relative;
            }
            
            .webpilot-toolbar-button:hover {
                background-color: rgba(0, 0, 0, 0.08);
                // transform: scale(1.05);
            }
            
            .webpilot-toolbar-button:active {
                // transform: scale(0.95);
            }
            
            .webpilot-toolbar-button:disabled {
                opacity: 0.4;
                cursor: not-allowed;
                transform: none;
            }
            
            .webpilot-toolbar-button svg {
                width: 20px;
                height: 20px;
                fill: currentColor;
            }
            
            .webpilot-toolbar-button.active {
                color: #5BCFD1;
                font-weight: bold;
                background-color: rgba(91, 207, 209, 0.1);
            }

            .webpilot-toolbar-button.active:hover {
                background-color: rgba(91, 207, 209, 0.2);
            }
            
            /* Divider between buttons */
            .webpilot-toolbar-divider {
                width: 1px;
                height: 24px;
                background: rgba(0, 0, 0, 0.12);
                margin: 0 4px;
            }
            
            /* Effect dropdown menu */
            .webpilot-effect-dropdown {
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                margin-bottom: 8px;
                background: white;
                border: 1px solid rgba(0, 0, 0, 0.1);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                min-width: 200px;
                max-width: 300px;
                max-height: 220px;
                overflow-y: auto;
                z-index: 1000000;
                display: none;
            }

            .webpilot-effect-dropdown::-webkit-scrollbar {
                display: none;
            }
            
            .webpilot-effect-dropdown.show {
                display: block;
            }
            
            .webpilot-effect-dropdown-item {
                padding: 10px 14px 10px 14px;
                cursor: pointer;
                border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                font-size: 13px;
                color: #333;
                transition: background-color 0.2s;
                word-break: break-all;
                position: relative;
                display: flex;
                font-weight: 400;
                // align-items: center;
                // justify-content: space-between;
            }
            
            .webpilot-effect-dropdown-item:last-child {
                border-bottom: none;
            }
            
            .webpilot-effect-dropdown-item:hover {
                background-color: rgba(91, 207, 209, 0.1);
            }
            
            .webpilot-effect-dropdown-item.clear-effect {
                color: #5BCFD1;
                font-weight: 500;
            }
            
            .webpilot-effect-dropdown-item-text {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                text-align: left;
                line-height: 16px;
            }
            
            .webpilot-effect-dropdown-item-delete {
                display: none;
                width: 15px;
                height: 15px;
                padding: 0px;
                margin-left: 2px;
                margin-top: 1px;
                cursor: pointer;
                opacity: 0.6;
                transition: opacity 0.2s;
                flex-shrink: 0;
            }
            
            .webpilot-effect-dropdown-item:hover .webpilot-effect-dropdown-item-delete {
                display: block;
            }
            
            .webpilot-effect-dropdown-item-delete:hover {
                opacity: 1;
            }
            
            .webpilot-effect-dropdown-item-delete svg {
                width: 100%;
                height: 100%;
                fill: #999;
            }
            
            .webpilot-effect-dropdown-item-copy {
                display: none;
                width: 13px;
                height: 13px;
                padding: 0px;
                margin-left: 2px;
                margin-top: 1px;
                cursor: pointer;
                opacity: 0.6;
                transition: opacity 0.2s;
                flex-shrink: 0;
            }
            
            .webpilot-effect-dropdown-item:hover .webpilot-effect-dropdown-item-copy {
                display: block;
            }
            
            .webpilot-effect-dropdown-item-copy:hover {
                opacity: 1;
            }
            
            .webpilot-effect-dropdown-item-copy svg {
                width: 100%;
                height: 100%;
                fill: #999;
            }
            
            .webpilot-effect-dropdown-item-confirm {
                display: none;
                gap: 6px;
                position: absolute;
                right: 14px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 10;
                padding: 2px 0px;
                border-radius: 4px;
            }
            
                            .webpilot-effect-dropdown-item.confirming .webpilot-effect-dropdown-item-delete,
            .webpilot-effect-dropdown-item.confirming .webpilot-effect-dropdown-item-copy {
                display: none;
            }
            
            .webpilot-effect-dropdown-item.confirming .webpilot-effect-dropdown-item-confirm {
                display: flex;
            }
            
            .webpilot-effect-dropdown-item.confirming .webpilot-effect-dropdown-item-text {
                opacity: 0.6;
            }
            
            .webpilot-effect-dropdown-item-confirm-btn {
                padding: 0px 6px;
                height: 24px;
                line-height: 24px;
                font-size: 12px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: background-color 0.2s, opacity 0.2s;
                white-space: nowrap;
                box-shadow: 0 0px 4px rgba(0, 0, 0, 0.1);
            }
            
            .webpilot-effect-dropdown-item-confirm-btn.cancel {
                background-color: #ffffff;
                color: #333;
            }
            
            .webpilot-effect-dropdown-item-confirm-btn.cancel:hover {
                background-color: #f5f5f5;
            }
            
            .webpilot-effect-dropdown-item-confirm-btn.delete {
                background-color:rgb(230, 55, 55);
                color: white;
            }
            
            .webpilot-effect-dropdown-item-confirm-btn.delete:hover {
                background-color: #d32f2f;
            }
        `).catch(err => {
            console.error('[BrowserPool] Failed to inject toolbar CSS:', err)
        })

        // Prepare script data for injection with i18n translations
        // Get translations without parameter replacement to preserve placeholders
        const i18nTexts = {
            deleteScript: t('tools.webPilot.deleteScript'),
            cancel: t('tools.webPilot.cancel'),
            delete: t('tools.webPilot.delete'),
            deleteFailed: t('tools.webPilot.deleteFailed'), // Keep {{error}} placeholder
            back: t('tools.webPilot.back'),
            forward: t('tools.webPilot.forward'),
            reload: t('tools.webPilot.reload'),
            effect: t('tools.webPilot.effect'),
            clearEffect: t('tools.webPilot.clearEffect'),
            noSavedScripts: t('tools.webPilot.noSavedScripts'),
            unnamedScript: t('tools.webPilot.unnamedScript'),
            saveCode: t('tools.webPilot.saveCode'),
            saving: t('tools.webPilot.saving'),
            saved: t('tools.webPilot.saved'),
            save: t('tools.webPilot.save')
        }
        
        const scriptData = JSON.stringify({
            currentScript: currentScript,
            allScripts: allScripts,
            currentCleanUrl: currentCleanUrl,
            generatedCode: generatedCode,
            i18n: i18nTexts
        })

        // Inject JavaScript to create navigation toolbar
        window.webContents.executeJavaScript(`
            (function() {
                // Script data passed from main process
                const scriptData = ${scriptData};
                let currentAppliedScript = scriptData.currentScript || null;
                let allScripts = scriptData.allScripts || [];
                const i18n = scriptData.i18n || {};

                // remove browser tips for bilibili
                if (document.querySelector('.browser-tip')) {
                    document.querySelector('.browser-tip').remove();
                }
                
                // Helper function to get translation
                function t(key, error) {
                    let translation = i18n[key] || key;
                    // Replace placeholders
                    if (error !== undefined) {
                        translation = translation.replace(/\\{\\{error\\}\\}/g, error || '');
                    }
                    return translation;
                }

                // Helper to build SVG icons without innerHTML (Trusted Types / CSP safe)
                const svgNS = 'http://www.w3.org/2000/svg';
                function createSvgIcon(pathD, viewBox = '0 0 24 24', fill = 'currentColor', stroke = 'none', strokeWidth = '1.5') {
                    const svg = document.createElementNS(svgNS, 'svg');
                    svg.setAttribute('viewBox', viewBox);
                    const path = document.createElementNS(svgNS, 'path');
                    path.setAttribute('d', pathD);
                    path.setAttribute('fill', fill);
                    path.setAttribute('stroke', stroke);
                    path.setAttribute('stroke-width', strokeWidth);
                    svg.appendChild(path);
                    return svg;
                }

                function replaceContentWithIcon(el, pathD, viewBox = '0 0 24 24', fill = 'currentColor', stroke = 'none', strokeWidth = '1') {
                    if (!el) return;
                    while (el.firstChild) {
                        el.removeChild(el.firstChild);
                    }
                    const svg = createSvgIcon(pathD, viewBox, fill, stroke, strokeWidth)
                    el.appendChild(svg);
                    return svg
                }
                
                // Helper function to get clean URL
                function getCleanUrl(url) {
                    try {
                        if (!url.startsWith('http://') && !url.startsWith('https://')) {
                            return url;
                        }
                        const urlObj = new URL(url);
                        let cleanUrl = urlObj.protocol + '//' + urlObj.hostname;
                        if (urlObj.pathname) {
                            const path = urlObj.pathname.replace(/\\/+$/, '');
                            cleanUrl += path || '';
                        }
                        return cleanUrl;
                    } catch (error) {
                        let cleanUrl = url.split('?')[0].split('#')[0];
                        cleanUrl = cleanUrl.replace(/\\/+$/, '');
                        return cleanUrl;
                    }
                }

                const myTrustedPolicy = window.trustedTypes?.createPolicy('webpilot-policy', {
                    createScript: (script) => script, // Directly trust the incoming script string
                    createHTML: (html) => html,
                });
                
                // Helper function to execute script
                function executeScript(script) {
                    try {
                        if (!script) return;
                        
                        // Remove existing script tag
                        const existingScript = document.querySelector('script[data-webpilot-executed]');
                        if (existingScript) existingScript.remove();
                        
                        // Create script tag
                        const scriptTag = document.createElement('script');
                        scriptTag.setAttribute('data-webpilot-executed', 'true');
                        
                        // Create trusted script using Trusted Types policy
                        const trustedScript = myTrustedPolicy ? 
                            myTrustedPolicy.createScript(script) : script;
                        
                        // Set script content
                        scriptTag.textContent = trustedScript;
                        
                        document.body.appendChild(scriptTag);
                        return null;
                    } catch (error) {
                        console.error('Error executing script:', error);
                        return null;
                    }
                }
                
                // Helper function to clear script
                function clearScript() {
                    const existingScript = document.querySelector('script[data-webpilot-executed]');
                    if (existingScript) {
                        existingScript.remove();
                    }
                    currentAppliedScript = null;
                    
                    // Remove cleanUrl association from script storage
                    const currentCleanUrl = scriptData.currentCleanUrl;
                    if (currentCleanUrl && window.electronAPI && window.electronAPI.removeScriptAssociation) {
                        window.electronAPI.removeScriptAssociation(currentCleanUrl).then(() => {
                            // Remove from local allScripts to update dropdown immediately
                            // allScripts = allScripts.map(entry => ({
                            //     ...entry,
                            //     cleanUrls: entry.cleanUrls.filter(url => url !== currentCleanUrl)
                            // })).filter(entry => entry.cleanUrls.length > 0);
                            window.location.reload();
                        }).catch((error) => {
                            console.error('Error removing script association:', error);
                        });
                    }
                }
                
                // Remove existing toolbar if any
                const existing = document.querySelector('.webpilot-navigation-toolbar');
                if (existing) {
                    existing.remove();
                }
                
                // Create toolbar element
                const toolbar = document.createElement('div');
                toolbar.className = 'webpilot-navigation-toolbar';
                toolbar.id = 'webpilot-navigation-toolbar';
                
                // Create back button
                const backBtn = document.createElement('button');
                backBtn.className = 'webpilot-toolbar-button';
                backBtn.title = t('back');
                const backBtnIcon = replaceContentWithIcon(backBtn, 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z');
                backBtnIcon.style.width = '20px';
                backBtnIcon.style.height = '20px';
                backBtn.onclick = () => {
                    if (window.history.length > 1) {
                        window.history.back();
                    }
                };
                
                // Create forward button
                const forwardBtn = document.createElement('button');
                forwardBtn.className = 'webpilot-toolbar-button';
                forwardBtn.title = t('forward');
                const forwardBtnIcon = replaceContentWithIcon(forwardBtn, 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z');
                forwardBtnIcon.style.width = '20px';
                forwardBtnIcon.style.height = '20px';
                forwardBtn.onclick = () => {
                    window.history.forward();
                };
                
                // Create divider
                const divider = document.createElement('div');
                divider.className = 'webpilot-toolbar-divider';
                
                // Create reload button
                const reloadBtn = document.createElement('button');
                reloadBtn.className = 'webpilot-toolbar-button';
                reloadBtn.title = t('reload');
                const reloadBtnIcon = replaceContentWithIcon(reloadBtn, 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z');
                reloadBtnIcon.style.width = '21px';
                reloadBtnIcon.style.height = '21px';
                reloadBtn.onclick = () => {
                    window.location.reload();
                };
                
                // Create divider 2
                const divider2 = document.createElement('div');
                divider2.className = 'webpilot-toolbar-divider';
                
                // Create effect button
                const effectBtn = document.createElement('button');
                effectBtn.className = 'webpilot-toolbar-button';
                effectBtn.title = t('effect');
                replaceContentWithIcon(effectBtn, 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z');
                
                // Create effect dropdown
                const dropdown = document.createElement('div');
                dropdown.className = 'webpilot-effect-dropdown';
                
                // Update dropdown content
                function updateDropdown() {
                    dropdown.textContent = '';

                    // Add clear effect option if script is applied
                    if (currentAppliedScript) {
                        const clearItem = document.createElement('div');
                        clearItem.className = 'webpilot-effect-dropdown-item clear-effect';
                        clearItem.textContent = t('clearEffect');
                        clearItem.onclick = () => {
                            clearScript();
                            updateEffectButton();
                            // Update dropdown to reflect the removal
                            setTimeout(() => {
                                updateDropdown();
                            }, 100);
                            dropdown.classList.remove('show');
                        };
                        dropdown.appendChild(clearItem);
                    }
                    
                    // Add saved scripts
                    // const scriptEntries = allScripts.flatMap(entry => 
                    //     entry.cleanUrls.map(cleanUrl => ({ cleanUrl, entry }))
                    // );
                    if (allScripts.length === 0) {
                        const noScriptsItem = document.createElement('div');
                        noScriptsItem.className = 'webpilot-effect-dropdown-item';
                        noScriptsItem.textContent = t('noSavedScripts');
                        noScriptsItem.style.color = '#999';
                        noScriptsItem.style.cursor = 'default';
                        dropdown.appendChild(noScriptsItem);
                    } else {
                        allScripts.forEach(entry => {
                            const item = document.createElement('div');
                            item.className = 'webpilot-effect-dropdown-item';
                            
                            // Create text container
                            const textContainer = document.createElement('div');
                            textContainer.className = 'webpilot-effect-dropdown-item-text';
                            // Use scriptName if available, otherwise use translation
                            const displayText = entry.scriptName || t('unnamedScript');
                            textContainer.textContent = displayText;
                            textContainer.title = displayText;
                            
                            // Create copy button
                            const copyBtn = document.createElement('div');
                            copyBtn.className = 'webpilot-effect-dropdown-item-copy';
                            replaceContentWithIcon(copyBtn, 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z');
                            copyBtn.title = t('copyScript') || 'Copy script';
                            
                            // Create delete button
                            const deleteBtn = document.createElement('div');
                            deleteBtn.className = 'webpilot-effect-dropdown-item-delete';
                            replaceContentWithIcon(deleteBtn, 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z');
                            deleteBtn.title = t('deleteScript');
                            
                            // Create confirm buttons container
                            const confirmContainer = document.createElement('div');
                            confirmContainer.className = 'webpilot-effect-dropdown-item-confirm';
                            
                            // Create cancel button
                            const cancelBtn = document.createElement('button');
                            cancelBtn.className = 'webpilot-effect-dropdown-item-confirm-btn cancel';
                            cancelBtn.textContent = t('cancel');
                            cancelBtn.title = t('cancel');
                            
                            // Create delete confirm button
                            const deleteConfirmBtn = document.createElement('button');
                            deleteConfirmBtn.className = 'webpilot-effect-dropdown-item-confirm-btn delete';
                            deleteConfirmBtn.textContent = t('delete');
                            deleteConfirmBtn.title = t('delete');
                            
                            confirmContainer.appendChild(cancelBtn);
                            confirmContainer.appendChild(deleteConfirmBtn);
                            
                            // Add click handler for item (apply script)
                            item.onclick = () => {
                                // Don't apply script if in confirming state
                                if (item.classList.contains('confirming')) {
                                    return;
                                }
                                // executeScript(entry.script);
                                currentAppliedScript = entry.script;
                                updateEffectButton();
                                dropdown.classList.remove('show');
                                
                                // Save script association with current URL
                                const currentUrl = window.location.href;
                                const currentCleanUrl = getCleanUrl(currentUrl);
                                if (currentCleanUrl && window.electronAPI && window.electronAPI.saveScript) {
                                    window.electronAPI.saveScript(currentCleanUrl, entry.script, entry.scriptName || currentCleanUrl)
                                        .then((result) => {
                                            if (result && result.success) {
                                                console.log('Script association saved successfully');
                                                window.location.reload();
                                            }
                                        })
                                        .catch((error) => {
                                            console.error('Error saving script association:', error);
                                        });
                                }
                            };
                            
                            // Add click handler for copy button
                            copyBtn.onclick = async (e) => {
                                e.stopPropagation(); // Prevent triggering item click
                                const originalIconPath = 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z';
                                const checkmarkIconPath = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';
                                const originalTitle = copyBtn.title;
                                
                                try {
                                    await navigator.clipboard.writeText(entry.script);
                                    // Change icon to checkmark and update title
                                    replaceContentWithIcon(copyBtn, checkmarkIconPath);
                                    copyBtn.title = t('copied') || 'Copied!';
                                    setTimeout(() => {
                                        replaceContentWithIcon(copyBtn, originalIconPath);
                                        copyBtn.title = originalTitle;
                                    }, 2000);
                                } catch (error) {
                                    console.error('Failed to copy script:', error);
                                    // Fallback for older browsers
                                    const textArea = document.createElement('textarea');
                                    textArea.value = entry.script;
                                    textArea.style.position = 'fixed';
                                    textArea.style.opacity = '0';
                                    document.body.appendChild(textArea);
                                    textArea.select();
                                    try {
                                        document.execCommand('copy');
                                        // Change icon to checkmark and update title
                                        replaceContentWithIcon(copyBtn, checkmarkIconPath);
                                        copyBtn.title = t('copied') || 'Copied!';
                                        setTimeout(() => {
                                            replaceContentWithIcon(copyBtn, originalIconPath);
                                            copyBtn.title = originalTitle;
                                        }, 2000);
                                    } catch (err) {
                                        console.error('Fallback copy failed:', err);
                                        alert(t('copyFailed') || 'Failed to copy script');
                                    }
                                    document.body.removeChild(textArea);
                                }
                            };
                            
                            // Add click handler for delete button (show confirm buttons)
                            deleteBtn.onclick = (e) => {
                                e.stopPropagation(); // Prevent triggering item click
                                // Show confirm buttons
                                item.classList.add('confirming');
                            };
                            
                            // Add click handler for cancel button
                            cancelBtn.onclick = (e) => {
                                e.stopPropagation(); // Prevent triggering item click
                                // Hide confirm buttons
                                item.classList.remove('confirming');
                            };
                            
                            // Add click handler for delete confirm button
                            deleteConfirmBtn.onclick = (e) => {
                                e.stopPropagation(); // Prevent triggering item click
                                if (window.electronAPI && window.electronAPI.deleteScriptById) {
                                    window.electronAPI.deleteScriptById(entry.scriptId)
                                        .then((result) => {
                                            if (result && result.success) {
                                                console.log('Script deleted successfully');
                                                // Remove from local allScripts
                                                allScripts = allScripts.filter(e => e.scriptId !== entry.scriptId);
                                                // Update dropdown
                                                updateDropdown();
                                            } else {
                                                alert(t('deleteFailed', result?.error || 'Unknown error'));
                                                // Hide confirm buttons on error
                                                item.classList.remove('confirming');
                                            }
                                        })
                                        .catch((error) => {
                                            console.error('Error deleting script:', error);
                                            alert(t('deleteFailed', error.message || 'Unknown error'));
                                            // Hide confirm buttons on error
                                            item.classList.remove('confirming');
                                        });
                                }
                            };
                            
                            item.appendChild(textContainer);
                            item.appendChild(copyBtn);
                            item.appendChild(deleteBtn);
                            item.appendChild(confirmContainer);
                            dropdown.appendChild(item);
                        });
                    }
                }
                
                // Toggle dropdown handler
                const toggleDropdown = (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('show');
                    if (dropdown.classList.contains('show')) {
                        updateDropdown();
                    }
                };
                
                // Update effect button state
                function updateEffectButton() {
                    if (currentAppliedScript) {
                        effectBtn.classList.add('active');
                        // Use filled icon
                        effectBtn.textContent = 'JS'
                        // effectBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
                    } else {
                        effectBtn.classList.remove('active');
                        // Use outline icon
                        replaceContentWithIcon(effectBtn, 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z');
                    }
                    // Re-bind onclick after innerHTML update (innerHTML clears event listeners)
                    effectBtn.onclick = toggleDropdown;
                }
                
                // Toggle dropdown
                effectBtn.onclick = toggleDropdown;
                
                // Close dropdown when clicking outside
                document.addEventListener('click', (e) => {
                    if (!effectBtn.contains(e.target) && !dropdown.contains(e.target)) {
                        dropdown.classList.remove('show');
                    }
                });
                
                // Position dropdown relative to button
                effectBtn.style.position = 'relative';
                dropdown.style.position = 'absolute';
                
                // Update button states - simplified approach
                const updateButtonStates = () => {
                    const hasHistory = window.history.length > 1 || document.referrer;
                    backBtn.disabled = !hasHistory;
                    forwardBtn.disabled = false;
                };
                
                // Update states on navigation
                window.addEventListener('popstate', updateButtonStates);
                
                // Check if script already exists in page (from previous injection)
                const existingScriptTag = document.querySelector('script[data-webpilot-executed]');
                if (existingScriptTag && existingScriptTag.textContent) {
                    currentAppliedScript = existingScriptTag.textContent;
                } else if (currentAppliedScript) {
                    // Apply script if available on page load
                    executeScript(currentAppliedScript);
                }
                updateEffectButton();
                
                // Append buttons to toolbar
                toolbar.appendChild(backBtn);
                toolbar.appendChild(forwardBtn);
                toolbar.appendChild(divider);
                toolbar.appendChild(reloadBtn);
                // scriptData.generatedCode = {code: 'console.log("Hello, world!");', name: 'Hello, world!'};
                if (scriptData.generatedCode) {
                    toolbar.appendChild(divider2);
                    // Create save button for generated code
                    const saveBtn = document.createElement('button');
                    saveBtn.className = 'webpilot-toolbar-button';
                    saveBtn.style.padding = '7px';
                    saveBtn.title = t('saveCode');
                    replaceContentWithIcon(
                        saveBtn, 
                        'M2 9.5a5.5 5.5 0 0 1 9.591-3.676a.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5', 
                        '0 0 24 24', 
                        'none',
                        'currentColor',
                        '2.5'
                    );
                    saveBtn.onclick = () => {
                        const currentUrl = window.location.href;
                        const currentCleanUrl = getCleanUrl(currentUrl);
                        const generatedCode = scriptData.generatedCode;
                        
                        if (currentCleanUrl && generatedCode && window.electronAPI && window.electronAPI.saveScript) {
                            // Disable button during save
                            saveBtn.disabled = true;
                            saveBtn.title = t('saving');
                            // Show loading state with opacity
                            saveBtn.style.opacity = '0.6';
                            
                            window.electronAPI.saveScript(currentCleanUrl, generatedCode.code, generatedCode.name || currentCleanUrl)
                                .then((result) => {
                                    if (result && result.success) {
                                        // Update button to saved state - show checkmark icon
                                        saveBtn.disabled = false;
                                        saveBtn.title = t('saved');
                                        saveBtn.style.opacity = '1';
                                        saveBtn.style.color = '#5BCFD1';
                                        saveBtn.style.cursor = 'default';
                                        // Change to checkmark icon
                                        replaceContentWithIcon(saveBtn, 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z');
                                        console.log('Generated code saved successfully');
                                    } else {
                                        // Reset button on error
                                        saveBtn.disabled = false;
                                        saveBtn.title = t('save');
                                        saveBtn.style.opacity = '1';
                                        saveBtn.style.color = '';
                                        replaceContentWithIcon(saveBtn, 'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z');
                                        console.error('Failed to save generated code:', result?.error || 'Unknown error');
                                    }
                                })
                                .catch((error) => {
                                    // Reset button on error
                                    saveBtn.disabled = false;
                                    saveBtn.title = t('save');
                                    saveBtn.style.opacity = '1';
                                    saveBtn.style.color = '';
                                    replaceContentWithIcon(saveBtn, 'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z');
                                    console.error('Error saving generated code:', error);
                                });
                        }
                    };
                    
                    toolbar.appendChild(saveBtn);
                } else if (allScripts.length > 0) {
                    toolbar.appendChild(divider2);
                    toolbar.appendChild(effectBtn);
                    effectBtn.appendChild(dropdown);
                }
                
                // Insert toolbar into body
                if (document.body) {
                    document.body.appendChild(toolbar);
                } else {
                    const checkBody = setInterval(() => {
                        if (document.body) {
                            document.body.appendChild(toolbar);
                            clearInterval(checkBody);
                        }
                    }, 50);
                }
            })();
        `).catch(err => {
            console.error('[BrowserPool] Failed to inject toolbar script:', err)
        })
    }

    /**
     * Remove a window from all pools
     */
    private removeWindow(window: BrowserWindow): void {
        this.lastUsed.delete(window)
        
        for (const [domain, pool] of this.pools.entries()) {
            const index = pool.indexOf(window)
            if (index !== -1) {
                pool.splice(index, 1)
            }

            const inUseSet = this.inUse.get(domain)
            if (inUseSet) {
                inUseSet.delete(window)
            }
        }
    }

    /**
     * Start cleanup timer to remove idle windows
     */
    private startCleanupTimer(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupIdleWindows()
        }, this.CLEANUP_INTERVAL)
    }

    /**
     * Clean up idle windows that haven't been used for a while
     */
    private cleanupIdleWindows(): void {
        const now = Date.now()
        
        for (const [domain, pool] of this.pools.entries()) {
            const inUseSet = this.inUse.get(domain) || new Set()
            
            for (let i = pool.length - 1; i >= 0; i--) {
                const window = pool[i]
                
                if (window.isDestroyed()) {
                    pool.splice(i, 1)
                    continue
                }

                // Close idle windows that are not in use
                if (!inUseSet.has(window)) {
                    const lastUsed = this.lastUsed.get(window) || 0
                    if (now - lastUsed > this.IDLE_TIMEOUT && !window.isVisible()) {
                        window.close()
                        pool.splice(i, 1)
                        this.lastUsed.delete(window)
                    }
                }
            }

            // Remove empty pools
            if (pool.length === 0) {
                this.pools.delete(domain)
                this.inUse.delete(domain)
            }
        }
    }

    /**
     * Close all windows and clear pools
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }

        for (const pool of this.pools.values()) {
            for (const window of pool) {
                if (!window.isDestroyed()) {
                    window.close()
                }
            }
        }

        this.pools.clear()
        this.inUse.clear()
        this.lastUsed.clear()
    }

    /**
     * Get pool statistics
     */
    getStats(): { domain: string; total: number; inUse: number; available: number }[] {
        const stats: { domain: string; total: number; inUse: number; available: number }[] = []
        
        for (const [domain, pool] of this.pools.entries()) {
            const inUseSet = this.inUse.get(domain) || new Set()
            const inUseCount = Array.from(pool).filter(w => inUseSet.has(w)).length
            
            stats.push({
                domain,
                total: pool.length,
                inUse: inUseCount,
                available: pool.length - inUseCount
            })
        }
        
        return stats
    }
}

// Singleton instance
export const browserWindowPool = new BrowserWindowPool()

// Export method to access ScriptStorage (used for accessing from other modules)
export function getScriptStorageForWindow(): ScriptStorage {
    return (browserWindowPool as any).scriptStorage
}

