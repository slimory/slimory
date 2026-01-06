import { BrowserWindow, app } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * Operation definition from JSON
 */
export interface Operation {
    name: string
    description: string
    code: string
    fallbackCode?: string
    waitConditions?: string[]
    parameters?: Record<string, {
        type: string
        required?: boolean
        description?: string
    }>
    timeout?: number,
    generatedAt?: string,
    errorHandling?: {
        retries?: number
        retryDelay?: number
    }
}

/**
 * Operation script structure
 */
export interface OperationScript {
    domain: string
    operations: Operation[]
}

/**
 * Operation execution result
 */
export interface OperationResult {
    success: boolean
    data?: any
    error?: string
    operationName: string
}

/**
 * Operation executor - loads and executes atomic operations
 */
export class OperationExecutor {
    private scripts: Map<string, OperationScript> = new Map()
    private commonScript: OperationScript | null = null

    /**
     * Load operation code from file if code field is a path, otherwise return as-is
     * Supports backward compatibility: if code doesn't end with .code.txt, treat it as inline code
     * Code files are stored in the 'codes' subdirectory
     */
    private loadOperationCode(operation: Operation, scriptDir: string): string {
        // If code ends with .code.txt, treat it as a file path
        if (operation.code.endsWith('.code.txt')) {
            // Try codes subdirectory first (new structure)
            let codePath = join(scriptDir, 'codes', operation.code)
            
            // If not found in codes directory, try old location (backward compatibility)
            if (!existsSync(codePath)) {
                codePath = join(scriptDir, operation.code)
            }
            
            if (existsSync(codePath)) {
                try {
                    const code = readFileSync(codePath, 'utf-8')
                    return code
                } catch (error) {
                    console.error(`[OperationExecutor] Failed to load code from ${codePath}:`, error)
                    return operation.code // Fallback to original
                }
            } else {
                console.warn(`[OperationExecutor] Code file not found: ${codePath}, using code as-is`)
                return operation.code // Fallback to original
            }
        }
        
        // If it's not a file path, return as-is (backward compatibility)
        return operation.code
    }

