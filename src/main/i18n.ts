import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { app } from 'electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let translations: Record<string, any> = {}
let currentLanguage = 'zh'

/**
 * Get translation file path based on environment
 */
function getTranslationPath(lang: string): string | null {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
    
    // Try multiple possible paths in order of preference
    const possiblePaths: string[] = []

    if (isDev) {
        // Development: try dist-electron first, then source
        possiblePaths.push(
            // dist-electron/renderer/i18n/locales (built files)
            join(__dirname, '../renderer/i18n/locales', `${lang}.json`),
            join(__dirname, '../../renderer/i18n/locales', `${lang}.json`),
            // Source files (fallback for dev)
            join(__dirname, '../../src/renderer/i18n/locales', `${lang}.json`),
        )
    } else {
        // Production: try multiple possible paths
        possiblePaths.push(
            // Path relative to main.js in dist-electron/main
            join(__dirname, '../renderer/i18n/locales', `${lang}.json`),
            // Path relative to app root
            join(app.getAppPath(), 'renderer/i18n/locales', `${lang}.json`),
            // Path in dist directory (if copied there)
            join(app.getAppPath(), '../dist/renderer/i18n/locales', `${lang}.json`),
            // Path relative to resources
            join(process.resourcesPath || '', 'app/renderer/i18n/locales', `${lang}.json`),
            // Path relative to exec path
            join(dirname(process.execPath), 'resources/app/renderer/i18n/locales', `${lang}.json`),
            // Fallback: try source path (for development builds)
            join(__dirname, '../../src/renderer/i18n/locales', `${lang}.json`),
        )
    }
    
    // Try each path
    for (const tryPath of possiblePaths) {
        if (existsSync(tryPath)) {
            return tryPath
        }
    }
    
    // Log all attempted paths for debugging
    console.warn(`⚠️ Translation file not found for ${lang}. Tried paths:`)
    possiblePaths.forEach((p, i) => {
        console.warn(`  ${i + 1}. ${p} ${existsSync(p) ? '✅' : '❌'}`)
    })
    
    return null
}

/**
 * Load translations from JSON file
 */
export function loadTranslations(lang: string): void {
    try {
        const translationPath = getTranslationPath(lang)
        
        if (!translationPath) {
            throw new Error(`Translation file not found for language: ${lang}`)
        }
        
        const translationContent = readFileSync(translationPath, 'utf-8')
        translations = JSON.parse(translationContent)
        currentLanguage = lang
        console.log(`✅ Loaded translations for language: ${lang} from ${translationPath}`)
    } catch (error) {
        console.error(`❌ Failed to load translations for ${lang}:`, error)
        // Fallback to English if not already English
        if (lang !== 'en') {
            try {
                const fallbackPath = getTranslationPath('en')
                if (fallbackPath) {
                    const fallbackContent = readFileSync(fallbackPath, 'utf-8')
                    translations = JSON.parse(fallbackContent)
                    currentLanguage = 'en'
                    console.log(`✅ Fallback to English translations`)
                } else {
                    throw new Error('Fallback translation file not found')
                }
            } catch (fallbackError) {
                console.error(`❌ Failed to load fallback translations:`, fallbackError)
                translations = {}
            }
        } else {
            translations = {}
        }
    }
}

/**
 * Translate a key with optional parameters
 */
export function t(key: string, params?: Record<string, string>): string {
    const keys = key.split('.')
    let value: any = translations
    
    for (const k of keys) {
        value = value?.[k]
        if (value === undefined) {
            console.warn(`⚠️ Translation key not found: ${key}`)
            return key
        }
    }
    
    if (typeof value !== 'string') {
        console.warn(`⚠️ Translation value is not a string for key: ${key}`)
        return key
    }
    
    // Simple interpolation: replace {{key}} with params[key]
    if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (_match, paramKey) => {
            return params[paramKey] || ''
        })
    }
    
    return value
}

/**
 * Set current language and reload translations
 */
export function setLanguage(lang: string): void {
    loadTranslations(lang)
}

/**
 * Get current language
 */
export function getLanguage(): string {
    return currentLanguage
}

