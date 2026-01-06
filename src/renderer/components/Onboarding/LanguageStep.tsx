import React, { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '../OnboardingPanel.css'
import downArrowIcon from '../../assets/icons/down-arrow.svg'

interface LanguageStepProps {
    selectedLanguage: string
    onLanguageSelect: (language: string) => void
    onNext: () => void
    onPrevious: () => void
    onClose: () => void
    currentStep: number
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

const LanguageStep: React.FC<LanguageStepProps> = ({
    selectedLanguage,
    onLanguageSelect,
    onNext,
    onPrevious,
    onClose,
    currentStep
}) => {
    const { t } = useTranslation()
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const [showScrollButton, setShowScrollButton] = useState(true)

    const scrollToBottom = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            })
        }
    }

    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const checkScrollPosition = () => {
            const isAtBottom = 
                container.scrollHeight - container.scrollTop <= container.clientHeight + 10
            setShowScrollButton(!isAtBottom)
        }

        checkScrollPosition()
        container.addEventListener('scroll', checkScrollPosition)
        
        // 初始检查
        setTimeout(checkScrollPosition, 100)

        return () => {
            container.removeEventListener('scroll', checkScrollPosition)
        }
    }, [])

    return (
        <div className="onboarding-step">
            <div className="step-content">
                <h2 className="step-title">{t('onboarding.step1.title')}</h2>
                <p className="step-description">{t('onboarding.step1.description')}</p>
                
                <div className="language-options-wrapper">
                    <div className="language-options" ref={scrollContainerRef}>
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                className={`language-option ${selectedLanguage === lang.code ? 'selected' : ''}`}
                                onClick={() => onLanguageSelect(lang.code)}
                            >
                                <span className="language-name">{lang.name}</span>
                            </button>
                        ))}
                    </div>
                    {showScrollButton && (
                        <button 
                            className="scroll-to-bottom-btn"
                            onClick={scrollToBottom}
                            aria-label="Scroll to bottom"
                        >
                            <img 
                                src={downArrowIcon} 
                                alt="Scroll to bottom" 
                                className="scroll-arrow-icon"
                            />
                        </button>
                    )}
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
                        onClick={onNext}
                    >
                        {t('onboarding.next')}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default LanguageStep

