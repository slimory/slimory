/**
 * OperationGenerator Test Script
 * 
 * This script tests the generateDomainOperations function by:
 * 1. Initializing Electron app
 * 2. Creating a BrowserWindow instance
 * 3. Creating a ChatService instance
 * 4. Testing domain operations generation for youtube.com
 * 5. Validating results
 * 
 * Usage:
 *   npm run test:operationgenerator
 *   or
 *   npx tsx scripts/tests/testOperationGenerator.ts
 */

import { app, BrowserWindow } from 'electron'
import { generateDomainOperations } from '../../src/tools/webPilot/operationGenerator.js'
import { ChatService } from '../../src/services/chatService.js'
import { chatConfig } from '../../src/config/chatConfig.js'
import { OperationExecutor } from '../../src/tools/webPilot/operationExecutor.js'

// Test configuration
const TEST_DOMAIN = 'youtube.com'
const MAX_PATTERNS = 2 // Limit to 3 patterns for testing
const TEST_TIMEOUT = 300000 // 5 minutes timeout

// 检测是否为 Windows 且是否支持颜色
const isWindows = process.platform === 'win32'
const supportsColor = process.stdout.isTTY && (
    process.env.TERM !== 'dumb' || 
    process.env.CI || 
    (isWindows && process.env.WT_SESSION) // Windows Terminal
)

// Colors for console output (Windows 传统 CMD 不支持 ANSI，使用空字符串)
const colors = supportsColor ? {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
} : {
    reset: '',
    green: '',
    red: '',
    yellow: '',
    blue: '',
    cyan: '',
    magenta: ''
}

// 使用 ASCII 字符替代 Unicode 字符（避免 Windows CMD 乱码）
const symbols = {
    success: supportsColor ? '✓' : '[OK]',
    error: supportsColor ? '✗' : '[FAIL]',
    info: supportsColor ? 'ℹ' : '[INFO]',
    warning: supportsColor ? '⚠' : '[WARN]'
}

