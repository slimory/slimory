import { Tool, ToolResult } from './types'
import { BrowserWindow } from 'electron'
import { t, setLanguage } from '../main/i18n.js'

/**
 * Extract main content from web page
 */
async function extractPageContent(webContents: Electron.WebContents): Promise<{
    title: string
    content: string
    text: string
}> {
    return await webContents.executeJavaScript(`
        (() => {
            // Remove unnecessary elements
            const removeSelectors = [
                'script', 'style', 'nav', 'footer', 'header',
                '.ad', '.advertisement', '.ads', '[class*="ad-"]',
                '.sidebar', '.menu', '.navigation',
                '.comment', '.comments', '.social-share',
                'iframe', 'noscript'
            ]
            
            removeSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.remove())
            })
            
            // Try to find main content area
            let mainContent = document.querySelector('main') ||
                            document.querySelector('article') ||
                            document.querySelector('[role="main"]') ||
                            document.querySelector('.content') ||
                            document.querySelector('#content') ||
                            document.querySelector('.main-content') ||
                            document.body
            
            // Extract title
            const title = document.querySelector('h1')?.innerText || 
                         document.title || 
                         ''
            
            // Extract all text content
            const text = mainContent.innerText || mainContent.textContent || ''
            
            // Extract HTML content (to preserve structure)
            const content = mainContent.innerHTML || ''
            
            // Clean text: remove excessive whitespace
            const cleanText = text
                .replace(/\\s+/g, ' ')
                .replace(/\\n\\s*\\n/g, '\\n\\n')
                .trim()
            
            // Limit content length (to avoid excessive length)
            const maxLength = 10000
            const truncatedText = cleanText.length > maxLength 
                ? cleanText.substring(0, maxLength) + '...' 
                : cleanText
            
            return {
                title: title.trim(),
                content: content.substring(0, 10000), // Limit HTML length
                text: truncatedText
            }
        })()
    `)
}

