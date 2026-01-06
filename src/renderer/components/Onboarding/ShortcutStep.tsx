import React from 'react'
import { useTranslation } from 'react-i18next'
import '../OnboardingPanel.css'
import chatScreenshot from '../../assets/chat-screenshot.png'

interface ShortcutStepProps {
    onComplete: () => void
    onPrevious: () => void
    onClose: () => void
    currentStep: number
}

const ShortcutStep: React.FC<ShortcutStepProps> = ({ 
    onComplete, 
    onPrevious, 
    onClose, 
    currentStep 
}) => {
    const { t } = useTranslation()

    return (
        <div className="onboarding-step">
            <div className="step-content">
                <h2 className="step-title">{t('onboarding.step4.title')}</h2>
                <p className="step-description">{t('onboarding.step4.description')}</p>
                
                <div className="shortcut-demo">
                    <div className="shortcut-key">
                        <kbd>Ctrl</kbd>
                        <span className="shortcut-plus">+</span>
                        <kbd>Space</kbd>
                    </div>
                    {/* <p className="shortcut-hint">{t('onboarding.step4.hint')}</p> */}
                    <div className="shortcut-screenshot">
                        <img 
                            src={chatScreenshot} 
                            alt="Chat Interface" 
                            className="shortcut-screenshot-img"
                        />
                    </div>
                </div>
            </div>
            
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
                        className="onboarding-button primary"
                        onClick={onComplete}
                    >
                        {t('onboarding.complete')}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ShortcutStep