    /**
     * Load common operations script
     */
    private loadCommonScript(): OperationScript | null {
        if (this.commonScript) {
            return this.commonScript
        }

        try {
            const possiblePaths = this.getScriptPaths('common')
            let scriptPath: string | null = null
            
            for (const path of possiblePaths) {
                if (existsSync(path)) {
                    scriptPath = path
                    break
                }
            }

            if (!scriptPath) {
                // Try 'operations.json' in scripts root directory
                const cwd = process.cwd()
                const altPaths = [
                    join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'operations.json'),
                    join(cwd, 'src', 'tools', 'webPilot', 'scripts', 'operations.json')
                ]

                for (const path of altPaths) {
                    if (existsSync(path)) {
                        scriptPath = path
                        break
                    }
                }
            }

            if (!scriptPath) {
                console.warn('[OperationExecutor] Common operations script not found')
                return null
            }

            const scriptContent = readFileSync(scriptPath, 'utf-8')
            const script: OperationScript = JSON.parse(scriptContent)
            
            // Load code from files for each operation
            const scriptDir = dirname(scriptPath)
            if (script.operations) {
                script.operations = script.operations.map(op => ({
                    ...op,
                    code: this.loadOperationCode(op, scriptDir)
                }))
            }
            
            this.commonScript = script
            return script
        } catch (error) {
            console.error('[OperationExecutor] Failed to load common script:', error)
            return null
        }
    }

    /**
     * Get possible script paths for a domain
     * Domain-specific scripts are stored in scripts/domains/{domain}/
     * Common scripts are stored in scripts/operations.json
     */
    private getScriptPaths(domain: string): string[] {
        const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
        const possiblePaths: string[] = []
        const cwd = process.cwd()

        // Common scripts are in scripts/operations.json, not in domains folder
        if (domain === 'common') {
            if (isDev) {
                possiblePaths.push(
                    join(cwd, 'src', 'tools', 'webPilot', 'scripts', 'operations.json'),
                    join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'operations.json')
                )
            }

            // Try to get __dirname equivalent for compiled code
            let compiledDir: string | null = null
            try {
                // @ts-ignore - __dirname might be available in compiled code
                if (typeof __dirname !== 'undefined') {
                    // @ts-ignore
                    compiledDir = __dirname
                } else {
                    try {
                        const __filename = fileURLToPath(import.meta.url)
                        compiledDir = dirname(__filename)
                    } catch (e) {
                        // Ignore
                    }
                }
            } catch (e) {
                // Ignore
            }

            if (compiledDir) {
                possiblePaths.push(
                    join(compiledDir, '..', 'tools', 'webPilot', 'scripts', 'operations.json'),
                    join(compiledDir, 'tools', 'webPilot', 'scripts', 'operations.json'),
                    join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'operations.json')
                )
            }

            // Try various app paths (for production)
            const appPath = app.getAppPath()
            const resourcesPath = process.resourcesPath || appPath
            
            possiblePaths.push(
                join(appPath, 'tools', 'webPilot', 'scripts', 'operations.json'),
                join(appPath, 'dist-electron', 'tools', 'webPilot', 'scripts', 'operations.json'),
                join(resourcesPath, 'tools', 'webPilot', 'scripts', 'operations.json'),
                join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'operations.json')
            )
        } else {
            // Domain-specific scripts are in scripts/domains/{domain}/
            if (isDev) {
                possiblePaths.push(
                    join(cwd, 'src', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json'),
                    join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json')
                )
            }

            // Try to get __dirname equivalent for compiled code
            let compiledDir: string | null = null
            try {
                // @ts-ignore - __dirname might be available in compiled code
                if (typeof __dirname !== 'undefined') {
                    // @ts-ignore
                    compiledDir = __dirname
                } else {
                    try {
                        const __filename = fileURLToPath(import.meta.url)
                        compiledDir = dirname(__filename)
                    } catch (e) {
                        // Ignore
                    }
                }
            } catch (e) {
                // Ignore
            }

            if (compiledDir) {
                possiblePaths.push(
                    join(compiledDir, '..', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json'),
                    join(compiledDir, 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json'),
                    join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json')
                )
            }

            // Try various app paths (for production)
            const appPath = app.getAppPath()
            const resourcesPath = process.resourcesPath || appPath
            
            possiblePaths.push(
                join(appPath, 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json'),
                join(appPath, 'dist-electron', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json'),
                join(resourcesPath, 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json'),
                join(cwd, 'dist-electron', 'tools', 'webPilot', 'scripts', 'domains', domain, 'operations.json')
            )
        }

        return possiblePaths
    }

    /**
     * Load operations script for a domain (merged with common operations)
     */
    loadScript(domain: string): OperationScript | null {
        if (this.scripts.has(domain)) {
            return this.scripts.get(domain)!
        }

        try {
            let domainScript: OperationScript | null = null
            if (domain) {
                // Load domain-specific script
                const possiblePaths = this.getScriptPaths(domain)
                let scriptPath: string | null = null

                for (const path of possiblePaths) {
                    if (existsSync(path)) {
                        scriptPath = path
                        break
                    }
                }

                let scriptDir: string | null = null

                if (scriptPath) {
                    const scriptContent = readFileSync(scriptPath, 'utf-8')
                    domainScript = JSON.parse(scriptContent)
                    scriptDir = dirname(scriptPath)
                    
                    // Load code from files for each operation
                    if (domainScript && domainScript.operations && scriptDir !== null) {
                        const dir = scriptDir // TypeScript now knows scriptDir is not null
                        domainScript.operations = domainScript.operations.map(op => ({
                            ...op,
                            code: this.loadOperationCode(op, dir)
                        }))
                    }
                }
            }

            // Load common operations
            const commonScript = this.loadCommonScript()

            // Merge operations: domain-specific operations take priority
            const mergedOperations: Operation[] = []
            const operationMap = new Map<string, Operation>()

            // First, add common operations
            if (commonScript && commonScript.operations) {
                for (const op of commonScript.operations) {
                    operationMap.set(op.name, op)
                }
            }

            // Then, add/override with domain-specific operations
            if (domainScript && domainScript.operations) {
                for (const op of domainScript.operations) {
                    // Set fallbackCode from common operations if available
                    const commonOp = commonScript?.operations?.find(co => co.name === op.name)
                    if (commonOp) {
                        op.fallbackCode = commonOp.code
                    }
                    operationMap.set(op.name, op)
                }
            }

            // Convert map to array
            mergedOperations.push(...Array.from(operationMap.values()))

            // Create merged script
            const mergedScript: OperationScript = {
                domain: domain,
                operations: mergedOperations
            }

            this.scripts.set(domain, mergedScript)
            return mergedScript
        } catch (error) {
            console.error(`[OperationExecutor] Failed to load script for ${domain}:`, error)
            // Fallback to common script only
            return this.loadCommonScript()
        }
    }

    /**
     * Get an operation by name from a domain's script
     */
    getOperation(domain: string, operationName: string): Operation | null {
        const script = this.loadScript(domain)
        if (!script) {
            return null
        }

        return script.operations.find(op => op.name === operationName) || null
    }

    /**
     * Execute an operation in a BrowserWindow
     */
    async executeOperation(
        window: BrowserWindow,
        domain: string,
        operationName: string,
        params: Record<string, any> = {}
    ): Promise<OperationResult> {
        const operation = this.getOperation(domain, operationName)
        
        if (!operation) {
            return {
                success: false,
                error: `Operation "${operationName}" not found for domain "${domain}"`,
                operationName
            }
        }

        // Validate parameters
        const validationError = this.validateParameters(operation, params)
        if (validationError) {
            return {
                success: false,
                error: validationError,
                operationName
            }
        }

        // Replace parameters in code
        let code = operation.code
        for (const [key, value] of Object.entries(params)) {
            const placeholder = `{{${key}}}`
            // Special handling for 'code' parameter in executeScript: use JSON.stringify to safely escape the code string
            if (key === 'code' && operationName === 'executeScript') {
                code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), JSON.stringify(String(value)))
            } else {
                code = code.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value))
            }
        }

        const retries = operation.errorHandling?.retries || 3
        const retryDelay = operation.errorHandling?.retryDelay || 1000
        const timeout = operation.timeout || 10000

        // Retry logic
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                // Wait for page to be ready
                await this.waitForPageReady(window)
                // Execute the operation code
                let result = await Promise.race([
                    window.webContents.executeJavaScript(code),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Operation timeout')), timeout)
                    )
                ]) as any

                // If operation failed and fallbackCode is available, try fallback
                if (result?.success === false && operation.fallbackCode) {
                    console.log('use fallbackCode')
                    // Replace parameters in fallback code
                    let fallbackCode = operation.fallbackCode
                    for (const [key, value] of Object.entries(params)) {
                        const placeholder = `{{${key}}}`
                        // Special handling for 'code' parameter in executeScript: use JSON.stringify to safely escape the code string
                        if (key === 'code' && operationName === 'executeScript') {
                            fallbackCode = fallbackCode.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), JSON.stringify(String(value)))
                        } else {
                            fallbackCode = fallbackCode.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value))
                        }
                    }
                    
                    // Execute fallback code
                    result = await Promise.race([
                        window.webContents.executeJavaScript(fallbackCode),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Fallback operation timeout')), timeout)
                        )
                    ]) as any
                }

                // Wait for conditions
                if (operation.waitConditions && operation.waitConditions.length > 0) {
                    await this.waitForConditions(window, operation.waitConditions, timeout)
                }

                return {
                    success: result?.success !== false,
                    data: result,
                    operationName
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)
                console.error(`[OperationExecutor] Operation "${operationName}" attempt ${attempt + 1} failed:`, errorMessage)

                if (attempt < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay))
                    continue
                }

                return {
                    success: false,
                    error: errorMessage,
                    operationName
                }
            }
        }

        return {
            success: false,
            error: 'Operation failed after all retries',
            operationName
        }
    }

    /**
     * Validate operation parameters
     */
    private validateParameters(operation: Operation, params: Record<string, any>): string | null {
        if (!operation.parameters) {
            return null
        }

        for (const [paramName, paramDef] of Object.entries(operation.parameters)) {
            if (paramDef.required && !(paramName in params)) {
                return `Required parameter "${paramName}" is missing`
            }

            if (paramName in params) {
                const value = params[paramName]
                const expectedType = paramDef.type

                if (expectedType === 'string' && typeof value !== 'string') {
                    return `Parameter "${paramName}" must be a string`
                } else if (expectedType === 'number' && typeof value !== 'number') {
                    return `Parameter "${paramName}" must be a number`
                } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
                    return `Parameter "${paramName}" must be a boolean`
                }
            }
        }

        return null
    }

    /**
     * Wait for page to be ready
     */
    private async waitForPageReady(window: BrowserWindow, maxWait: number = 10000): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Page ready timeout'))
            }, maxWait)

            const checkReady = async () => {
                try {
                    const isReady = await window.webContents.executeJavaScript(`
                        document.readyState === 'complete' && 
                        (typeof jQuery === 'undefined' || jQuery.active === 0)
                    `) as boolean

                    if (isReady) {
                        clearTimeout(timeout)
                        resolve()
                    } else {
                        setTimeout(checkReady, 100)
                    }
                } catch (error) {
                    clearTimeout(timeout)
                    resolve() // Resolve anyway to continue
                }
            }

            checkReady()
        })
    }

    /**
     * Wait for specific conditions
     */
    private async waitForConditions(
        window: BrowserWindow,
        conditions: string[],
        timeout: number = 30000
    ): Promise<void> {
        const startTime = Date.now()

        for (const condition of conditions) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`Wait condition timeout: ${condition}`)
            }

            if (condition === 'domContentLoaded') {
                await this.waitForDOMContentLoaded(window, timeout - (Date.now() - startTime))
            } else if (condition.startsWith('elementVisible:')) {
                const selector = condition.substring('elementVisible:'.length)
                await this.waitForElementVisible(window, selector, timeout - (Date.now() - startTime))
            } else if (condition.startsWith('networkIdle:')) {
                const delay = parseInt(condition.substring('networkIdle:'.length)) || 2000
                await this.waitForNetworkIdle(window, delay, timeout - (Date.now() - startTime))
            }
        }
    }

    /**
     * Wait for DOM content loaded
     */
    private async waitForDOMContentLoaded(window: BrowserWindow, maxWait: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('DOMContentLoaded timeout'))
            }, maxWait)

            window.webContents.once('dom-ready', () => {
                clearTimeout(timeout)
                resolve()
            })

            // Check if already loaded
            window.webContents.executeJavaScript('document.readyState').then((state: string) => {
                if (state === 'complete' || state === 'interactive') {
                    clearTimeout(timeout)
                    resolve()
                }
            }).catch(() => {
                // Ignore errors
            })
        })
    }

    /**
     * Wait for element to be visible
     */
    private async waitForElementVisible(
        window: BrowserWindow,
        selector: string,
        maxWait: number
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now()

            const checkElement = async () => {
                if (Date.now() - startTime > maxWait) {
                    reject(new Error(`Element not visible: ${selector}`))
                    return
                }

                try {
                    const isVisible = await window.webContents.executeJavaScript(`
                        (function() {
                            const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
                            return element && element.offsetParent !== null;
                        })()
                    `) as boolean

                    if (isVisible) {
                        resolve()
                    } else {
                        setTimeout(checkElement, 200)
                    }
                } catch (error) {
                    setTimeout(checkElement, 200)
                }
            }

            checkElement()
        })
    }

    /**
     * Wait for network to be idle
     */
    private async waitForNetworkIdle(
        window: BrowserWindow,
        idleDelay: number,
        maxWait: number
    ): Promise<void> {
        return new Promise((resolve) => {
            let lastRequestTime = Date.now()
            let idleTimer: NodeJS.Timeout
            let timeoutTimer: NodeJS.Timeout
            let isResolved = false

            // Cleanup function to remove all event listeners
            const cleanup = () => {
                if (isResolved) return
                isResolved = true
                
                window.webContents.off('did-start-loading', resetIdleTimer)
                window.webContents.off('did-finish-load', resetIdleTimer)
                window.webContents.off('did-fail-load', resetIdleTimer)
                
                if (idleTimer) {
                    clearTimeout(idleTimer)
                }
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer)
                }
            }

            const resetIdleTimer = () => {
                lastRequestTime = Date.now()
                clearTimeout(idleTimer)
                idleTimer = setTimeout(() => {
                    if (Date.now() - lastRequestTime >= idleDelay) {
                        cleanup()
                        resolve()
                    }
                }, idleDelay)
            }

            // Monitor network requests
            window.webContents.on('did-start-loading', resetIdleTimer)
            window.webContents.on('did-finish-load', resetIdleTimer)
            window.webContents.on('did-fail-load', resetIdleTimer)

            // Start the idle timer
            resetIdleTimer()

            // Timeout fallback
            timeoutTimer = setTimeout(() => {
                cleanup()
                resolve()
            }, maxWait)
        })
    }
}

// Singleton instance
export const operationExecutor = new OperationExecutor()