async function fetchUrlContent(url: string, timeout: number = 10000): Promise<{
    title: string
    content: string
    text: string
} | null> {
    // console.log('timeout:', timeout)
    return new Promise((resolve) => {
        const contentWindow = new BrowserWindow({
            show: false,
            skipTaskbar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        })
        const { session } = contentWindow.webContents
        const filter = {
            urls: ['*://*/*']
        }

        session.webRequest.onBeforeRequest(filter, (details, callback) => {
            const requestUrl = details.url.toLowerCase()
            
            // Block ad and tracking related domains
            const blockedDomains = [
                'sync.client.live',
                'nextmillmedia.com',
                'cookies.nextmillmedia.com',
                'doubleclick.net',
                'google-analytics.com',
                // ... other ad/tracking domains
            ]
            
            if (blockedDomains.some(domain => requestUrl.includes(domain))) {
                callback({ cancel: true })
            } else {
                callback({})
            }
        })

        let resolved = false

        const cleanup = () => {
            if (!resolved && !contentWindow.isDestroyed()) {
                resolved = true
                // Stop page loading
                try {
                    if (!contentWindow.isDestroyed() && !contentWindow.webContents.isDestroyed()) {
                        contentWindow.webContents.stop()
                    }
                } catch (e) {
                    // Ignore error
                }
                contentWindow.close()
            }
        }

        // Helper function to extract content with timeout protection
        const tryExtractContent = async (extractTimeout: number = 2000): Promise<{ title: string; content: string; text: string } | null> => {
            // If window is destroyed, return directly
            if (contentWindow.isDestroyed() || contentWindow.webContents.isDestroyed()) {
                return null
            }

            try {
                // Add timeout protection for executeJavaScript
                const extractPromise = extractPageContent(contentWindow.webContents)
                const timeoutPromise = new Promise<null>((resolve) => {
                    setTimeout(() => resolve(null), extractTimeout)
                })

                const content = await Promise.race([extractPromise, timeoutPromise])
                return content
            } catch (error) {
                console.error(`[WebSearchTool] Error extracting content from ${url}:`, error)
                return null
            }
        }

        // Page load completed
        contentWindow.webContents.once('did-finish-load', async () => {
            if (resolved) return
            
            try {
                // Wait for page to fully load
                await new Promise(r => setTimeout(r, 1500))
                
                const content = await tryExtractContent()
                cleanup()
                resolved = true
                resolve(content)
            } catch (error) {
                console.error(`[WebSearchTool] Error extracting content from ${url}:`, error)
                cleanup()
                resolved = true
                resolve(null)
            }
        })

        // Load failed
        contentWindow.webContents.once('did-fail-load', async (_event, _errorCode, errorDescription) => {
            if (resolved) return
            console.error(`[WebSearchTool] Failed to load ${url}: ${errorDescription}`)
            
            // Even if loading fails, try to extract already loaded content
            try {
                const content = await tryExtractContent(1000) // Use shorter timeout on failure
                cleanup()
                resolved = true
                resolve(content)
            } catch (error) {
                cleanup()
                resolved = true
                resolve(null)
            }
        })

        // Set timeout
        const timeoutId = setTimeout(async () => {
            if (!resolved) {
                console.warn(`[WebSearchTool] Timeout loading ${url}, attempting to extract partial content...`)
                
                // Stop page loading after timeout
                try {
                    if (!contentWindow.isDestroyed() && !contentWindow.webContents.isDestroyed()) {
                        contentWindow.webContents.stop()
                    }
                } catch (e) {
                    // Ignore error
                }

                // Wait a short time for stop operation to take effect
                await new Promise(r => setTimeout(r, 100))
                
                // Still try to extract content after timeout, but use shorter timeout
                try {
                    const content = await tryExtractContent(1000) // 1 second timeout
                    cleanup()
                    resolved = true
                    resolve(content)
                } catch (error) {
                    console.error(`[WebSearchTool] Failed to extract content after timeout:`, error)
                    cleanup()
                    resolved = true
                    resolve({ title: '', content: '', text: `Timeout loading ${url}` })
                }
            }
        }, timeout)

        // Load URL
        try {
            contentWindow.loadURL(url)
        } catch (error) {
            console.error(`[WebSearchTool] Error loading URL ${url}:`, error)
            clearTimeout(timeoutId)
            cleanup()
            resolved = true
            resolve(null)
        }
    })
}

/**
 * Web search tool - only returns search results, does not fetch content
 * Use fetch_url_content tool to get full page content when needed
 */
export class WebSearchTool implements Tool {
    name = 'web_search'
    description = 'Search the internet for information. Returns search results with titles, URLs, snippets, and sources. Use fetch_url_content tool to get full page content when needed.'
    
