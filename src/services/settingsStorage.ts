import fs from 'fs'
import path from 'path'
import { app, safeStorage } from 'electron'

export interface ProviderConfig {
    provider: string
    baseUrl: string
    model: string
}

export interface CustomAction {
    id: string
    name: string
    prompt: string
    icon?: string
    canEdit?: boolean
}

export interface Settings {
    provider: string
    apiKey: string
    baseUrl: string
    model: string
    customModel?: string
    reasoningEffort?: string
    language?: string
    wordSelectionEnabled?: boolean
    requireCtrlForMenu?: boolean
    autoCopyGenerated?: boolean
}

// Provider default-model overrides, keyed by pi-ai builtin provider id.
// The provider LIST and its name/baseUrl now come from the pi-ai catalog
// (see `get-available-providers` in src/main/main.ts). This map is used ONLY
// to pick a preferred default model per provider; `model` must exist in the
// pi-ai catalog for the provider, otherwise the first catalog model is used.
// `provider`/`baseUrl` are kept as legacy fallbacks for the raw-fetch path.
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    'deepseek': {
        provider: 'Deepseek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro'
    },
    'zai-coding-cn': {
        provider: 'GLM',
        baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
        model: 'glm-5.2'
    },
    'moonshotai': {
        provider: 'Moonshot',
        baseUrl: 'https://api.moonshot.cn/v1',
        model: 'kimi-k2.5'
    },
    'openai': {
        provider: 'Openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4-turbo'
    },
    'anthropic': {
        provider: 'Anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-sonnet-4-5-20250929'
    },
    'google': {
        provider: 'Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash'
    },
    'groq': {
        provider: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile'
    },
    'fireworks': {
        provider: 'Fireworks AI',
        baseUrl: 'https://api.fireworks.ai/inference/v1',
        model: 'accounts/fireworks/models/deepseek-v4-pro'
    },
    'minimax': {
        provider: 'Minimax',
        baseUrl: 'https://api.minimaxi.com/v1',
        model: 'MiniMax-M2.7'
    },
    'openrouter': {
        provider: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'deepseek/deepseek-chat'
    }
}