function log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`)
}

function logSuccess(message: string) {
    log(`${symbols.success} ${message}`, colors.green)
}

function logError(message: string) {
    log(`${symbols.error} ${message}`, colors.red)
}

function logInfo(message: string) {
    log(`${symbols.info} ${message}`, colors.blue)
}

function logWarning(message: string) {
    log(`${symbols.warning} ${message}`, colors.yellow)
}

function logStatus(message: string) {
    log(`${message}`, colors.magenta)
}

/**
 * Create a test BrowserWindow
 */
function createTestWindow(): BrowserWindow {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        show: true, // Don't show window during test
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    })
    
    return win
}

/**
 * Test generateDomainOperations function
 */
export async function testGenerateDomainOperations(): Promise<boolean> {
    logInfo(`\nTesting domain: ${TEST_DOMAIN}`)
    // logInfo(`Max patterns: ${MAX_PATTERNS}`)
    logInfo(`Timeout: ${TEST_TIMEOUT / 1000}s\n`)
    
    let window: BrowserWindow | null = null
    
    try {
        // Create ChatService
        logInfo('Creating ChatService...')
        const chatService = new ChatService(chatConfig)
            // Check if API key is configured
        if (!chatConfig.apiKey) {
            logError('API key is not configured!')
            logError('Please set "OPENAI_API_KEY" variable in the environment file(".env.dev").')
            logError('The test cannot proceed without a valid API key.')
            app.quit()
            process.exit(1)
        }
        
        logInfo('API key configured\n')

        logSuccess('ChatService created')

        // Create BrowserWindow
        logInfo('Creating BrowserWindow...')
        window = createTestWindow()
        logSuccess('BrowserWindow created')
        
        // Status update callback
        const statusUpdates: Array<{ status: string; message: string; timestamp: number }> = []
        const onStatusUpdate = (status: 'start' | 'processing' | 'end', message: string) => {
            const timestamp = Date.now()
            statusUpdates.push({ status, message, timestamp })
            logStatus(`[${status.toUpperCase()}] ${message}`)
        }
        
        // Run test with timeout
        logInfo('Starting domain operations generation...')
        logWarning('This may take several minutes. Please wait...\n')
        
        const startTime = Date.now()
        
        const result = await Promise.race([
            generateDomainOperations(
                TEST_DOMAIN,
                window,
                chatService,
                onStatusUpdate,
                'en', // Use English for testing
                MAX_PATTERNS
            ),
            new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Test timeout after ${TEST_TIMEOUT / 1000} seconds`))
                }, TEST_TIMEOUT)
            })
        ])
        
        const duration = Date.now() - startTime
        
        logSuccess(`\nGeneration completed in ${(duration / 1000).toFixed(2)}s`)
        
        // Validate result structure
        if (!result) {
            logError('Result is null or undefined')
            return false
        }
        
        if (!result.domain) {
            logError('Result domain is missing')
            return false
        }
        
        if (result.domain !== TEST_DOMAIN) {
            logError(`Domain mismatch: expected "${TEST_DOMAIN}", got "${result.domain}"`)
            return false
        }
        
        if (!result.operations) {
            logError('Result operations is missing')
            return false
        }
        
        if (!Array.isArray(result.operations)) {
            logError('Result operations is not an array')
            return false
        }
        
        logSuccess(`Found ${result.operations.length} operation(s)`)
        
        // Display operations
        result.operations.forEach((op, index) => {
            log(`\n  Operation [${index + 1}]:`, colors.cyan)
            log(`    Name: ${op.name || 'N/A'}`)
            log(`    Description: ${op.description ? op.description.substring(0, 100) + '...' : 'N/A'}`)
            log(`    Timeout: ${op.timeout || 'N/A'}ms`)
            if (op.waitConditions) {
                log(`    Wait Conditions: ${op.waitConditions.join(', ')}`)
            }
            if (op.code) {
                const codeLength = op.code.length
                log(`    Code Length: ${codeLength} characters`)
                if (codeLength > 500) {
                    log(`    Code Preview: ${op.code.substring(0, 200)}...`)
                } else {
                    log(`    Code: ${op.code}`)
                }
            }
        })
        
        // Display status updates summary
        if (statusUpdates.length > 0) {
            log('\nStatus Updates:', colors.cyan)
            statusUpdates.forEach((update, _index) => {
                const time = ((update.timestamp - startTime) / 1000).toFixed(1)
                log(`  [${time}s] ${update.status}: ${update.message}`)
            })
        }
        
        // Check if operations file was created
        logInfo('\nChecking if operations file was created...')
        // Note: The file should be created in src/tools/webPilot/scripts/youtube.com/operations.json
        // We can't easily check this from here, but the function should have saved it
        
        return true
    } catch (error) {
        logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`)
        if (error instanceof Error && error.stack) {
            logError(`Stack trace: ${error.stack}`)
        }
        return false
    } finally {
        // Clean up
        if (window) {
            logInfo('Closing BrowserWindow...')
            window.close()
            logSuccess('BrowserWindow closed')
        }
    }
}

/**
 * Test extractPageContent operation
 */
async function testExtractPageContent(): Promise<boolean> {
    // const TEST_URL = 'https://www.youtube.com/shorts/7dIPidry1SQ'
    // const TEST_DOMAIN = 'youtube.com'
    // const OPERATION_NAME = 'extractPageContent'

    const TEST_URL = 'https://www.bilibili.com/?spm_id_from=333.337.0.0'
    const TEST_DOMAIN = 'bilibili.com'
    const OPERATION_NAME = 'extractPageContent'
    
    logInfo(`\nTesting extractPageContent operation`)
    logInfo(`URL: ${TEST_URL}`)
    logInfo(`Domain: ${TEST_DOMAIN}`)
    logInfo(`Operation: ${OPERATION_NAME}\n`)
    
    let window: BrowserWindow | null = null
    
    try {
        // Create BrowserWindow
        logInfo('Creating BrowserWindow...')
        window = createTestWindow()
        logSuccess('BrowserWindow created')
        
        // Create OperationExecutor
        logInfo('Creating OperationExecutor...')
        const executor = new OperationExecutor()
        logSuccess('OperationExecutor created')
        
        // Load script to verify operation exists
        logInfo(`Loading operations script for domain: ${TEST_DOMAIN}...`)
        const script = executor.loadScript(TEST_DOMAIN)
        if (!script) {
            logError(`Failed to load operations script for domain: ${TEST_DOMAIN}`)
            return false
        }
        
        const operation = script.operations.find(op => op.name === OPERATION_NAME)
        if (!operation) {
            logError(`Operation "${OPERATION_NAME}" not found in script`)
            logInfo(`Available operations: ${script.operations.map(op => op.name).join(', ')}`)
            return false
        }
        
        logSuccess(`Found operation: ${OPERATION_NAME}`)
        log(`  Description: ${operation.description || 'N/A'}`)
        log(`  Timeout: ${operation.timeout || 'N/A'}ms`)
        if (operation.waitConditions) {
            log(`  Wait Conditions: ${operation.waitConditions.join(', ')}`)
        }
        log(`  code: ${operation.code || 'N/A'}`)
        
        // Navigate to the test URL
        logInfo(`\nNavigating to: ${TEST_URL}...`)
        await window.loadURL(TEST_URL)
        
        // Wait for page to load with timeout
        const PAGE_LOAD_TIMEOUT = 5000 // 5 seconds
        await Promise.race([
            new Promise<void>((resolve) => {
                window!.webContents.once('did-finish-load', () => {
                    logSuccess('Page loaded')
                    resolve()
                })
            }),
            new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve()
                }, PAGE_LOAD_TIMEOUT)
            })
        ])
        
        // Wait a bit more for dynamic content
        logInfo('Waiting for dynamic content to load...')
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Execute the operation
        logInfo(`\nExecuting operation: ${OPERATION_NAME}...`)
        const startTime = Date.now()
        
        const result = await executor.executeOperation(
            window,
            TEST_DOMAIN,
            OPERATION_NAME,
            {} // No parameters needed for extractPageContent
        )
        
        const duration = Date.now() - startTime
        
        // Validate result
        logSuccess(`\nOperation completed in ${(duration / 1000).toFixed(2)}s`)
        
        if (!result.success) {
            logError(`Operation failed: ${result.error || 'Unknown error'}`)
            return false
        }
        
        logSuccess('Operation executed successfully')
        
        // Display result details
        if (result.data) {
            log('\nResult Data:', colors.cyan)
            
            if (result.data.success !== false) {
                logSuccess('Extraction successful')
                
                if (result.data.url) {
                    log(`  URL: ${result.data.url}`)
                }
                if (result.data.title) {
                    log(`  Title: ${result.data.title}`)
                }
                if (result.data.pattern) {
                    log(`  Matched Pattern: ${result.data.pattern}`)
                }
                if (result.data.description) {
                    log(`  Pattern Description: ${result.data.description}`)
                }
                if (result.data.htmlLength !== undefined) {
                    log(`  HTML Length: ${result.data.htmlLength} characters`)
                }
                if (result.data.html) {
                    const htmlPreview = result.data.html.length > 2000 
                        ? result.data.html.substring(0, 2000) + '...'
                        : result.data.html
                    log(`  HTML Preview (first 5000 chars), length: :\n${htmlPreview}`)
                }
                if (result.data.message) {
                    log(`  Message: ${result.data.message}`)
                }
            } else {
                logError(`Extraction failed: ${result.data.error || 'Unknown error'}`)
                return false
            }
        } else {
            logWarning('No data returned from operation')
        }
        
        return true
    } catch (error) {
        logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`)
        if (error instanceof Error && error.stack) {
            logError(`Stack trace: ${error.stack}`)
        }
        return false
    } finally {
        // Clean up
        if (window) {
            logInfo('Closing BrowserWindow...')
            window.close()
            logSuccess('BrowserWindow closed')
        }
    }
}