    parameters = {
        type: 'object' as const,
        properties: {
            query: {
                type: 'string',
                description: 'The search query string'
            },
            max_results: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10, max: 20)'
            },
            start: {
                type: 'number',
                description: 'Starting position for results (0-based, for pagination). Default: 0. Use this to get next page of results (e.g., start=10 for results 11-20).'
            }
        },
        required: ['query']
    }

    async execute(params: Record<string, any>, onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => boolean, currentLang: string = 'zh', _messages?: Array<{ role: string; content: string }>, _conversationId?: string): Promise<ToolResult> {
        // Set language for i18n
        setLanguage(currentLang)
        
        const { 
            query, 
            max_results = 10,
            start = 0
        } = params

        if (!query || typeof query !== 'string') {
            return {
                success: false,
                error: 'Query parameter is required and must be a string'
            }
        }

        return new Promise((resolve) => {
            // Create hidden browser window
            const searchWindow = new BrowserWindow({
                show: false,
                skipTaskbar: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true
                }
            })

            // Build Bing search URL, add first parameter for pagination
            const encodedQuery = encodeURIComponent(query)
            const first = start + 1 // Bing uses 1-based indexing
            const searchUrl = `https://cn.bing.com/search?q=${encodedQuery}&first=${first}`
            
            console.log(`[WebSearchTool] Searching for: "${query}" (start: ${start}, max_results: ${max_results})`)

            if (onStatusUpdate) {
                const statusMessage = t('tools.webSearch.searching', { query })
                // console.log(currentLang, statusMessage)
                onStatusUpdate('start', statusMessage)
            }

            // Load search page
            searchWindow.loadURL(searchUrl)

            // Wait for page load completion then execute search and get results
            searchWindow.webContents.once('did-finish-load', async () => {
                try {
                    // Wait for page to fully load (including dynamic content)
                    await new Promise(resolve => setTimeout(resolve, 2000))

                    // console.log('searchWindow.isDestroyed():', searchWindow.isDestroyed())

                    // Extract search results
                    const results = await searchWindow.webContents.executeJavaScript(`
                        (() => {
                            const results = []
                            const resultElements = document.querySelectorAll('#b_results li.b_algo')
                            
                            for (let i = 0; i < Math.min(${max_results}, resultElements.length); i++) {
                                const element = resultElements[i]
                                const titleElement = element.querySelector('h2 a')
                                const linkElement = element.querySelector('h2 a')
                                const snippetElement = element.querySelector('.b_caption p')
                                // Extract media name: get from .tptt i element
                                const sourceElement = element.querySelector('.tptt i') || 
                                                     element.querySelector('.tptxt .tptt i') || 
                                                     element.querySelector('.tptxt .tptt')
                                
                                if (titleElement && linkElement) {
                                    const url = linkElement.href
                                    let source = ''
                                    
                                    // Extract media name from .tptt i element
                                    if (sourceElement) {
                                        source = (sourceElement.innerText || sourceElement.textContent || '').trim()
                                    }
                                    
                                    // If not found, try to extract domain from URL as fallback
                                    if (!source) {
                                        try {
                                            const urlObj = new URL(url)
                                            source = urlObj.hostname.replace(/^www\./, '')
                                        } catch (e) {
                                            // URL parsing failed
                                        }
                                    }
                                    
                                    results.push({
                                        title: titleElement.innerText || titleElement.textContent,
                                        url: url,
                                        snippet: snippetElement ? (snippetElement.innerText || snippetElement.textContent) : '',
                                        source: source || '' // Add source field
                                    })
                                }
                            }
                            
                            return results
                        })()
                    `)
                    
                    // Close search window
                    searchWindow.close()

                    console.log(`[WebSearchTool] Found ${results.length} results for: "${query}"`)

                    if (onStatusUpdate) {
                        const statusMessage = t('tools.webSearch.foundResults', { count: results.length.toString() })
                        onStatusUpdate('end', statusMessage)
                    }

                    resolve({
                        success: true,
                        data: {
                            query,
                            results,
                            searchUrl,
                            start,
                            hasMore: results.length >= max_results // May have more results
                        }
                    })
                } catch (error) {
                    console.error('[WebSearchTool] Error extracting results:', error)
                    if (searchWindow && !searchWindow.isDestroyed()) {
                        searchWindow.close()
                    }

                    if (onStatusUpdate) {
                        const statusMessage = t('tools.webSearch.foundResults', { count: '0' })
                        onStatusUpdate('end', statusMessage)
                    }
                    
                    resolve({
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        data: {
                            query,
                            searchUrl,
                            message: 'Failed to extract search results, but search URL is available'
                        }
                    })
                }
            })

            // Handle load error
            searchWindow.webContents.once('did-fail-load', (_event, _errorCode, errorDescription) => {
                console.error('[WebSearchTool] Failed to load search page:', errorDescription)
                searchWindow.close()
                resolve({
                    success: false,
                    error: `Failed to load search page: ${errorDescription}`
                })
            })

            // Set timeout
            setTimeout(() => {
                if (!searchWindow.isDestroyed()) {
                    searchWindow.close()
                    resolve({
                        success: false,
                        error: 'Search timeout',
                        data: {
                            query,
                            searchUrl
                        }
                    })
                }
            }, 10000) // 10 second timeout
        })
    }
}

/**
 * Fetch URL content tool - fetches full content from one or more URLs
 * Use this when search result snippets are insufficient to answer the question
 */
