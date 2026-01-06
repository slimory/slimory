import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import './OnboardingPanel.css'
import LanguageStep from './Onboarding/LanguageStep'
import ApiKeyStep from './Onboarding/ApiKeyStep'
import MenuDemoStep from './Onboarding/MenuDemoStep'
import ShortcutStep from './Onboarding/ShortcutStep'

const OnboardingPanel = () => {
    const { t } = useTranslation()
    const [currentStep, setCurrentStep] = useState(1)
    const [selectedLanguage, setSelectedLanguage] = useState<string>('zh')
    const [isReady, setIsReady] = useState(false)

    const handleNext = () => {
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1)
        } else {
            // Complete onboarding
            if (window.electronAPI) {
                window.electronAPI.closeOnboardingWindow()
            }
        }
    }

    const handlePrevious = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
        }
    }

    const handleClose = () => {
        if (window.electronAPI) {
            window.electronAPI.quitApp()
        }
    }

    const handleLanguageSelect = (language: string) => {
        setSelectedLanguage(language)
        // Update i18n language
        i18n.changeLanguage(language)
        // Send to main process
        if (window.electronAPI) {
            window.electronAPI.saveLanguage(language)
        }
    }

    const handleApiKeyVerified = () => {
        // API key verified, enable next button
        handleNext()
    }

    useEffect(() => {
        setIsReady(true)
    }, [])

    return (
        <div className={`onboarding-container ${isReady ? 'ready' : ''}`}>
            <div className="onboarding-panel">
                <div className="onboarding-header">
                    <h1 className="onboarding-title">{t('onboarding.welcome')}</h1>
                    <div className="onboarding-progress">
                        {[1, 2, 3, 4].map((step) => (
                            <div
                                key={step}
                                className={`progress-dot ${currentStep >= step ? 'active' : ''}`}
                            />
                        ))}
                    </div>
                </div>

                <div className="onboarding-content">
                    {currentStep === 1 && (
                        <LanguageStep
                            selectedLanguage={selectedLanguage}
                            onLanguageSelect={handleLanguageSelect}
                            onNext={handleNext}
                            onPrevious={handlePrevious}
                            onClose={handleClose}
                            currentStep={currentStep}
                        />
                    )}
                    {currentStep === 2 && (
                        <ApiKeyStep
                            onVerified={handleApiKeyVerified}
                            onPrevious={handlePrevious}
                            onClose={handleClose}
                            currentStep={currentStep}
                        />
                    )}
                    {currentStep === 3 && (
                        <MenuDemoStep 
                            onNext={handleNext}
                            onPrevious={handlePrevious}
                            onClose={handleClose}
                            currentStep={currentStep}
                        />
                    )}
                    {currentStep === 4 && (
                        <ShortcutStep 
                            onComplete={handleNext}
                            onPrevious={handlePrevious}
                            onClose={handleClose}
                            currentStep={currentStep}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

export default OnboardingPanel

