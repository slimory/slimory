import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '../OnboardingPanel.css'

interface Provider {
    provider: string
    providerName: string
    baseUrl: string
    model: string
}

interface ApiKeyStepProps {
    onVerified: () => void
    onPrevious: () => void
    onClose: () => void
    currentStep: number
}

const ApiKeyStep: React.FC<ApiKeyStepProps> = ({
    onVerified,
    onPrevious,
    onClose,
    currentStep
}) => {
    const { t } = useTranslation()
    const [selectedProvider, setSelectedProvider] = useState<string>('deepseek')
    const [apiKey, setApiKey] = useState<string>('')
    const [model, setModel] = useState<string>('')
    const [defaultModel, setDefaultModel] = useState<string>('')
    const [isVerifying, setIsVerifying] = useState<boolean>(false)
    const [isVerified, setIsVerified] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [availableProviders, setAvailableProviders] = useState<Provider[]>([])
    const [showErrorModal, setShowErrorModal] = useState<boolean>(false)

    // Provider dropdown state
    const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false)
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
                        // Prefer deepseek as the initial provider, fall back to the first available
                        const initial = providersResult.providers.find(p => p.provider === 'deepseek') || providersResult.providers[0]
                        const firstProvider = initial.provider
                        setSelectedProvider(firstProvider)
                        // Set default model for initial provider
                        const defaultModelValue = initial.model || ''
                        setDefaultModel(defaultModelValue)
                    }
                }
            } catch (error) {
                console.error('Error loading providers:', error)
            }
        }

        loadProviders()
    }, [])

    // Update default model when provider changes
    useEffect(() => {
        const provider = availableProviders.find(p => p.provider === selectedProvider)
        if (provider) {
            setDefaultModel(provider.model || '')
            // Clear custom model when switching providers
            setModel('')
        }
    }, [selectedProvider, availableProviders])

    const handleVerify = async () => {
        if (!apiKey.trim()) {
            setError(t('settings.errorNoApiKey'))
            setShowErrorModal(true)
            return
        }

        setIsVerifying(true)
        setError(null)

        try {
            // Pass model to verify (use custom model if provided, otherwise undefined to use default)
            const verifyModel = model.trim() ? model : undefined
            const result = await window.electronAPI.verifyApiKey(selectedProvider, apiKey, verifyModel)
            if (result.success) {
                // Save the API key and model for this provider
                const saveModel = model.trim() ? model : undefined
                const saveResult = await window.electronAPI.saveSettings(selectedProvider, apiKey, saveModel)
                await window.electronAPI.saveWordSelectionEnabled(true)
                if (saveResult.success) {
                    setIsVerified(true)
                    // Call onVerified after a short delay to show success state
                    setTimeout(() => {
                        onVerified()
                    }, 1000)
                } else {
                    const errorMsg = saveResult.error || t('settings.errorSaveFailed')
                    setError(errorMsg)
                    setShowErrorModal(true)
                }
            } else {
                // Show the full error message from the API
                const errorMsg = result.error || t('settings.errorVerificationFailed')
                setError(errorMsg)
                setShowErrorModal(true)
            }
        } catch (err) {
            console.error('Error verifying API key:', err)
            setError(t('settings.errorVerify'))
            setShowErrorModal(true)
        } finally {
            setIsVerifying(false)
        }
    }

    const handleCloseErrorModal = () => {
        setShowErrorModal(false)
        setError(null)
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

    return (
        <div className="onboarding-step">
            <div className="step-content">
                <h2 className="step-title">{t('onboarding.step2.title')}</h2>
                <p className="step-description" style={{marginBottom: '4px'}}>{t('onboarding.step2.description')}</p>
                
                <div className="api-key-form">
                    <div className="form-group">
                        <label htmlFor="provider-select">{t('settings.provider')}</label>
                        <div className="provider-dropdown" style={{ position: 'relative' }}>
                            <button
                                ref={providerDropdownButtonRef}
                                className="provider-dropdown-toggle"
                                onClick={handleProviderDropdownClick}
                                disabled={isVerifying || isVerified}
                            >
                                <span className="provider-dropdown-text">
                                    {availableProviders.find(p => p.provider === selectedProvider)?.providerName || selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}
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
                                                {provider.providerName || provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="api-key-input">{t('settings.apiKey')}</label>
                        <input
                            id="api-key-input"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={t('settings.apiKeyPlaceholder')}
                            className="onboarding-input"
                            disabled={isVerifying || isVerified}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isVerifying && !isVerified) {
                                    handleVerify()
                                }
                            }}
                        />
                    </div>
                    {/* Model Configuration */}
                    <div className="form-group">
                        <label htmlFor="model-input">{t('settings.model') || 'Model'}</label>
                        <input
                            id="model-input"
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder={defaultModel ? t('settings.defaultModelHint', { defaultModel }) || `Default: ${defaultModel}` : ''}
                            className="onboarding-input"
                            disabled={isVerifying || isVerified}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isVerifying && !isVerified) {
                                    handleVerify()
                                }
                            }}
                        />
                    </div>
                    {/* {isVerified && (
                        <div className="success-message">{t('settings.verifiedSuccess')}</div>
                    )} */}
                </div>
            </div>

            {/* Error Modal */}
            {showErrorModal && (
                <div className="error-modal-overlay" onClick={handleCloseErrorModal}>
                    <div className="error-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="error-modal-content">
                            <div className="error-modal-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="2"/>
                                    <path d="M12 7v6M12 17h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            </div>
                            <div className="error-modal-message">{error}</div>
                            <button className="error-modal-button" onClick={handleCloseErrorModal}>
                                {t('common.gotIt') || '我知道了'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="step-actions">
                <div className="step-actions-left">
                    <button
                        className="onboarding-button close"
                        onClick={onClose}
                    >
                        {t('onboarding.close')}
                    </button>
                </div>
                <div className="step-actions-right">
                    {currentStep > 1 && (
                        <button
                            className="onboarding-button secondary"
                            onClick={onPrevious}
                        >
                            {t('onboarding.previous')}
                        </button>
                    )}
                    <button
                        className={`onboarding-button primary ${isVerified ? 'verified' : ''}`}
                        onClick={handleVerify}
                        disabled={isVerifying || isVerified || !apiKey.trim()}
                    >
                        {isVerified ? t('onboarding.verified') : (isVerifying ? t('settings.verifying') : t('settings.verify'))}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ApiKeyStep

