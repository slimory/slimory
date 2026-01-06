import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './FullChatPanel.css'

interface SettingsMessageProps {
    showSettings: boolean
    hasSettings: boolean
    onSettingsVerified: () => void
    onShowToast: (message: string, type: 'success' | 'error') => void
}

interface Provider {
    provider: string
    baseUrl: string
    model: string
}

const SettingsMessage: React.FC<SettingsMessageProps> = ({
    showSettings,
    hasSettings,
    onSettingsVerified,
    onShowToast
}) => {
    const { t } = useTranslation()
    const [selectedProvider, setSelectedProvider] = useState<string>('deepseek')
    const [apiKey, setApiKey] = useState<string>('')
    const [isVerifying, setIsVerifying] = useState<boolean>(false)
    const [isVerified, setIsVerified] = useState<boolean>(false)
    const [availableProviders, setAvailableProviders] = useState<Provider[]>([])
    
    // Provider dropdown state
    const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false)
    const [isProviderDropdownShown, setIsProviderDropdownShown] = useState(false)
    const providerDropdownRef = useRef<HTMLDivElement>(null)
    const providerDropdownButtonRef = useRef<HTMLButtonElement>(null)

    // Load available providers on mount
    useEffect(() => {
        const loadProviders = async () => {
            if (!window.electronAPI) return
            
            try {
                const providersResult = await window.electronAPI.getAvailableProviders()
                if (providersResult.success) {
                    setAvailableProviders(providersResult.providers)
                    if (providersResult.providers.length > 0) {
                        setSelectedProvider(providersResult.providers[0].provider)
                    }
                }
            } catch (error) {
                console.error('Error loading providers:', error)
            }
        }
        
        loadProviders()
    }, [])

    const handleVerify = async () => {
        if (!apiKey.trim()) {
            onShowToast(t('settings.errorNoApiKey'), 'error')
            return
        }
        
        setIsVerifying(true)
        
        try {
            const result = await window.electronAPI.verifyApiKey(selectedProvider, apiKey)
            if (result.success) {
                // Save settings
                const saveResult = await window.electronAPI.saveSettings(selectedProvider, apiKey)
                if (saveResult.success) {
                    setIsVerified(true)
                    // Keep settings visible for a moment to show success, then hide
                    setTimeout(() => {
                        setIsVerified(false)
                        setApiKey('')
                        onSettingsVerified()
                    }, 2000)
                    onShowToast(t('settings.successVerified'), 'success')
                } else {
                    onShowToast(saveResult.error || t('settings.errorSaveFailed'), 'error')
                }
            } else {
                onShowToast(result.error || t('settings.errorVerificationFailed'), 'error')
            }
        } catch (error) {
            console.error('Error verifying API key:', error)
            onShowToast(t('settings.errorVerify'), 'error')
        } finally {
            setIsVerifying(false)
        }
    }

    const openProviderDropdown = () => {
        setIsProviderDropdownOpen(true)
        requestAnimationFrame(() => {
            setIsProviderDropdownShown(true)
        })
    }
    
    const closeProviderDropdown = () => {
        setIsProviderDropdownShown(false)
        setTimeout(() => {
            setIsProviderDropdownOpen(false)
        }, 150)
    }

    const handleProviderDropdownClick = () => {
        if (!isVerifying) {
            if (!isProviderDropdownOpen) openProviderDropdown()
            else closeProviderDropdown()
        }
    }

    const handleProviderSelect = (provider: string) => {
        setSelectedProvider(provider)
        closeProviderDropdown()
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

    if (!showSettings && hasSettings) {
        return null
    }
    
    if (isVerified) {
        return (
            <div className="message assistant settings-message">
                <div className="message-content settings-success">
                    {t('settings.verifiedSuccess')}
                </div>
            </div>
        )
    }
    
    return (
        <div className="settings-message">
            <div className="message-content settings-form">
                <div className="settings-title">{t('settings.title')}</div>
                <div className="settings-form-group">
                    <label htmlFor="provider-select">{t('settings.provider')}</label>
                    <div className="provider-dropdown" style={{ position: 'relative' }}>
                        <button
                            ref={providerDropdownButtonRef}
                            className="provider-dropdown-toggle"
                            onClick={handleProviderDropdownClick}
                            disabled={isVerifying}
                        >
                            <span className="provider-dropdown-text">
                                {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}
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
                                className={`provider-dropdown-menu ${isProviderDropdownShown ? 'show' : ''}`}
                            >
                                {availableProviders.map(provider => (
                                    <div
                                        key={provider.provider}
                                        className={`provider-item ${selectedProvider === provider.provider ? 'selected' : ''}`}
                                        onClick={() => handleProviderSelect(provider.provider)}
                                    >
                                        <div className="provider-item-name">
                                            {provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="settings-form-group">
                    <label htmlFor="api-key-input">{t('settings.apiKey')}</label>
                    <input
                        id="api-key-input"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={t('settings.apiKeyPlaceholder')}
                        className="settings-input"
                        disabled={isVerifying}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isVerifying) {
                                handleVerify()
                            }
                        }}
                    />
                </div>
                <button
                    className="settings-verify-btn"
                    onClick={handleVerify}
                    disabled={isVerifying || !apiKey.trim()}
                >
                    {isVerifying ? t('settings.verifying') : t('settings.verify')}
                </button>
            </div>
        </div>
    )
}

export default SettingsMessage