export class FetchUrlContentTool implements Tool {
    name = 'fetch_url_content'
    description = 'Fetch and extract the full content from one or more specific URLs. Use this when search result snippets are insufficient to answer the question. This is more time-consuming and token-intensive than web_search, so use it selectively. You can fetch 1-5 URLs at once for efficiency.'
    
    parameters = {
        type: 'object' as const,
        properties: {
            url: {
                type: 'string',
                description: 'A single URL to fetch content from. Use this for fetching one URL.'
            },
            urls: {
                type: 'array',
                items: {
                    type: 'string'
                },
                description: 'Array of URLs to fetch content from (max 5 URLs). Use this for fetching multiple URLs in parallel. More efficient than calling the tool multiple times.'
            }
        },
        required: []
    }

    async execute(params: Record<string, any>, onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => boolean, currentLang: string = 'zh', _messages?: Array<{ role: string; content: string }>, _conversationId?: string): Promise<ToolResult> {
        // Set language for i18n
        setLanguage(currentLang)
        
        // Support single url or urls array
        let urls: string[] = []
        
        if (params.urls && Array.isArray(params.urls)) {
            urls = params.urls
        } else if (params.url && typeof params.url === 'string') {
            urls = [params.url]
        } else {
            return {
                success: false,
                error: 'Either "url" (string) or "urls" (array) parameter is required'
            }
        }

        // Limit to maximum 5 URLs
        if (urls.length > 5) {
            return {
                success: false,
                error: `Maximum 5 URLs allowed, got ${urls.length}. Please fetch in batches.`
            }
        }

        if (urls.length === 0) {
            return {
                success: false,
                error: 'At least one URL is required'
            }
        }

        // Validate URL format
        const validUrls: string[] = []
        for (const url of urls) {
            try {
                new URL(url)
                validUrls.push(url)
            } catch (e) {
                console.warn(`[FetchUrlContentTool] Invalid URL: ${url}`)
            }
        }

        if (validUrls.length === 0) {
            return {
                success: false,
                error: 'No valid URLs provided'
            }
        }

        const totalUrls = validUrls.length
        const results: Array<{
            url: string
            title?: string
            content?: string
            hasContent: boolean
            error?: string
        }> = []

        if (onStatusUpdate) {
            const statusMessage = t('tools.webSearch.browseUrls', { count: totalUrls.toString() })
            onStatusUpdate('start', statusMessage)
        }

        // Fetch all URLs in parallel
        const fetchPromises = validUrls.map(async (url, index) => {
            if (onStatusUpdate) {
                const statusMessage = t('tools.webSearch.fetching', { 
                    current: (index + 1).toString(), 
                    total: totalUrls.toString(), 
                    url 
                })
                onStatusUpdate('processing', statusMessage)
            }

            try {
                const pageContent = await fetchUrlContent(url)
                
                if (onStatusUpdate) {
                    const statusMessage = t('tools.webSearch.completed', { 
                        current: (index + 1).toString(), 
                        total: totalUrls.toString(), 
                        url 
                    })
                    onStatusUpdate('processing', statusMessage)
                }

                if (pageContent) {
                    return {
                        url,
                        title: pageContent.title,
                        content: pageContent.text,
                        hasContent: true
                    }
                } else {
                    return {
                        url,
                        hasContent: false,
                        error: 'Failed to extract content'
                    }
                }
            } catch (error) {
                console.error(`[FetchUrlContentTool] Error fetching ${url}:`, error)
                return {
                    url,
                    hasContent: false,
                    error: error instanceof Error ? error.message : String(error)
                }
            }
        })

        // Wait for all requests to complete
        const fetchResults = await Promise.all(fetchPromises)
        results.push(...fetchResults)

        const successCount = results.filter(r => r.hasContent).length

        if (onStatusUpdate) {
            const statusMessage = t('tools.webSearch.fetchCompleted', { 
                success: successCount.toString(), 
                total: totalUrls.toString() 
            })
            onStatusUpdate('end', statusMessage)
        }

        return {
            success: successCount > 0, // Success if at least one succeeds
            data: {
                results,
                total: totalUrls,
                successful: successCount,
                failed: totalUrls - successCount
            }
        }
    }
}

