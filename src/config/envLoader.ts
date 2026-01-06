// Environment configuration utility
// This file handles loading environment variables from .env.dev in development

import fs from 'fs'
import path from 'path'

// Helper function to load environment variables from a file
const loadEnvFile = (filePath: string): Record<string, string> => {
    const envVars: Record<string, string> = {}
    
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8')
            const lines = content.split('\n')
            
            for (const line of lines) {
                const trimmedLine = line.trim()
                
                // Skip empty lines and comments
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                    continue
                }
                
                // Parse KEY=VALUE format
                const equalIndex = trimmedLine.indexOf('=')
                if (equalIndex > 0) {
                    const key = trimmedLine.substring(0, equalIndex).trim()
                    const value = trimmedLine.substring(equalIndex + 1).trim()
                    
                    // Remove quotes if present
                    const cleanValue = value.replace(/^["']|["']$/g, '')
                    envVars[key] = cleanValue
                }
            }
        }
    } catch (error) {
        console.warn(`Failed to load environment file ${filePath}:`, error)
    }
    
    return envVars
}

// Helper function to get API key based on environment
export const getApiKey = (): string => {
    // Try to load from .env.dev file
    const projectRoot = process.cwd()
    const envDevPath = path.join(projectRoot, '.env.dev')
    const envDevVars = loadEnvFile(envDevPath)
    
    // Check .env.dev first, then fallback to environment variables
    return envDevVars.OPENAI_API_KEY || 
            process.env.OPENAI_API_KEY || 
            ''
}

// Helper function to get base URL based on environment
export const getBaseUrl = (defaultValue: string = 'https://api.deepseek.com'): string => {
    // Try to load from .env.dev file
    const projectRoot = process.cwd()
    const envDevPath = path.join(projectRoot, '.env.dev')
    const envDevVars = loadEnvFile(envDevPath)
    
    // Check .env.dev first, then fallback to environment variables
    return envDevVars.OPENAI_API_BASE_URL || 
            process.env.OPENAI_API_BASE_URL || 
            defaultValue
}

// Helper function to get model based on environment
export const getModel = (defaultValue: string = 'deepseek-chat'): string => {
    // Try to load from .env.dev file
    const projectRoot = process.cwd()
    const envDevPath = path.join(projectRoot, '.env.dev')
    const envDevVars = loadEnvFile(envDevPath)
    
    // Check .env.dev first, then fallback to environment variables
    return envDevVars.OPENAI_API_MODEL || 
            process.env.OPENAI_API_MODEL || 
            defaultValue
}

// Export the loadEnvFile function for other uses
export { loadEnvFile }