// Legacy app-level provider keys → pi-ai builtin catalog ids.
// Provider identity switched to pi-ai ids, so settings persisted under the old
// keys (moonshot/gemini/glm) are migrated once on load.
const LEGACY_PROVIDER_KEY_MAP: Record<string, string> = {
    'moonshot': 'moonshotai',
    'gemini': 'google',
    'glm': 'zai-coding-cn'
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
                    requireCtrlForMenu: false,
                    providers: {},
                    menuActions: ['explain', 'translate', 'ask'],
                    customActions: []
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
                    requireCtrlForMenu: saved.requireCtrlForMenu !== undefined ? saved.requireCtrlForMenu : false,
                    autoCopyGenerated: saved.autoCopyGenerated !== undefined ? saved.autoCopyGenerated : false,
                    providers: {},
                    availableApps: saved.availableApps || [],
                    disabledApps: saved.disabledApps || [],
                    menuActions: saved.menuActions || ['explain', 'translate', 'ask'],
                    customActions: []
                }
                
                if (saved.apiKey) {
                    migrated.providers[saved.provider] = {
                        apiKey: saved.apiKey,
                        encrypted: saved.encrypted || false
                    }
                }

                return this.migrateLegacyProviderKeys(migrated)
            }

            const allSettings = {
                currentProvider: saved.currentProvider || saved.provider || '',
                language: saved.language || 'zh',
                wordSelectionEnabled: saved.wordSelectionEnabled !== undefined ? saved.wordSelectionEnabled : true,
                requireCtrlForMenu: saved.requireCtrlForMenu !== undefined ? saved.requireCtrlForMenu : false,
                autoCopyGenerated: saved.autoCopyGenerated !== undefined ? saved.autoCopyGenerated : false,
                providers: saved.providers || {},
                availableApps: saved.availableApps || [],
                disabledApps: saved.disabledApps || [],
                menuActions: saved.menuActions || ['explain', 'translate', 'ask'],
                customActions: saved.customActions || []
            }
            return this.migrateLegacyProviderKeys(allSettings)
        } catch (error) {
            console.error('Error loading all settings:', error)
            return {
                currentProvider: '',
                language: 'zh',
                wordSelectionEnabled: true,
                requireCtrlForMenu: false,
                autoCopyGenerated: false,
                providers: {},
                availableApps: [],
                disabledApps: [],
                menuActions: ['explain', 'translate', 'ask'],
                customActions: []
            }
        }
    }

    /**
     * Migrate provider keys persisted under legacy app-level names to the
     * pi-ai builtin catalog ids (moonshot→moonshotai, gemini→google, glm→zai-coding-cn).
     */
    private migrateLegacyProviderKeys(allSettings: any): any {
        if (allSettings.currentProvider && LEGACY_PROVIDER_KEY_MAP[allSettings.currentProvider]) {
            allSettings.currentProvider = LEGACY_PROVIDER_KEY_MAP[allSettings.currentProvider]
        }
        if (allSettings.providers && typeof allSettings.providers === 'object') {
            for (const key of Object.keys(allSettings.providers)) {
                if (LEGACY_PROVIDER_KEY_MAP[key]) {
                    allSettings.providers[LEGACY_PROVIDER_KEY_MAP[key]] = allSettings.providers[key]
                    delete allSettings.providers[key]
                }
            }
        }
        return allSettings
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

            // Update language, wordSelectionEnabled, requireCtrlForMenu, and autoCopyGenerated
            allSettings.language = settings.language || allSettings.language || 'zh'
            allSettings.wordSelectionEnabled = settings.wordSelectionEnabled !== undefined ? settings.wordSelectionEnabled : allSettings.wordSelectionEnabled !== false
            allSettings.requireCtrlForMenu = settings.requireCtrlForMenu !== undefined ? settings.requireCtrlForMenu : allSettings.requireCtrlForMenu !== undefined ? allSettings.requireCtrlForMenu : false
            allSettings.autoCopyGenerated = settings.autoCopyGenerated !== undefined ? settings.autoCopyGenerated : allSettings.autoCopyGenerated !== undefined ? allSettings.autoCopyGenerated : false

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
                        model: settings.model,
                        baseUrl: settings.baseUrl,
                        reasoningEffort: settings.reasoningEffort || 'off',
                        encrypted: true
                    }
                } else {
                    // Fallback: store as plain text (not recommended but necessary if encryption unavailable)
                    console.warn('⚠️ Encryption not available, storing API key in plain text')
                    allSettings.providers[settings.provider] = {
                        apiKey: settings.apiKey,
                        model: settings.model,
                        baseUrl: settings.baseUrl,
                        reasoningEffort: settings.reasoningEffort || 'off',
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

            const providerConfig = allSettings.providers[provider] || {}
            // Encrypt API key if encryption is available
            if (this.isEncryptionAvailable && apiKey) {
                const encryptedKey = safeStorage.encryptString(apiKey)
                providerConfig.apiKey = encryptedKey.toString('base64')
                providerConfig.encrypted = true
            } else if (apiKey) {
                // Fallback: store as plain text
                console.warn('⚠️ Encryption not available, storing API key in plain text')
                providerConfig.apiKey = apiKey
                providerConfig.encrypted = false
            }

            allSettings.providers[provider] = providerConfig
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error saving provider API key:', error)
            return false
        }
    }

    /**
     * Get model for a specific provider
     */
    getProviderModel(provider: string): string | null {
        try {
            const allSettings = this.loadAllSettings()

            if (!allSettings.providers || !allSettings.providers[provider]) {
                return null
            }

            return allSettings.providers[provider].model || null
        } catch (error) {
            console.error('Error getting provider model:', error)
            return null
        }
    }

    /**
     * Get reasoning effort for a specific provider
     */
    getProviderReasoningEffort(provider: string): string {
        try {
            const allSettings = this.loadAllSettings()

            if (!allSettings.providers || !allSettings.providers[provider]) {
                return 'off'
            }

            return allSettings.providers[provider].reasoningEffort || 'off'
        } catch (error) {
            console.error('Error getting provider reasoning effort:', error)
            return 'off'
        }
    }

    /**
     * Save reasoning effort for a specific provider
     */
    saveProviderReasoningEffort(provider: string, effort: string): boolean {
        try {
            const allSettings = this.loadAllSettings()

            if (!allSettings.providers) {
                allSettings.providers = {}
            }

            if (!allSettings.providers[provider]) {
                allSettings.providers[provider] = {}
            }

            allSettings.providers[provider].reasoningEffort = effort
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error saving provider reasoning effort:', error)
            return false
        }
    }

    /**
     * Save model for a specific provider
     */
    saveProviderModel(provider: string, model: string): boolean {
        try {
            const allSettings = this.loadAllSettings()

            if (!allSettings.providers) {
                allSettings.providers = {}
            }

            if (!allSettings.providers[provider]) {
                allSettings.providers[provider] = {}
            }

            allSettings.providers[provider].model = model
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error saving provider model:', error)
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

            // if (!currentProvider) {
            //     return null
            // }

            const providerConfig = currentProvider? this.getProviderConfig(currentProvider) : null
            // if (!providerConfig) {
            //     return null
            // }

            const apiKey = currentProvider? this.getProviderApiKey(currentProvider) || '' : ''
            const customModel = currentProvider? this.getProviderModel(currentProvider) : ''
            const reasoningEffort = currentProvider? this.getProviderReasoningEffort(currentProvider) : 'off'

            return {
                provider: currentProvider,
                apiKey: apiKey,
                baseUrl: providerConfig?.baseUrl || '',
                model: customModel || providerConfig?.model || '',
                customModel: customModel || undefined,
                reasoningEffort: reasoningEffort,
                language: allSettings.language || 'zh',
                wordSelectionEnabled: allSettings.wordSelectionEnabled !== false,
                requireCtrlForMenu: allSettings.requireCtrlForMenu !== undefined ? allSettings.requireCtrlForMenu : false,
                autoCopyGenerated: allSettings.autoCopyGenerated !== undefined ? allSettings.autoCopyGenerated : false
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
    getProviderConfig(provider: string): ProviderConfig {
        // First, try to get saved provider config from allSettings
        const allSettings = this.loadAllSettings()
        const savedProviderConfig = allSettings.providers?.[provider]

        if (savedProviderConfig) {
            // Return saved config with baseUrl if available
            return {
                provider,
                baseUrl: savedProviderConfig.baseUrl || PROVIDER_CONFIGS[provider]?.baseUrl || '',
                model: savedProviderConfig.model || PROVIDER_CONFIGS[provider]?.model || ''
            }
        }

        // Fallback to PROVIDER_CONFIGS (default-model source)
        // The provider list and its name/baseUrl come from the pi-ai catalog (see main.ts).
        // Unknown pi-ai providers get an empty config so the app can still save/verify them.
        return PROVIDER_CONFIGS[provider] || { provider, baseUrl: '', model: '' }
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

    /**
     * Get all custom actions
     */
    getCustomActions(): CustomAction[] {
        const allSettings = this.loadAllSettings()
        return allSettings.customActions || []
    }

    /**
     * Add a custom action
     */
    addCustomAction(action: CustomAction): boolean {
        try {
            const allSettings = this.loadAllSettings()
            if (!allSettings.customActions) {
                allSettings.customActions = []
            }
            allSettings.customActions.push(action)
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error adding custom action:', error)
            return false
        }
    }

    /**
     * Update a custom action
     */
    updateCustomAction(id: string, updated: Partial<Omit<CustomAction, 'id'>>): boolean {
        try {
            const allSettings = this.loadAllSettings()
            if (!allSettings.customActions) return false
            const index = allSettings.customActions.findIndex((a: CustomAction) => a.id === id)
            if (index === -1) return false
            allSettings.customActions[index] = { ...allSettings.customActions[index], ...updated }
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error updating custom action:', error)
            return false
        }
    }

    /**
     * Delete a custom action
     */
    deleteCustomAction(id: string): boolean {
        try {
            const allSettings = this.loadAllSettings()
            if (!allSettings.customActions) return true
            allSettings.customActions = allSettings.customActions.filter((a: CustomAction) => a.id !== id)
            // Also remove from menuActions if present
            if (allSettings.menuActions) {
                allSettings.menuActions = allSettings.menuActions.filter((a: string) => a !== `custom:${id}`)
            }
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error deleting custom action:', error)
            return false
        }
    }

    /**
     * Get requireCtrlForMenu setting
     */
    getRequireCtrlForMenu(): boolean {
        const allSettings = this.loadAllSettings()
        return allSettings.requireCtrlForMenu !== undefined ? allSettings.requireCtrlForMenu : false
    }

    /**
     * Save requireCtrlForMenu setting
     */
    saveRequireCtrlForMenu(requireCtrl: boolean): boolean {
        try {
            const allSettings = this.loadAllSettings()
            allSettings.requireCtrlForMenu = requireCtrl
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error saving requireCtrlForMenu setting:', error)
            return false
        }
    }

    /**
     * Get autoCopyGenerated setting
     */
    getAutoCopyGenerated(): boolean {
        const allSettings = this.loadAllSettings()
        return allSettings.autoCopyGenerated !== undefined ? allSettings.autoCopyGenerated : false
    }

    /**
     * Save autoCopyGenerated setting
     */
    saveAutoCopyGenerated(autoCopy: boolean): boolean {
        try {
            const allSettings = this.loadAllSettings()
            allSettings.autoCopyGenerated = autoCopy
            return this.saveAllSettings(allSettings)
        } catch (error) {
            console.error('Error saving autoCopyGenerated setting:', error)
            return false
        }
    }
}