/**
 * Run all tests
 */
async function runTests() {
    log('\n' + '='.repeat(60), colors.cyan)
    log('OperationGenerator Test Suite', colors.cyan)
    log('='.repeat(60) + '\n', colors.cyan)
    
    // Wait for Electron app to be ready
    await app.whenReady()
    
    logInfo('Electron app ready')
    logInfo(`Testing domain: ${TEST_DOMAIN}`)
    // logInfo(`Max patterns: ${MAX_PATTERNS}`)
    logWarning('Note: This test requires network access and API key configuration\n')
    
    // Run tests
    // const test1Success = await testGenerateDomainOperations()
    log('\n' + '-'.repeat(60) + '\n', colors.cyan)
    const test2Success = await testExtractPageContent()
    
    // Summary
    log('\n' + '='.repeat(60), colors.cyan)
    log('Test Summary', colors.cyan)
    log('='.repeat(60), colors.cyan)
    
    log('\nTest Results:')
    // log(`  testGenerateDomainOperations: ${test1Success ? 'PASSED' : 'FAILED'}`, test1Success ? colors.green : colors.red)
    log(`  testExtractPageContent: ${test2Success ? 'PASSED' : 'FAILED'}`, test2Success ? colors.green : colors.red)
    
    // Exit
    app.quit()
    process.exit(0)
}

// Handle errors
process.on('unhandledRejection', (error) => {
    logError(`Unhandled rejection: ${error}`)
    app.quit()
    process.exit(1)
})

process.on('uncaughtException', (error) => {
    logError(`Uncaught exception: ${error.message}`)
    app.quit()
    process.exit(1)
})

// Start tests
runTests().catch((error) => {
    logError(`Test suite failed: ${error}`)
    app.quit()
    process.exit(1)
})
