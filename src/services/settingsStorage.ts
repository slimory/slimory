import fs from 'fs'
import path from 'path'
import { app, safeStorage } from 'electron'

export interface ProviderConfig {
    provider: string
    baseUrl: string
    model: string
}

export interface Settings {
    provider: string
    apiKey: string
    baseUrl: string
    model: string
    language?: string
    wordSelectionEnabled?: boolean
}

// Provider configurations
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    'deepseek': {
        provider: 'Deepseek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat'
    },
    'glm': {
        provider: 'GLM',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        model: 'glm-4.6'
    },
    'moonshot': {
        provider: 'Moonshot',
        baseUrl: 'https://api.moonshot.cn/v1',
        model: 'kimi-k2-0905-preview'
    },
    'openai': {
        provider: 'Openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo'
    },
    'anthropic': {
        provider: 'Anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-sonnet-4-5-20250929'
    },
    'gemini': {
        provider: 'Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash'
    }
}

export class SettingsStorage {
    private settingsFile: string
    private isEncryptionAvailable: boolean

    constructor() {
        // Use Electron's userData directory for storing settings
        const storageDir = app.getPath('userData')
        this.settingsFile = path.join(storageDir, 'settings.json')
        
        // Check if encryption is available
        this.isEncryptionAvailable = safeStorage.isEncryptionAvailable()
        
        // Ensure storage directory exists
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true })
        }
    }

    /**
     * Load all settings from file
     */
    private loadAllSettings(): any {
        try {
            if (!fs.existsSync(this.settingsFile)) {
                return {
                    currentProvider: '',
                    language: 'zh',
                    wordSelectionEnabled: true,
                    providers: {},
                    menuActions: ['explain', 'translate', 'ask']
                }
            }

            const data = fs.readFileSync(this.settingsFile, 'utf-8')
            const saved = JSON.parse(data)

            // Migrate old format to new format if needed
            if (saved.provider && !saved.providers) {
                const migrated: any = {
                    currentProvider: saved.provider,
                    language: saved.language || 'zh',
                    wordSelectionEnabled: saved.wordSelectionEnabled !== undefined ? saved.wordSelectionEnabled : true,
                    providers: {},
                    availableApps: saved.availableApps || [],
                    disabledApps: saved.disabledApps || [],
                    menuActions: saved.menuActions || ['explain', 'translate', 'ask']
                }
                
                if (saved.apiKey) {
                    migrated.providers[saved.provider] = {
                        apiKey: saved.apiKey,
                        encrypted: saved.encrypted || false
                    }
                }
                
                return migrated
            }

            return {
                currentProvider: saved.currentProvider || saved.provider || '',
                language: saved.language || 'zh',
                wordSelectionEnabled: saved.wordSelectionEnabled !== undefined ? saved.wordSelectionEnabled : true,
                providers: saved.providers || {},
                availableApps: saved.availableApps || [],
                disabledApps: saved.disabledApps || [],
                menuActions: saved.menuActions || ['explain', 'translate', 'ask']
            }
        } catch (error) {
            console.error('Error loading all settings:', error)
            return {
                currentProvider: '',
                language: 'zh',
                wordSelectionEnabled: true,
                providers: {},
                availableApps: [],
                disabledApps: [],
                menuActions: ['explain', 'translate', 'ask']
            }
        }
    }

    /**
     * Save all settings to file
     */
    private saveAllSettings(settings: any): boolean {
        try {
            fs.writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2), 'utf-8')
            return true
        } catch (error) {
            console.error('Error saving all settings:', error)
            return false
        }
    }

    /**
     * Save settings with encrypted API key (for backward compatibility)
     */
    saveSettings(settings: Settings): boolean {
        try {
            const allSettings = this.loadAllSettings()
            
            // Update current provider
            allSettings.currentProvider = settings.provider
            
            // Update language and wordSelectionEnabled
            allSettings.language = settings.language || allSettings.language || 'zh'
            allSettings.wordSelectionEnabled = settings.wordSelectionEnabled !== undefined ? settings.wordSelectionEnabled : allSettings.wordSelectionEnabled !== false

            // Save API key for the provider
            if (settings.apiKey) {
                if (!allSettings.providers) {
                    allSettings.providers = {}
                }
                
                // Encrypt API key if encryption is available
                if (this.isEncryptionAvailable) {
                    const encryptedKey = safeStorage.encryptString(settings.apiKey)
                    allSettings.providers[settings.provider] = {
                        apiKey: encryptedKey.toString('base64'),
                        encrypted: true
                    }
                } else {
                    // Fallback: store as plain text (not recommended but necessary if encryption unavailable)
                    console.warn('⚠️ Encryption not available, storing API key in plain text')
                    allSettings.providers[settings.provider] = {
                        apiKey: settings.apiKey,
                        encrypted: false
                    }
                }
            }

            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error saving settings:', error)
            return false
        }
    }

    /**
     * Save API key for a specific provider
     */
    saveProviderApiKey(provider: string, apiKey: string): boolean {
        try {
            const allSettings = this.loadAllSettings()
            
            if (!allSettings.providers) {
                allSettings.providers = {}
            }
            
            // Encrypt API key if encryption is available
            if (this.isEncryptionAvailable && apiKey) {
                const encryptedKey = safeStorage.encryptString(apiKey)
                allSettings.providers[provider] = {
                    apiKey: encryptedKey.toString('base64'),
                    encrypted: true
                }
            } else if (apiKey) {
                // Fallback: store as plain text
                console.warn('⚠️ Encryption not available, storing API key in plain text')
                allSettings.providers[provider] = {
                    apiKey: apiKey,
                    encrypted: false
                }
            }

            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error saving provider API key:', error)
            return false
        }
    }

    /**
     * Get API key for a specific provider
     */
    getProviderApiKey(provider: string): string | null {
        try {
            const allSettings = this.loadAllSettings()
            
            if (!allSettings.providers || !allSettings.providers[provider]) {
                return null
            }

            const providerData = allSettings.providers[provider]
            
            if (providerData.encrypted && this.isEncryptionAvailable) {
                try {
                    const encryptedBuffer = Buffer.from(providerData.apiKey, 'base64')
                    return safeStorage.decryptString(encryptedBuffer)
                } catch (error) {
                    console.error('Error decrypting API key:', error)
                    return null
                }
            } else {
                return providerData.apiKey || null
            }
        } catch (error) {
            console.error('Error getting provider API key:', error)
            return null
        }
    }

    /**
     * Set current provider
     */
    setCurrentProvider(provider: string): boolean {
        try {
            const allSettings = this.loadAllSettings()
            allSettings.currentProvider = provider
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error setting current provider:', error)
            return false
        }
    }

    /**
     * Get current provider
     */
    getCurrentProvider(): string {
        const allSettings = this.loadAllSettings()
        return allSettings.currentProvider || ''
    }

    /**
     * Load settings and decrypt API key (for backward compatibility)
     */
    loadSettings(): Settings | null {
        try {
            const allSettings = this.loadAllSettings()
            const currentProvider = allSettings.currentProvider || ''
            
            if (!currentProvider) {
                return null
            }

            const providerConfig = this.getProviderConfig(currentProvider)
            if (!providerConfig) {
                return null
            }

            const apiKey = this.getProviderApiKey(currentProvider) || ''

            return {
                provider: currentProvider,
                apiKey: apiKey,
                baseUrl: providerConfig.baseUrl,
                model: providerConfig.model,
                language: allSettings.language || 'zh',
                wordSelectionEnabled: allSettings.wordSelectionEnabled !== false
            }
        } catch (error) {
            console.error('Error loading settings:', error)
            return null
        }
    }

    /**
     * Check if settings exist
     */
    hasSettings(): boolean {
        const settings = this.loadSettings()
        return settings !== null && settings.provider !== '' && settings.apiKey !== ''
    }

    /**
     * Check if a provider has a verified API key
     */
    hasProviderApiKey(provider: string): boolean {
        const apiKey = this.getProviderApiKey(provider)
        return apiKey !== null && apiKey !== ''
    }

    /**
     * Get provider configuration
     */
    getProviderConfig(provider: string): ProviderConfig | null {
        return PROVIDER_CONFIGS[provider] || null
    }

    /**
     * Get all available providers
     */
    getAvailableProviders(): string[] {
        return Object.keys(PROVIDER_CONFIGS)
    }

    /**
     * Get available apps list
     */
    getAvailableApps(): Array<{ name: string; displayName: string }> {
        const allSettings = this.loadAllSettings()
        const apps = allSettings.availableApps || []
        
        // Migrate old format (string[]) to new format (object array)
        if (apps.length > 0 && typeof apps[0] === 'string') {
            const migratedApps = apps.map((app: string) => ({
                name: app.toLowerCase().trim(),
                displayName: app.charAt(0).toUpperCase() + app.slice(1)
            }))
            // Save migrated format
            allSettings.availableApps = migratedApps
            this.saveAllSettings(allSettings)
            return migratedApps
        }
        
        return apps
    }

    /**
     * Add app to available apps list if not exists
     */
    addAvailableApp(app: string, displayName?: string): boolean {
        try {
            const allSettings = this.loadAllSettings()
            if (!allSettings.availableApps) {
                allSettings.availableApps = []
            }
            
            // Migrate old format if needed
            if (allSettings.availableApps.length > 0 && typeof allSettings.availableApps[0] === 'string') {
                allSettings.availableApps = allSettings.availableApps.map((app: string) => ({
                    name: app.toLowerCase().trim(),
                    displayName: app.charAt(0).toUpperCase() + app.slice(1)
                }))
            }
            
            const normalizedApp = app.toLowerCase().trim()
            const finalDisplayName = displayName || app.charAt(0).toUpperCase() + app.slice(1)
            
            // Check if app already exists
            const exists = allSettings.availableApps.some((a: any) => 
                (typeof a === 'string' ? a.toLowerCase().trim() : a.name) === normalizedApp
            )
            
            if (normalizedApp && !exists) {
                allSettings.availableApps.push({
                    name: normalizedApp,
                    displayName: finalDisplayName
                })
                return this.saveAllSettings(allSettings)
            } else if (normalizedApp && exists) {
                // Update display name if app exists but display name is different
                const index = allSettings.availableApps.findIndex((a: any) => 
                    (typeof a === 'string' ? a.toLowerCase().trim() : a.name) === normalizedApp
                )
                if (index !== -1 && typeof allSettings.availableApps[index] === 'object') {
                    allSettings.availableApps[index].displayName = finalDisplayName
                    return this.saveAllSettings(allSettings)
                }
            }
            return true
        } catch (error) {
            console.error('Error adding available app:', error)
            return false
        }
    }

    /**
     * Get disabled apps list with display names
     */
    getDisabledApps(): Array<{ name: string; displayName: string }> {
        const allSettings = this.loadAllSettings()
        const disabledApps = allSettings.disabledApps || []
        const availableApps = this.getAvailableApps()
        
        // Convert disabled apps to object array with display names
        return disabledApps.map((appName: string) => {
            const normalizedName = appName.toLowerCase().trim()
            // Find display name from available apps
            const availableApp = availableApps.find(a => a.name === normalizedName)
            return {
                name: normalizedName,
                displayName: availableApp?.displayName || appName.charAt(0).toUpperCase() + appName.slice(1)
            }
        })
    }

    /**
     * Add app to disabled apps list
     */
    addDisabledApp(app: string): boolean {
        try {
            const allSettings = this.loadAllSettings()
            if (!allSettings.disabledApps) {
                allSettings.disabledApps = []
            }
            const normalizedApp = app.toLowerCase().trim()
            if (normalizedApp && !allSettings.disabledApps.includes(normalizedApp)) {
                allSettings.disabledApps.push(normalizedApp)
                return this.saveAllSettings(allSettings)
            }
            return true
        } catch (error) {
            console.error('Error adding disabled app:', error)
            return false
        }
    }

    /**
     * Remove app from disabled apps list
     */
    removeDisabledApp(app: string): boolean {
        try {
            const allSettings = this.loadAllSettings()
            if (!allSettings.disabledApps) {
                allSettings.disabledApps = []
            }
            const normalizedApp = app.toLowerCase().trim()
            allSettings.disabledApps = allSettings.disabledApps.filter((a: string) => a !== normalizedApp)
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error removing disabled app:', error)
            return false
        }
    }

    /**
     * Get menu actions list
     */
    getMenuActions(): string[] {
        const allSettings = this.loadAllSettings()
        return allSettings.menuActions || ['explain', 'translate', 'ask']
    }

    /**
     * Save menu actions list
     */
    saveMenuActions(actions: string[]): boolean {
        try {
            const allSettings = this.loadAllSettings()
            allSettings.menuActions = actions
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error saving menu actions:', error)
            return false
        }
    }
}

