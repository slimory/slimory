import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import './OnboardingPanel.css'
import closeIcon from '../assets/icons/close.svg'
import TagListSelector from './TagListSelector'

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

const SettingsPanel = () => {
    const { t } = useTranslation()
    const [selectedLanguage, setSelectedLanguage] = useState<string>('zh')
    const [selectedProvider, setSelectedProvider] = useState<string>('deepseek')
    const [apiKey, setApiKey] = useState<string>('')
    const [wordSelectionEnabled, setWordSelectionEnabled] = useState<boolean>(true)
    const [isVerifying, setIsVerifying] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [availableProviders, setAvailableProviders] = useState<Provider[]>([])
    const [isReady, setIsReady] = useState<boolean>(false)
    const [availableApps, setAvailableApps] = useState<Array<{ name: string; displayName: string }>>([])
    const [disabledApps, setDisabledApps] = useState<Array<{ name: string; displayName: string }>>([])
    const [menuActions, setMenuActions] = useState<Array<{ name: string; displayName: string }>>([])
    const [menuActionsError, setMenuActionsError] = useState<string | null>(null)
    
    // Available menu actions - use useMemo to update when language changes
    const availableMenuActions: Array<{ name: string; displayName: string }> = useMemo(() => [
        { name: 'explain', displayName: t('menu.explain') },
        { name: 'translate', displayName: t('menu.translate') },
        { name: 'ask', displayName: t('menu.ask') },
        { name: 'modify', displayName: t('menu.modify') }
    ], [t, selectedLanguage])
    
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
                    setWordSelectionEnabled(allSettingsResult.settings?.wordSelectionEnabled !== false)
                    const language = allSettingsResult.settings?.language || 'zh'
                    setSelectedLanguage(language)
                    i18n.changeLanguage(language)
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
                
                // Load menu actions - use i18n.t() to ensure correct language after changeLanguage
                const menuActionsResult = await window.electronAPI.getMenuActions()
                if (menuActionsResult.success) {
                    const actions = menuActionsResult.actions || ['explain', 'translate', 'ask']
                    const actionItems = actions.map(action => {
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
            setMenuActions(prev => prev.map(action => ({ ...action, displayName: t('menu.' + action.name) })))
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
        setMenuActions(prev => prev.map(action => ({ ...action, displayName: t('menu.' + action.name) })))
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
            const verifyResult = await window.electronAPI.verifyApiKey(selectedProvider, apiKey)
            if (!verifyResult.success) {
                setError(t('settings.errorVerificationFailed'))
                setIsVerifying(false)
                return
            }
            
            // Save the API key for this provider
            const saveResult = await window.electronAPI.saveSettings(selectedProvider, apiKey)
            if (!saveResult.success) {
                setError(t('settings.errorSaveFailed'))
                setIsVerifying(false)
                return
            }
            
            // After successful verification, set this provider as current provider
            const setProviderResult = await window.electronAPI.setCurrentProvider(selectedProvider)
            if (setProviderResult.success) {
                setSuccess(t('settings.verifiedSuccess'))
            } else {
                setSuccess(t('settings.verifiedSuccess'))
            }
            
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

    // Auto-hide error and success messages after 5 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null)
            }, 3000)
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
                                        <label htmlFor="provider-select" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{t('settings.provider')}</span>
                                            {(error || success) && (
                                                <span style={{
                                                    fontSize: '14px',
                                                    color: error ? '#dc2626' : '#5bd18e',
                                                    fontWeight: 'normal'
                                                }}>
                                                    {error || success}
                                                </span>
                                            )}
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

