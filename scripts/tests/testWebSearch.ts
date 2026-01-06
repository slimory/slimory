/**
 * WebSearch Tool Test Script
 * 
 * This script tests the webSearch tool functionality by:
 * 1. Initializing Electron app
 * 2. Creating a test instance of WebSearchTool
 * 3. Executing search queries
 * 4. Validating results
 * 
 * Usage:
 *   npm run test:websearch
 *   or
 *   npx tsx scripts/tests/testWebSearch.ts
 */

import { app } from 'electron'
import { WebSearchTool, FetchUrlContentTool } from '../../src/tools/webSearch.js'

// Test configuration
const TEST_QUERIES = [
    'TypeScript',
    'Electron framework',
    '人工智能'
]

const MAX_RESULTS = 5

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
    cyan: '\x1b[36m'
} : {
    reset: '',
    green: '',
    red: '',
    yellow: '',
    blue: '',
    cyan: ''
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

/**
 * Test a single search query
 */
async function testSearchQuery(tool: WebSearchTool, query: string, maxResults: number): Promise<boolean> {
    logInfo(`\nTesting query: "${query}"`)
    logInfo(`Max results: ${maxResults}`)
    
    const startTime = Date.now()
    
    try {
        const result = await tool.execute({ query, max_results: maxResults})
        const duration = Date.now() - startTime
        
        if (!result.success) {
            logError(`Search failed: ${result.error}`)
            return false
        }
        
        logSuccess(`Search completed in ${duration}ms`)
        
        // Validate result structure
        if (!result.data) {
            logError('Result data is missing')
            return false
        }
        
        if (result.data.query !== query) {
            logError(`Query mismatch: expected "${query}", got "${result.data.query}"`)
            return false
        }
        
        if (!Array.isArray(result.data.results)) {
            logError('Results is not an array')
            return false
        }
        
        logSuccess(`Found ${result.data.results.length} results`)
        
        // Display results
        if (result.data.results.length > 0) {
            log('\nResults:')
            result.data.results.forEach((item: any, index: number) => {
                log(`\n  [${index + 1}] ${item.title || 'No title'}`, colors.cyan)
                log(`      URL: ${item.url || 'No URL'}`)
                if (item.snippet) {
                    const snippet = item.snippet.length > 100 
                        ? item.snippet.substring(0, 100) + '...' 
                        : item.snippet
                    console.log(`      Snippet: ${snippet}`)
                }
                if (item.hasContent) {
                    const content = item.pageContent.length > 300 
                        ? item.pageContent.substring(0, 300) + '...' 
                        : item.pageContent
                    console.log(`      Content: ${content}`)
                }
            })
        } else {
            logWarning('No results found')
        }
        
        if (result.data.searchUrl) {
            logInfo(`Search URL: ${result.data.searchUrl}`)
        }
        
        return true
    } catch (error) {
        logError(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
        return false
    }
}

/**
 * Run all tests
 */
export async function runTests() {
    
    log('\n' + '='.repeat(60), colors.cyan)
    log('WebSearch Tool Test Suite', colors.cyan)
    log('='.repeat(60) + '\n', colors.cyan)
    
    // Wait for Electron app to be ready
    await app.whenReady()
    
    logInfo('Electron app ready')
    logInfo(`Testing ${TEST_QUERIES.length} queries\n`)
    
    const tool = new WebSearchTool()
    const results: boolean[] = []
    
    // Run tests sequentially to avoid conflicts
    for (const query of TEST_QUERIES) {
        const success = await testSearchQuery(tool, query, MAX_RESULTS)
        results.push(success)
        
        // Wait a bit between tests to avoid rate limiting
        if (query !== TEST_QUERIES[TEST_QUERIES.length - 1]) {
            await new Promise(resolve => setTimeout(resolve, 2000))
        }
    }
    
    // Summary
    const passed = results.filter(r => r).length
    const failed = results.filter(r => !r).length
    
    log('\n' + '='.repeat(60), colors.cyan)
    log('Test Summary', colors.cyan)
    log('='.repeat(60), colors.cyan)
    log(`Total tests: ${results.length}`)
    logSuccess(`Passed: ${passed}`)
    if (failed > 0) {
        logError(`Failed: ${failed}`)
    }
    log('='.repeat(60) + '\n', colors.cyan)
    
    // Exit
    app.quit()
    process.exit(failed > 0 ? 1 : 0)
}

async function runFetchUrlContentTests() {
    
    log('\n' + '='.repeat(60), colors.cyan)
    log('WebSearch Tool Test Suite', colors.cyan)
    log('='.repeat(60) + '\n', colors.cyan)
    
    // Wait for Electron app to be ready
    await app.whenReady()
    
    logInfo('Electron app ready')
    logInfo(`Testing FetchUrlContentTool\n`)
    
    const tool = new FetchUrlContentTool()
    
    const result = await tool.execute({ url: "https://github.com/anthropics/skills" })
    console.log(JSON.stringify(result, null, 2))
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
// runTests().catch((error) => {
//     logError(`Test suite failed: ${error}`)
//     app.quit()
//     process.exit(1)
// })

runFetchUrlContentTests().catch((error) => {
    logError(`Test suite failed: ${error}`)
    app.quit()
    process.exit(1)
})