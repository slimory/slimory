import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import './OnboardingPanel.css'
import closeIcon from '../assets/icons/close.svg'
import TagListSelector from './TagListSelector'
import IconPicker, { getIconComponent } from './IconPicker'

interface Provider {
    provider: string
    providerName: string
    baseUrl: string
    model: string
}

const languages = [
    { code: 'zh', name: '中文' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'ja', name: '日本語' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'pt', name: 'Português' },
    { code: 'ar', name: 'العربية' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'bn', name: 'বাংলা' }
]

const reasoningLevels = [
    { value: 'off', label: 'None' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'X-High' },
    { value: 'max', label: 'Max' },
]

const SettingsPanel = () => {
    const { t } = useTranslation()
    const [selectedLanguage, setSelectedLanguage] = useState<string>('zh')
    const [selectedProvider, setSelectedProvider] = useState<string>('deepseek')
    const [apiKey, setApiKey] = useState<string>('')
    const [model, setModel] = useState<string>('')
    const [reasoningEffort, setReasoningEffort] = useState<string>('off')
    const [wordSelectionEnabled, setWordSelectionEnabled] = useState<boolean>(true)
    const [requireCtrlForMenu, setRequireCtrlForMenu] = useState<boolean>(false)
    const [autoCopyGenerated, setAutoCopyGenerated] = useState<boolean>(false)
    const [isVerifying, setIsVerifying] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [availableProviders, setAvailableProviders] = useState<Provider[]>([])
    const [isReady, setIsReady] = useState<boolean>(false)
    const [availableApps, setAvailableApps] = useState<Array<{ name: string; displayName: string }>>([])
    const [disabledApps, setDisabledApps] = useState<Array<{ name: string; displayName: string }>>([])
    const [menuActions, setMenuActions] = useState<Array<{ name: string; displayName: string }>>([])
    const [menuActionsError, setMenuActionsError] = useState<string | null>(null)
    const [reasoningDropdownOpen, setReasoningDropdownOpen] = useState(false)
    const reasoningDropdownRef = useRef<HTMLDivElement>(null)
    const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([])
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
    const modelDropdownRef = useRef<HTMLDivElement>(null)
    const modelDropdownButtonRef = useRef<HTMLButtonElement>(null)

    // Custom actions state
    const [customActions, setCustomActions] = useState<Array<{ id: string; name: string; prompt: string; icon?: string; canEdit?: boolean }>>([])
    const [isAddingCustomAction, setIsAddingCustomAction] = useState(false)
    const [editingCustomActionId, setEditingCustomActionId] = useState<string | null>(null)
    const [customActionName, setCustomActionName] = useState('')
    const [customActionPrompt, setCustomActionPrompt] = useState('')
    const [customActionCanEdit, setCustomActionCanEdit] = useState(false)
    const [customActionIcon, setCustomActionIcon] = useState<string>('Type')

    // Available menu actions - use useMemo to update when language changes
    const availableMenuActions: Array<{ name: string; displayName: string }> = useMemo(() => [
        { name: 'explain', displayName: t('menu.explain') },
        { name: 'translate', displayName: t('menu.translate') },
        { name: 'ask', displayName: t('menu.ask') },
        { name: 'modify', displayName: t('menu.modify') },
        ...customActions.map(ca => ({ name: `custom:${ca.id}`, displayName: ca.name }))
    ], [t, selectedLanguage, customActions])
    
    // Provider dropdown state
    const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false)
    const providerDropdownRef = useRef<HTMLDivElement>(null)
    const providerDropdownButtonRef = useRef<HTMLButtonElement>(null)
    
    // Language dropdown state
    const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false)
    const languageDropdownRef = useRef<HTMLDivElement>(null)
    const languageDropdownButtonRef = useRef<HTMLButtonElement>(null)

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            if (!window.electronAPI) return
            
            try {
                // Load available providers
                const providersResult = await window.electronAPI.getAvailableProviders()
                if (providersResult.success) {
                    setAvailableProviders(providersResult.providers)
                }
                
                // Load word selection setting
                const allSettingsResult = await window.electronAPI.getAllSettings()
                if (allSettingsResult.success) {
                    const currentProvider = allSettingsResult.settings?.provider || 'deepseek'
                    setSelectedProvider(currentProvider)
                    // Load API key for current provider
                    const apiKeyResult = await window.electronAPI.getProviderApiKey(currentProvider)
                    if (apiKeyResult.success && apiKeyResult.apiKey) {
                        setApiKey(apiKeyResult.apiKey)
                    } else {
                        setApiKey('')
                    }
                    // Load model for current provider
                    const provider = providersResult.providers?.find((p: Provider) => p.provider === currentProvider)
                    const defaultModelValue = provider?.model || ''

                    // Load available models first
                    const modelsResult = await window.electronAPI.getProviderModels(currentProvider)
                    if (modelsResult.success) {
                        setAvailableModels(modelsResult.models || [])
                    }

                    const modelResult = await window.electronAPI.getProviderModel(currentProvider)
                    const models = modelsResult.success ? (modelsResult.models || []) : []
                    const configDefault = defaultModelValue
                    if (modelResult.success && modelResult.model) {
                        const savedModel = modelResult.model
                        if (models.some((m: any) => m.id === savedModel)) {
                            setModel(savedModel)
                        } else if (configDefault && models.some((m: any) => m.id === configDefault)) {
                            setModel(configDefault)
                        } else if (models.length > 0) {
                            setModel(models[0].id)
                        } else {
                            setModel('')
                        }
                    } else {
                        // No saved model, resolve from PROVIDER_CONFIGS default or first available
                        if (configDefault && models.some((m: any) => m.id === configDefault)) {
                            setModel(configDefault)
                        } else if (models.length > 0) {
                            setModel(models[0].id)
                        } else {
                            setModel('')
                        }
                    }
                    // Load reasoning effort
                    const reasoningResult = await window.electronAPI.getProviderReasoningEffort(currentProvider)
                    if (reasoningResult.success) {
                        setReasoningEffort(reasoningResult.effort || 'off')
                    }
                    setWordSelectionEnabled(allSettingsResult.settings?.wordSelectionEnabled !== false)
                    const language = allSettingsResult.settings?.language || 'zh'
                    setSelectedLanguage(language)
                    i18n.changeLanguage(language)
                }

                // Load requireCtrlForMenu setting
                const requireCtrlResult = await window.electronAPI.getRequireCtrlForMenu()
                if (requireCtrlResult.success) {
                    setRequireCtrlForMenu(requireCtrlResult.requireCtrl)
                }

                // Load autoCopyGenerated setting
                const autoCopyResult = await window.electronAPI.getAutoCopyGenerated()
                if (autoCopyResult.success) {
                    setAutoCopyGenerated(autoCopyResult.autoCopy)
                }

                // Load available apps and disabled apps
                const availableAppsResult = await window.electronAPI.getAvailableApps()
                if (availableAppsResult.success) {
                    setAvailableApps(availableAppsResult.apps || [])
                }
                
                const disabledAppsResult = await window.electronAPI.getDisabledApps()
                if (disabledAppsResult.success) {
                    setDisabledApps(disabledAppsResult.apps || [])
                }
                
                // Load custom actions (before menu actions, so we can resolve display names)
                let loadedCustomActions: Array<{ id: string; name: string; prompt: string }> = []
                const customActionsResult = await window.electronAPI.getCustomActions()
                if (customActionsResult.success) {
                    loadedCustomActions = customActionsResult.actions || []
                    setCustomActions(loadedCustomActions)
                }

                // Load menu actions - use i18n.t() to ensure correct language after changeLanguage
                const menuActionsResult = await window.electronAPI.getMenuActions()
                if (menuActionsResult.success) {
                    const actions = menuActionsResult.actions || ['explain', 'translate', 'ask']
                    const actionItems = actions.map(action => {
                        if (action.startsWith('custom:')) {
                            const customId = action.replace('custom:', '')
                            const ca = loadedCustomActions.find(a => a.id === customId)
                            return { name: action, displayName: ca?.name || action }
                        }
                        return { name: action, displayName: i18n.t('menu.' + action) }
                    })
                    setMenuActions(actionItems)
                }
                
                setIsReady(true)
            } catch (error) {
                console.error('Error loading settings:', error)
            }
        }
        
        loadSettings()
    }, [])

    // Update menuActions display names when language changes
    useEffect(() => {
        if (menuActions.length > 0) {
            setMenuActions(prev => prev.map(action => {
                if (action.name.startsWith('custom:')) {
                    const customId = action.name.replace('custom:', '')
                    const ca = customActions.find(a => a.id === customId)
                    return { ...action, displayName: ca?.name || action.name }
                }
                return { ...action, displayName: t('menu.' + action.name) }
            }))
        }
    }, [selectedLanguage, t])

    const handleClose = () => {
        if (window.electronAPI) {
            window.electronAPI.closeSettingsWindow()
        }
    }

    const openLanguageDropdown = () => {
        setIsLanguageDropdownOpen(true)
    }
    
    const closeLanguageDropdown = () => {
        setIsLanguageDropdownOpen(false)
    }

    const handleLanguageDropdownClick = () => {
        if (!isLanguageDropdownOpen) openLanguageDropdown()
        else closeLanguageDropdown()
    }

    const handleLanguageSelect = async (language: string) => {
        setSelectedLanguage(language)
        i18n.changeLanguage(language)
        setMenuActions(prev => prev.map(action => {
            if (action.name.startsWith('custom:')) {
                const customId = action.name.replace('custom:', '')
                const ca = customActions.find(a => a.id === customId)
                return { ...action, displayName: ca?.name || action.name }
            }
            return { ...action, displayName: t('menu.' + action.name) }
        }))
        closeLanguageDropdown()
        if (window.electronAPI) {
            // Auto save language
            try {
                await window.electronAPI.saveLanguage(language)
            } catch (error) {
                console.error('Error saving language:', error)
            }
        }
    }
    
    // Get current language display name
    const getCurrentLanguageName = () => {
        const lang = languages.find(l => l.code === selectedLanguage)
        return lang ? lang.name : '中文'
    }

    const handleVerifyApiKey = async () => {
        if (!apiKey.trim()) {
            setError(t('settings.errorNoApiKey'))
            return
        }

        setIsVerifying(true)
        setError(null)
        setSuccess(null)

        try {
            // Pass model to verify (use custom model if provided, otherwise undefined to use default)
            const verifyModel = model.trim() ? model : undefined
            const verifyResult = await window.electronAPI.verifyApiKey(selectedProvider, apiKey, verifyModel)
            if (!verifyResult.success) {
                // Show the full error message from the server
                const errorMsg = verifyResult.error || t('settings.errorVerificationFailed')
                setError(errorMsg)
                setIsVerifying(false)
                return
            }

            // Save the API key and model for this provider (saveSettings already updates chatService)
            const saveModel = model.trim() ? model : undefined
            const saveResult = await window.electronAPI.saveSettings(selectedProvider, apiKey, saveModel)
            if (!saveResult.success) {
                setError(t('settings.errorSaveFailed'))
                setIsVerifying(false)
                return
            }
            // Also save reasoning effort
            await window.electronAPI.saveProviderReasoningEffort(selectedProvider, reasoningEffort)

            setSuccess(t('settings.verifiedSuccess'))

            // Keep API key in input for user to see it's saved (masked as password type)
            // Don't clear it so user knows it's saved
        } catch (err) {
            console.error('Error verifying API key:', err)
            setError(t('settings.errorVerify'))
        } finally {
            setIsVerifying(false)
        }
    }

    const handleWordSelectionChange = async (enabled: boolean) => {
        setWordSelectionEnabled(enabled)
        // Auto save word selection setting
        try {
            await window.electronAPI.saveWordSelectionEnabled(enabled)
        } catch (error) {
            console.error('Error saving word selection setting:', error)
            setError(t('settings.errorSaveFailed'))
            setTimeout(() => setError(null), 2000)
        }
    }

    const handleRequireCtrlForMenuChange = async (requireCtrl: boolean) => {
        setRequireCtrlForMenu(requireCtrl)
        // Auto save requireCtrlForMenu setting
        try {
            await window.electronAPI.saveRequireCtrlForMenu(requireCtrl)
        } catch (error) {
            console.error('Error saving requireCtrlForMenu setting:', error)
            setError(t('settings.errorSaveFailed'))
            setTimeout(() => setError(null), 2000)
        }
    }

    const handleAutoCopyGeneratedChange = async (autoCopy: boolean) => {
        setAutoCopyGenerated(autoCopy)
        // Auto save autoCopyGenerated setting
        try {
            await window.electronAPI.saveAutoCopyGenerated(autoCopy)
        } catch (error) {
            console.error('Error saving autoCopyGenerated setting:', error)
            setError(t('settings.errorSaveFailed'))
            setTimeout(() => setError(null), 2000)
        }
    }

    const openProviderDropdown = () => {
        setIsProviderDropdownOpen(true)
    }
    
    const closeProviderDropdown = () => {
        setIsProviderDropdownOpen(false)
    }

    const handleProviderDropdownClick = () => {
        if (!isVerifying) {
            if (!isProviderDropdownOpen) openProviderDropdown()
            else closeProviderDropdown()
        }
    }

    const handleProviderSelect = async (provider: string) => {
        setSelectedProvider(provider)
        closeProviderDropdown()
        setError(null)
        setSuccess(null)

        // Load API key for the selected provider
        if (window.electronAPI) {
            try {
                const result = await window.electronAPI.getProviderApiKey(provider)
                if (result.success && result.apiKey) {
                    // Show the API key in the input (will be masked as password type)
                    setApiKey(result.apiKey)

                    // If this provider has a verified API key, set it as current provider
                    await window.electronAPI.setCurrentProvider(provider)
                } else {
                    // No API key for this provider, clear the input
                    setApiKey('')
                }

                // Load model for the selected provider
                const providerInfo = availableProviders.find(p => p.provider === provider)
                const defaultModelValue = providerInfo?.model || ''

                // Load available models for this provider first
                const modelsResult = await window.electronAPI.getProviderModels(provider)
                if (modelsResult.success) {
                    setAvailableModels(modelsResult.models || [])
                }

                const modelResult = await window.electronAPI.getProviderModel(provider)
                const models = modelsResult.success ? (modelsResult.models || []) : []
                const configDefault = defaultModelValue
                if (modelResult.success && modelResult.model) {
                    const savedModel = modelResult.model
                    if (models.some((m: any) => m.id === savedModel)) {
                        setModel(savedModel)
                    } else if (configDefault && models.some((m: any) => m.id === configDefault)) {
                        setModel(configDefault)
                    } else if (models.length > 0) {
                        setModel(models[0].id)
                    } else {
                        setModel('')
                    }
                } else {
                    // No saved model, resolve from PROVIDER_CONFIGS default or first available
                    if (configDefault && models.some((m: any) => m.id === configDefault)) {
                        setModel(configDefault)
                    } else if (models.length > 0) {
                        setModel(models[0].id)
                    } else {
                        setModel('')
                    }
                }
                // Load reasoning effort
                const reasoningResult = await window.electronAPI.getProviderReasoningEffort(provider)
                if (reasoningResult.success) {
                    setReasoningEffort(reasoningResult.effort || 'off')
                }
            } catch (error) {
                console.error('Error loading provider API key:', error)
                setApiKey('')
            }
        }
    }

    // Close provider dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                providerDropdownRef.current && 
                !providerDropdownRef.current.contains(event.target as Node) &&
                providerDropdownButtonRef.current &&
                !providerDropdownButtonRef.current.contains(event.target as Node)
            ) {
                closeProviderDropdown()
            }
        }

        if (isProviderDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isProviderDropdownOpen])

    // Close language dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                languageDropdownRef.current &&
                !languageDropdownRef.current.contains(event.target as Node) &&
                languageDropdownButtonRef.current &&
                !languageDropdownButtonRef.current.contains(event.target as Node)
            ) {
                closeLanguageDropdown()
            }
        }

        if (isLanguageDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isLanguageDropdownOpen])

    // Close reasoning dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                reasoningDropdownRef.current &&
                !reasoningDropdownRef.current.contains(event.target as Node)
            ) {
                setReasoningDropdownOpen(false)
            }
        }

        if (reasoningDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [reasoningDropdownOpen])

    // Close model dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                modelDropdownRef.current &&
                !modelDropdownRef.current.contains(event.target as Node) &&
                modelDropdownButtonRef.current &&
                !modelDropdownButtonRef.current.contains(event.target as Node)
            ) {
                setModelDropdownOpen(false)
            }
        }

        if (modelDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [modelDropdownOpen])

    const handleAddDisabledApp = async (app: string) => {
        const result = await window.electronAPI.addDisabledApp(app)
        if (result.success) {
            // Find display name from available apps
            const availableApp = availableApps.find(a => a.name === app.toLowerCase())
            const displayName = availableApp?.displayName || app.charAt(0).toUpperCase() + app.slice(1)
            setDisabledApps([...disabledApps, { name: app.toLowerCase(), displayName }])
        }
    }

    const handleRemoveDisabledApp = async (app: string) => {
        const result = await window.electronAPI.removeDisabledApp(app)
        if (result.success) {
            setDisabledApps(disabledApps.filter(a => a.name !== app.toLowerCase()))
        }
    }

    const handleAddMenuAction = async (actionName: string) => {
        const normalizedName = actionName.toLowerCase()
        if (menuActions.some(item => item.name.toLowerCase() === normalizedName)) {
            return
        }
        // Clear error when adding action
        setMenuActionsError(null)
        
        const availableAction = availableMenuActions.find(a => a.name === normalizedName)
        const newAction = availableAction || { name: normalizedName, displayName: normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1) }
        const newActions = [...menuActions, newAction]
        setMenuActions(newActions)
        const result = await window.electronAPI.saveMenuActions(newActions.map(a => a.name))
        if (!result.success) {
            console.error('Error saving menu actions:', result.error)
            // Revert on error
            const menuActionsResult = await window.electronAPI.getMenuActions()
            if (menuActionsResult.success) {
                const actions = menuActionsResult.actions || ['explain', 'translate', 'ask']
                const actionItems = actions.map(action => {
                    const availableAction = availableMenuActions.find(a => a.name === action)
                    return availableAction || { name: action, displayName: action.charAt(0).toUpperCase() + action.slice(1) }
                })
                setMenuActions(actionItems)
            }
        }
    }

    const handleRemoveMenuAction = async (actionName: string) => {
        // Check if only one action remains
        if (menuActions.length === 1) {
            setMenuActionsError(t('settings.errorAtLeastOneAction'))
            // Clear error after 3 seconds
            setTimeout(() => setMenuActionsError(null), 3000)
            return
        }
        
        // Clear error if removal is successful
        setMenuActionsError(null)
        
        const normalizedName = actionName.toLowerCase()
        const newActions = menuActions.filter(a => a.name.toLowerCase() !== normalizedName)
        setMenuActions(newActions)
        const result = await window.electronAPI.saveMenuActions(newActions.map(a => a.name))
        if (!result.success) {
            console.error('Error saving menu actions:', result.error)
            // Revert on error
            const menuActionsResult = await window.electronAPI.getMenuActions()
            if (menuActionsResult.success) {
                const actions = menuActionsResult.actions || ['explain', 'translate', 'ask']
                const actionItems = actions.map(action => {
                    const availableAction = availableMenuActions.find(a => a.name === action)
                    return availableAction || { name: action, displayName: action.charAt(0).toUpperCase() + action.slice(1) }
                })
                setMenuActions(actionItems)
            }
        }
    }

    const handleAddCustomAction = async () => {
        if (!customActionName.trim() || !customActionPrompt.trim()) return
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
        const newAction = { id, name: customActionName.trim(), prompt: customActionPrompt.trim(), icon: customActionIcon, canEdit: customActionCanEdit }
        const result = await window.electronAPI.addCustomAction(newAction)
        if (result.success) {
            setCustomActions([...customActions, newAction])
            setCustomActionName('')
            setCustomActionPrompt('')
            setCustomActionCanEdit(false)
            setCustomActionIcon('Type')
            setIsAddingCustomAction(false)

            // Auto-add the new custom action to menu actions
            const customActionEntry = `custom:${id}`
            if (!menuActions.some(item => item.name === customActionEntry)) {
                const newActions = [...menuActions, { name: customActionEntry, displayName: newAction.name }]
                setMenuActions(newActions)
                await window.electronAPI.saveMenuActions(newActions.map(a => a.name))
            }
        }
    }

    const handleEditCustomAction = async () => {
        if (!editingCustomActionId || !customActionName.trim() || !customActionPrompt.trim()) return
        const updated = { name: customActionName.trim(), prompt: customActionPrompt.trim(), icon: customActionIcon, canEdit: customActionCanEdit }
        const result = await window.electronAPI.updateCustomAction(editingCustomActionId, updated)
        if (result.success) {
            setCustomActions(customActions.map(a => a.id === editingCustomActionId ? { ...a, ...updated } : a))
            // Sync the updated name to menuActions displayName
            setMenuActions(prev => prev.map(action => {
                if (action.name === `custom:${editingCustomActionId}`) {
                    return { ...action, displayName: updated.name }
                }
                return action
            }))
            setCustomActionName('')
            setCustomActionPrompt('')
            setCustomActionCanEdit(false)
            setCustomActionIcon('Type')
            setEditingCustomActionId(null)
        }
    }

    const handleDeleteCustomAction = async (id: string) => {
        const result = await window.electronAPI.deleteCustomAction(id)
        if (result.success) {
            setCustomActions(customActions.filter(a => a.id !== id))
            // Also remove from menuActions so it doesn't appear as a ghost entry
            const deletedActionName = `custom:${id}`
            setMenuActions(prev => prev.filter(a => a.name !== deletedActionName))
        }
    }

    const startEditCustomAction = (action: { id: string; name: string; prompt: string; icon?: string; canEdit?: boolean }) => {
        setEditingCustomActionId(action.id)
        setCustomActionName(action.name)
        setCustomActionPrompt(action.prompt)
        setCustomActionCanEdit(action.canEdit || false)
        setCustomActionIcon(action.icon || 'Type')
        setIsAddingCustomAction(false)
    }

    const cancelCustomActionForm = () => {
        setIsAddingCustomAction(false)
        setEditingCustomActionId(null)
        setCustomActionName('')
        setCustomActionPrompt('')
        setCustomActionCanEdit(false)
        setCustomActionIcon('Type')
    }

    // Auto-hide error and success messages after 15 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null)
            }, 15000)
            return () => clearTimeout(timer)
        }
    }, [error])

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => {
                setSuccess(null)
            }, 3000)
            return () => clearTimeout(timer)
        }
    }, [success])

    return (
        isReady ? (
        <div className="onboarding-container ready">
            <div className="onboarding-panel">
                <div className="onboarding-header" style={{ 
                    position: 'relative', 
                    zIndex: 2, 
                    background: 'rgba(255, 255, 255, 0.8)',
                    padding: '20px 24px', 
                    WebkitAppRegion: 'drag' } as React.CSSProperties}
                >
                    <h1 className="onboarding-title" style={{ fontSize: '16px', textAlign: 'left', margin: 0 }}>{t('settings.title')}</h1>
                    <button
                        onClick={handleClose}
                        style={{
                            position: 'absolute',
                            top: '15px',
                            right: '15px',
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px',
                            borderRadius: '16px',
                            transition: 'background 0.2s ease',
                            WebkitAppRegion: 'no-drag'
                        } as React.CSSProperties}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                        }}
                    >
                        <img 
                            src={closeIcon} 
                            alt="Close" 
                            style={{ 
                                width: '20px', 
                                height: '20px',
                                filter: 'invert(0.3)'
                            }} 
                        />
                    </button>
                </div>

                <div className="onboarding-content" style={{ 
                    overflowY: 'auto', 
                    overflowX: 'hidden', 
                    position: 'relative',
                    display: 'block',
                    top: '-60px',
                    padding: "70px 24px 0px 24px",
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    height: '100%',
                    flex: 'none'
                }}>
                    <div className="onboarding-step">
                        <div className="step-content" style={{ paddingBottom: '20px' }}>
                            {/* Language Selection */}
                            <div style={{ marginBottom: '26px' }}>
                                <h2 className="step-title">{t('settings.language')}</h2>
                                <p className="step-description">{t('settings.languageDescription')}</p>
                                <div className="provider-dropdown" style={{ position: 'relative', marginTop: '8px' }}>
                                    <button
                                        ref={languageDropdownButtonRef}
                                        className="provider-dropdown-toggle"
                                        onClick={handleLanguageDropdownClick}
                                    >
                                        <span className="provider-dropdown-text">
                                            {getCurrentLanguageName()}
                                        </span>
                                        <svg 
                                            className="provider-dropdown-arrow"
                                            width="12" 
                                            height="12" 
                                            viewBox="0 0 12 12" 
                                            fill="none"
                                        >
                                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </button>
                                    {isLanguageDropdownOpen && (
                                        <div 
                                            ref={languageDropdownRef}
                                            className="provider-dropdown-menu"
                                        >
                                            {languages.map(lang => (
                                                <div
                                                    key={lang.code}
                                                    className={`provider-item ${selectedLanguage === lang.code ? 'selected' : ''}`}
                                                    onClick={() => handleLanguageSelect(lang.code)}
                                                >
                                                    <div className="provider-item-name">
                                                        {lang.name}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* API Settings */}
                            <div style={{ marginBottom: '12px' }}>
                                <h2 className="step-title">{t('settings.apiSettings')}</h2>
                                <p className="step-description">{t('settings.apiSettingsDescription')}</p>
                                
                                <div className="api-key-form">
                                    <div className="form-group">
                                        <label>
                                            {t('settings.provider')}
                                        </label>
                                        <div className="provider-dropdown" style={{ position: 'relative' }}>
                                            <button
                                                ref={providerDropdownButtonRef}
                                                className="provider-dropdown-toggle"
                                                onClick={handleProviderDropdownClick}
                                                disabled={isVerifying}
                                            >
                                                <span className="provider-dropdown-text">
                                                    {availableProviders.find(provider => provider.provider === selectedProvider)?.providerName}
                                                </span>
                                                <svg 
                                                    className="provider-dropdown-arrow"
                                                    width="12" 
                                                    height="12" 
                                                    viewBox="0 0 12 12" 
                                                    fill="none"
                                                >
                                                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </button>
                                            {isProviderDropdownOpen && (
                                                <div 
                                                    ref={providerDropdownRef}
                                                    className="provider-dropdown-menu"
                                                >
                                                    {availableProviders.map(provider => (
                                                        <div
                                                            key={provider.provider}
                                                            className={`provider-item ${selectedProvider === provider.provider ? 'selected' : ''}`}
                                                            onClick={() => handleProviderSelect(provider.provider)}
                                                        >
                                                            <div className="provider-item-name">
                                                                {provider.providerName}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="api-key-input">{t('settings.apiKey')}</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                id="api-key-input"
                                                type="password"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                placeholder={t('settings.apiKeyPlaceholder')}
                                                className="onboarding-input"
                                                disabled={isVerifying}
                                                style={{ flex: 1 }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !isVerifying && apiKey.trim()) {
                                                        handleVerifyApiKey()
                                                    }
                                                }}
                                            />
                                            <button
                                                className="onboarding-button primary"
                                                onClick={handleVerifyApiKey}
                                                disabled={isVerifying || !apiKey.trim()}
                                                style={{
                                                    whiteSpace: 'nowrap',
                                                    minWidth: '80px'
                                                }}
                                            >
                                                {isVerifying ? t('settings.verifying') : t('settings.verify')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Error Message Display */}
                                    {error && (
                                        <div style={{
                                            padding: '12px',
                                            background: '#fef2f2',
                                            border: '1px solid #fecaca',
                                            borderRadius: '8px',
                                            marginTop: '0px',
                                            marginBottom: '8px'
                                        }}>
                                            <p style={{ color: '#dc2626', fontSize: '14px', margin: 0, wordBreak: 'break-word' }}>
                                                {error}
                                            </p>
                                        </div>
                                    )}

                                    {/* Success Message Display */}
                                    {success && (
                                        <div style={{
                                            padding: '12px',
                                            background: '#f0fdf4',
                                            border: '1px solid #bbf7d0',
                                            borderRadius: '8px',
                                            marginTop: '0px',
                                            marginBottom: '8px'
                                        }}>
                                            <p style={{ color: '#16a34a', fontSize: '14px', margin: 0 }}>
                                                {success}
                                            </p>
                                        </div>
                                    )}

                                    {/* Model Configuration */}
                                    <div className="form-group">
                                        <label>{t('settings.model') || 'Model'}</label>
                                        <div style={{ position: 'relative', marginTop: '8px' }}>
                                            <button
                                                ref={modelDropdownButtonRef}
                                                id="model-select"
                                                className="provider-dropdown-toggle"
                                                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                                                disabled={isVerifying}
                                            >
                                                <span className="provider-dropdown-text">
                                                    {model ? (availableModels.find(m => m.id === model)?.name || model) : (t('settings.modelPlaceholder') || 'Select model')}
                                                </span>
                                                <svg
                                                    className="provider-dropdown-arrow"
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 12 12"
                                                    fill="none"
                                                >
                                                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </button>
                                            {modelDropdownOpen && (
                                                <div
                                                    ref={modelDropdownRef}
                                                    className="provider-dropdown-menu"
                                                >
                                                    {availableModels.map(m => (
                                                        <div
                                                            key={m.id}
                                                            className={`provider-item ${model === m.id ? 'selected' : ''}`}
                                                            onClick={() => { setModel(m.id); setModelDropdownOpen(false) }}
                                                        >
                                                            <div className="provider-item-name">
                                                                {m.name || m.id}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reasoning Effort Configuration */}
                                    <div className="form-group">
                                        <label>{t('settings.reasoningEffort') || 'Reasoning Effort'}</label>
                                        <div style={{ position: 'relative', marginTop: '8px' }}>
                                            <button
                                                id="reasoning-select"
                                                className="provider-dropdown-toggle"
                                                onClick={() => setReasoningDropdownOpen(!reasoningDropdownOpen)}
                                                disabled={isVerifying}
                                            >
                                                <span className="provider-dropdown-text">
                                                    {reasoningLevels.find(r => r.value === reasoningEffort)?.label || 'None'}
                                                </span>
                                                <svg
                                                    className="provider-dropdown-arrow"
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 12 12"
                                                    fill="none"
                                                >
                                                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </button>
                                            {reasoningDropdownOpen && (
                                                <div
                                                    ref={reasoningDropdownRef}
                                                    className="provider-dropdown-menu"
                                                >
                                                    {reasoningLevels.map(level => (
                                                        <div
                                                            key={level.value}
                                                            className={`provider-item ${reasoningEffort === level.value ? 'selected' : ''}`}
                                                            onClick={async () => {
                                                                setReasoningEffort(level.value)
                                                                setReasoningDropdownOpen(false)
                                                                // Auto-save reasoning effort for current provider
                                                                if (window.electronAPI && selectedProvider) {
                                                                    try {
                                                                        await window.electronAPI.saveProviderReasoningEffort(selectedProvider, level.value)
                                                                    } catch (error) {
                                                                        console.error('Error saving reasoning effort:', error)
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <div className="provider-item-name">
                                                                {level.label}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Word Selection Toggle */}
                            <div style={{ marginBottom: '0px' }}>
                                <h2 className="step-title">{t('settings.wordSelection')}</h2>
                                <p className="step-description">{t('settings.wordSelectionDescription')}</p>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px',
                                    padding: '0px',
                                    background: 'rgba(255, 255, 255, 0.6)',
                                    borderRadius: '12px'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => handleWordSelectionChange(!wordSelectionEnabled)}
                                        style={{
                                            position: 'relative',
                                            width: '64px',
                                            height: '32px',
                                            borderRadius: '16px',
                                            border: `2px solid ${wordSelectionEnabled ? '#5bd18e' : '#d1d5db'}`,
                                            background: '#ffffff',
                                            cursor: 'pointer',
                                            padding: 0,
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'all 0.2s ease',
                                            outline: 'none',
                                            overflow: 'hidden',
                                            flexShrink: 0
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.opacity = '0.8'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.opacity = '1'
                                        }}
                                    >
                                        <span style={{
                                            position: 'absolute',
                                            left: wordSelectionEnabled ? '8px' : 'auto',
                                            right: wordSelectionEnabled ? 'auto' : '8px',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            color: wordSelectionEnabled ? '#5bd18e' : '#9ca3af',
                                            transition: 'color 0.2s ease, left 0.2s ease, right 0.2s ease',
                                            pointerEvents: 'none',
                                            whiteSpace: 'nowrap',
                                            zIndex: 1
                                        }}>
                                            {wordSelectionEnabled ? 'On' : 'Off'}
                                        </span>
                                        <div style={{
                                            position: 'absolute',
                                            top: '3px',
                                            left: wordSelectionEnabled ? '34px' : '3px',
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: wordSelectionEnabled ? '#5bd18e' : '#9ca3af',
                                            transition: 'left 0.2s ease, background-color 0.2s ease',
                                            pointerEvents: 'none',
                                            zIndex: 2
                                        }}>
                                        </div>
                                    </button>
                                    <span style={{
                                        flex: 1,
                                        fontSize: '14px',
                                        color: '#121e20'
                                    }}>
                                        {wordSelectionEnabled ? t('settings.wordSelectionEnabled') : t('settings.wordSelectionDisabled')}
                                    </span>
                                </div>

                                {/* When to Show Menu - only visible when word selection is enabled */}
                                {wordSelectionEnabled && (
                                    <div style={{ marginTop: '16px' }}>
                                        <div style={{
                                            fontSize: '14px',
                                            color: '#121e20',
                                            marginBottom: '8px'
                                        }}>
                                            {t('settings.whenToShowMenu')}
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            padding: '16px',
                                            backgroundColor: '#f8f9fa',
                                            borderRadius: '8px'
                                        }}>
                                            {/* Option 1: Show on text selection */}
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                cursor: 'pointer',
                                                padding: '8px',
                                                borderRadius: '6px',
                                                transition: 'background-color 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#e5e7eb'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent'
                                            }}
                                            onClick={() => {
                                                if (requireCtrlForMenu) {
                                                    handleRequireCtrlForMenuChange(!requireCtrlForMenu)
                                                }
                                            }}>
                                                {/* Custom radio button */}
                                                <div style={{
                                                    position: 'relative',
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '50%',
                                                    border: `2px solid ${!requireCtrlForMenu ? '#5bd18e' : '#d1d5db'}`,
                                                    backgroundColor: '#ffffff',
                                                    transition: 'all 0.2s ease',
                                                    flexShrink: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {!requireCtrlForMenu && (
                                                        <div style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#5bd18e',
                                                            transition: 'all 0.2s ease'
                                                        }} />
                                                    )}
                                                </div>
                                                <span style={{
                                                    fontSize: '14px',
                                                    color: '#121e20'
                                                }}>
                                                    {t('settings.showOnTextSelection')}
                                                </span>
                                            </label>

                                            {/* Option 2: Show on Ctrl + text selection */}
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                cursor: 'pointer',
                                                padding: '8px',
                                                borderRadius: '6px',
                                                transition: 'background-color 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#e5e7eb'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent'
                                            }}
                                            onClick={() => {
                                                if (!requireCtrlForMenu) {
                                                    handleRequireCtrlForMenuChange(!requireCtrlForMenu)
                                                }
                                            }}>
                                                {/* Custom radio button */}
                                                <div style={{
                                                    position: 'relative',
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '50%',
                                                    border: `2px solid ${requireCtrlForMenu ? '#5bd18e' : '#d1d5db'}`,
                                                    backgroundColor: '#ffffff',
                                                    transition: 'all 0.2s ease',
                                                    flexShrink: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {requireCtrlForMenu && (
                                                        <div style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#5bd18e',
                                                            transition: 'all 0.2s ease'
                                                        }} />
                                                    )}
                                                </div>
                                                <span style={{
                                                    fontSize: '14px',
                                                    color: '#121e20'
                                                }}>
                                                    {t('settings.showOnCtrlPlusTextSelection')}
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* Auto Copy Generated Text - only visible when word selection is enabled */}
                                {wordSelectionEnabled && (
                                    <div style={{ marginBottom: '0px', marginTop: '16px' }}>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            color: '#374151',
                                            padding: '0px',
                                            borderRadius: '6px',
                                            transition: 'background-color 0.2s ease'
                                        }}
                                        onClick={() => handleAutoCopyGeneratedChange(!autoCopyGenerated)}>
                                            {/* Custom checkbox */}
                                            <div style={{
                                                position: 'relative',
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '4px',
                                                border: `2px solid ${autoCopyGenerated ? '#5bd18e' : '#d1d5db'}`,
                                                backgroundColor: autoCopyGenerated ? '#5bd18e' : '#ffffff',
                                                transition: 'all 0.2s ease',
                                                flexShrink: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {autoCopyGenerated && (
                                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                )}
                                            </div>
                                            {t('settings.autoCopyGenerated')}
                                        </label>
                                    </div>
                                )}

                                {/* Custom Menu Actions */}
                                <TagListSelector
                                    title={t('settings.customMenuActions')}
                                    selectedItems={menuActions}
                                    availableItems={availableMenuActions}
                                    onAdd={handleAddMenuAction}
                                    onRemove={handleRemoveMenuAction}
                                    emptyMessage={t('settings.noMenuActions')}
                                    availableItemsTitle={t('settings.availableMenuActionsTitle')}
                                    noAvailableItemsMessage={t('settings.noAvailableMenuActions')}
                                    errorMessage={menuActionsError || undefined}
                                />
                                
                                {/* Disabled Apps List */}
                                <TagListSelector
                                    title={t('settings.disabledAppsList')}
                                    selectedItems={disabledApps.map(app => ({ name: app.name, displayName: "" }))}
                                    availableItems={availableApps.map(app => ({ name: app.name, displayName: "" }))}
                                    onAdd={handleAddDisabledApp}
                                    onRemove={handleRemoveDisabledApp}
                                    emptyMessage={t('settings.noDisabledApps')}
                                    availableItemsTitle={t('settings.availableAppsTitle')}
                                    noAvailableItemsMessage={t('settings.noAvailableApps')}
                                    onLoadAvailableItems={async () => {
                                        const result = await window.electronAPI.getAvailableApps()
                                        if (result.success) {
                                            setAvailableApps(result.apps.map(app => ({ name: app.name, displayName: "" })) || [])
                                            return result.apps || []
                                        }
                                        return []
                                    }}
                                />

                                {/* Custom Actions */}
                                <div style={{ marginBottom: '26px', marginTop: '26px' }}>
                                    <div className="step-title">{t('settings.customActions')}</div>
                                    <p className="step-description">{t('settings.customActionsDescription')}</p>

                                    {customActions.length === 0 && !isAddingCustomAction && !editingCustomActionId && (
                                        <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '8px' }}>{t('settings.noCustomActions')}</p>
                                    )}

                                    {customActions.map(action => {
                                        const ActionIcon = getIconComponent(action.icon || 'Type')
                                        if (editingCustomActionId === action.id) {
                                            // Render edit form at the position of the action being edited
                                            return (
                                                <div key={action.id} style={{
                                                    marginTop: '8px', padding: '12px',
                                                    background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb'
                                                }}>
                                                    <div style={{ marginBottom: '10px', marginTop: '4px' }}>
                                                        <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>
                                                            {t('settings.customActionIcon')}
                                                        </label>
                                                        <IconPicker value={customActionIcon} onChange={setCustomActionIcon} />
                                                    </div>
                                                    <div style={{ marginBottom: '10px' }}>
                                                        <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>
                                                            {t('settings.customActionName')}
                                                        </label>
                                                        <textarea
                                                            // type="text"
                                                            value={customActionName}
                                                            onChange={e => setCustomActionName(e.target.value)}
                                                            rows={1}
                                                            placeholder={t('settings.customActionNamePlaceholder')}
                                                            style={{
                                                                width: '100%', padding: '6px 10px', fontSize: '13px',
                                                                border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none',
                                                                resize: 'none', fontFamily: 'inherit',
                                                                boxSizing: 'border-box'
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ marginBottom: '10px' }}>
                                                        <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>
                                                            {t('settings.customActionPrompt')}
                                                        </label>
                                                        <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 6px 0' }}>
                                                            {t('settings.customActionPromptHint')}
                                                        </p>
                                                        <textarea
                                                            value={customActionPrompt}
                                                            onChange={e => setCustomActionPrompt(e.target.value)}
                                                            placeholder={t('settings.customActionPromptPlaceholder')}
                                                            rows={3}
                                                            style={{
                                                                width: '100%', padding: '6px 10px', fontSize: '13px',
                                                                border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none',
                                                                resize: 'vertical', fontFamily: 'inherit',
                                                                boxSizing: 'border-box'
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}
                                                        onClick={() => setCustomActionCanEdit(!customActionCanEdit)}>
                                                            {/* Custom checkbox */}
                                                            <div style={{
                                                                position: 'relative',
                                                                width: '16px',
                                                                height: '16px',
                                                                borderRadius: '4px',
                                                                border: `2px solid ${customActionCanEdit ? '#5bd18e' : '#d1d5db'}`,
                                                                backgroundColor: customActionCanEdit ? '#5bd18e' : '#ffffff',
                                                                transition: 'all 0.2s ease',
                                                                flexShrink: 0,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}>
                                                                {customActionCanEdit && (
                                                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                                    </svg>
                                                                )}
                                                            </div>
                                                            {t('settings.customActionCanEdit')}
                                                        </label>
                                                        <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0 0px' }}>
                                                            {t('settings.customActionCanEditHint')}
                                                        </p>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                        <button onClick={cancelCustomActionForm} style={{
                                                            padding: '6px 12px', fontSize: '13px', border: '1px solid #d1d5db',
                                                            borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#374151'
                                                        }}>{t('settings.cancel')}</button>
                                                        <button
                                                            onClick={handleEditCustomAction}
                                                            disabled={!customActionName.trim() || !customActionPrompt.trim()}
                                                            style={{
                                                                padding: '6px 12px', fontSize: '13px', border: 'none',
                                                                borderRadius: '6px', background: customActionName.trim() && customActionPrompt.trim() ? '#10b981' : '#d1d5db',
                                                                cursor: customActionName.trim() && customActionPrompt.trim() ? 'pointer' : 'default',
                                                                color: '#fff'
                                                            }}
                                                        >{t('settings.save')}</button>
                                                    </div>
                                                </div>
                                            )
                                        }
                                        return (
                                            <div key={action.id} className="custom-action-item" style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '8px 12px', marginTop: '8px',
                                                background: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                                    <ActionIcon size={16} style={{ flexShrink: 0, color: '#6b7280' }} />
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>{action.name}</div>
                                                        <div style={{ fontSize: '12px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{action.prompt}</div>
                                                    </div>
                                                </div>
                                                <div className="custom-action-buttons" style={{ display: 'flex', gap: '4px', marginLeft: '8px', flexShrink: 0 }}>
                                                    <button onClick={() => startEditCustomAction(action)} style={{
                                                        padding: '4px 8px', fontSize: '12px', border: '1px solid #d1d5db',
                                                        borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#374151'
                                                    }}>{t('settings.edit')}</button>
                                                    <button onClick={() => handleDeleteCustomAction(action.id)} style={{
                                                        padding: '4px 8px', fontSize: '12px', border: '1px solid #fca5a5',
                                                        borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#ef4444'
                                                    }}>{t('settings.delete')}</button>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {isAddingCustomAction && (
                                        <div style={{
                                            marginTop: '8px', padding: '12px',
                                            background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb'
                                        }}>
                                            <div style={{ marginBottom: '10px', marginTop: '4px' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>
                                                    {t('settings.customActionIcon')}
                                                </label>
                                                <IconPicker value={customActionIcon} onChange={setCustomActionIcon} />
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>
                                                    {t('settings.customActionName')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={customActionName}
                                                    onChange={e => setCustomActionName(e.target.value)}
                                                    placeholder={t('settings.customActionNamePlaceholder')}
                                                    style={{
                                                        width: '100%', padding: '6px 10px', fontSize: '13px',
                                                        border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ marginBottom: '10px' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>
                                                    {t('settings.customActionPrompt')}
                                                </label>
                                                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 6px 0' }}>
                                                    {t('settings.customActionPromptHint')}
                                                </p>
                                                <textarea
                                                    value={customActionPrompt}
                                                    onChange={e => setCustomActionPrompt(e.target.value)}
                                                    placeholder={t('settings.customActionPromptPlaceholder')}
                                                    rows={3}
                                                    style={{
                                                        width: '100%', padding: '6px 10px', fontSize: '13px',
                                                        border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none',
                                                        resize: 'vertical', fontFamily: 'inherit',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                            <div style={{ marginBottom: '8px' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}
                                                onClick={() => setCustomActionCanEdit(!customActionCanEdit)}>
                                                    {/* Custom checkbox */}
                                                    <div style={{
                                                        position: 'relative',
                                                        width: '16px',
                                                        height: '16px',
                                                        borderRadius: '4px',
                                                        border: `2px solid ${customActionCanEdit ? '#5bd18e' : '#d1d5db'}`,
                                                        backgroundColor: customActionCanEdit ? '#5bd18e' : '#ffffff',
                                                        transition: 'all 0.2s ease',
                                                        flexShrink: 0,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        {customActionCanEdit && (
                                                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                            </svg>
                                                        )}
                                                    </div>
                                                    {t('settings.customActionCanEdit')}
                                                </label>
                                                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0 0px' }}>
                                                    {t('settings.customActionCanEditHint')}
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button onClick={cancelCustomActionForm} style={{
                                                    padding: '6px 12px', fontSize: '13px', border: '1px solid #d1d5db',
                                                    borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#374151'
                                                }}>{t('settings.cancel')}</button>
                                                <button
                                                    onClick={handleAddCustomAction}
                                                    disabled={!customActionName.trim() || !customActionPrompt.trim()}
                                                    style={{
                                                        padding: '6px 12px', fontSize: '13px', border: 'none',
                                                        borderRadius: '6px', background: customActionName.trim() && customActionPrompt.trim() ? '#10b981' : '#d1d5db',
                                                        cursor: customActionName.trim() && customActionPrompt.trim() ? 'pointer' : 'default',
                                                        color: '#fff'
                                                    }}
                                                >{t('settings.save')}</button>
                                            </div>
                                        </div>
                                    )}

                                    {!isAddingCustomAction && !editingCustomActionId && (
                                        <button onClick={() => { setIsAddingCustomAction(true); setCustomActionName(''); setCustomActionPrompt(''); setCustomActionCanEdit(false) }} style={{
                                            marginTop: '8px', padding: '6px 12px', fontSize: '13px',
                                            border: '1px dashed #d1d5db', borderRadius: '6px',
                                            background: '#fff', cursor: 'pointer', color: '#6b7280', width: '100%'
                                        }}>+ {t('settings.addCustomAction')}</button>
                                    )}
                                </div>
                            </div>
                            <br></br>
                            <br></br>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        ) : (
            ''
        )
    )
}

export default SettingsPanel

