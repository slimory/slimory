/**
 * Extract Clean URL from a full URL
 * Removes query parameters, hash, and trailing slashes
 * Example: www.xxx.com/aaa/?q=kkk -> www.xxx.com/aaa
 */
export function getCleanUrl(url: string): string {
    try {
        // Handle relative URLs
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            // If it's a relative URL, try to construct full URL
            // For browser context, use window.location
            return url
        }

        const urlObj = new URL(url)
        
        // Get protocol, hostname, and pathname
        let cleanUrl = `${urlObj.protocol}//${urlObj.hostname}`
        
        // Add pathname, removing trailing slashes
        if (urlObj.pathname) {
            const path = urlObj.pathname.replace(/\/+$/, '') // Remove trailing slashes
            cleanUrl += path || ''
        }
        
        return cleanUrl
    } catch (error) {
        // If URL parsing fails, try to extract manually
        // Remove query string and hash
        let cleanUrl = url.split('?')[0].split('#')[0]
        // Remove trailing slashes
        cleanUrl = cleanUrl.replace(/\/+$/, '')
        return cleanUrl
    }
}

/**
 * Match two Clean URLs based on parent path
 * Matches if parent path is the same
 * Example: /a/b/c matches /a/b/d (both have parent /a/b)
 *          /a/e/f doesn't match /a/g/k (different parents /a/e vs /a/g)
 */
export function matchCleanUrls(url1: string, url2: string): boolean {
    try {
        // Parse URLs to extract paths
        let path1 = ''
        let path2 = ''
        
        try {
            const urlObj1 = new URL(url1)
            path1 = urlObj1.pathname
            const urlObj2 = new URL(url2)
            path2 = urlObj2.pathname
        } catch (e) {
            // If URL parsing fails, try to extract path manually
            const match1 = url1.match(/\/\/[^\/]+(\/.*)?$/)
            const match2 = url2.match(/\/\/[^\/]+(\/.*)?$/)
            path1 = match1 ? (match1[1] || '') : ''
            path2 = match2 ? (match2[1] || '') : ''
        }
        
        // Normalize paths: remove leading/trailing slashes
        path1 = path1.replace(/^\/+|\/+$/g, '')
        path2 = path2.replace(/^\/+|\/+$/g, '')
        
        // If both paths are empty, they match (same domain)
        if (!path1 && !path2) {
            // Also check if hostnames match
            try {
                const host1 = new URL(url1).hostname
                const host2 = new URL(url2).hostname
                return host1 === host2
            } catch {
                return true
            }
        }
        
        // Split paths into segments
        const segments1 = path1.split('/').filter(s => s)
        const segments2 = path2.split('/').filter(s => s)
        
        // If both have no segments, they match
        if (segments1.length === 0 && segments2.length === 0) {
            try {
                const host1 = new URL(url1).hostname
                const host2 = new URL(url2).hostname
                return host1 === host2
            } catch {
                return true
            }
        }
        
        // Get parent paths (everything except last segment)
        const parent1 = segments1.slice(0, -1).join('/')
        const parent2 = segments2.slice(0, -1).join('/')
        
        // Match if parent paths are identical
        if (parent1 === parent2 && parent1 !== '') {
            return true
        }
        
        // Also check if hostnames match
        try {
            const host1 = new URL(url1).hostname
            const host2 = new URL(url2).hostname
            return host1 === host2 && parent1 === parent2
        } catch {
            return parent1 === parent2
        }
    } catch (error) {
        console.error('Error matching URLs:', error)
        return false
    }
}

