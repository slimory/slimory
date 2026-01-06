import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '../OnboardingPanel.css'
import MenuPopup from '../MenuPopup'

interface MenuDemoStepProps {
    onNext: () => void
    onPrevious: () => void
    onClose: () => void
    currentStep: number
}

const MenuDemoStep: React.FC<MenuDemoStepProps> = ({ 
    onNext, 
    onPrevious, 
    onClose, 
    currentStep 
}) => {
    const { t } = useTranslation()
    const { i18n } = useTranslation()
    const [showDemo, setShowDemo] = useState(false)
    const [isSelecting, setIsSelecting] = useState(false)
    const [selectionProgress, setSelectionProgress] = useState(0)

    useEffect(() => {
        let timer1: NodeJS.Timeout
        let timer2: NodeJS.Timeout
        let timer3: NodeJS.Timeout
        let animationFrame: number

        const startAnimation = () => {
            // Reset states
            setIsSelecting(false)
            setSelectionProgress(0)
            setShowDemo(false)

            // Start text selection animation after 300ms
            timer1 = setTimeout(() => {
                setIsSelecting(true)
                const startTime = Date.now()
                const duration = 1000 // 800ms to select text
                
                const animate = () => {
                    const elapsed = Date.now() - startTime
                    const progress = Math.min(elapsed / duration, 1)
                    setSelectionProgress(progress)
                    
                    if (progress < 1) {
                        animationFrame = requestAnimationFrame(animate)
                    } else {
                        // Text selection complete, show menu
                        setTimeout(() => {
                            setShowDemo(true)
                        }, 600)
                    }
                }
                
                animate()
            }, 300)

            // Hide menu after 3 seconds, then restart
            timer2 = setTimeout(() => {
                setShowDemo(false)
                setIsSelecting(false)
                setSelectionProgress(0)
                // Restart animation after a short pause
                timer3 = setTimeout(() => {
                    startAnimation()
                }, 800)
            }, 4500)
        }

        startAnimation()

        return () => {
            if (timer1) clearTimeout(timer1)
            if (timer2) clearTimeout(timer2)
            if (timer3) clearTimeout(timer3)
            if (animationFrame) cancelAnimationFrame(animationFrame)
        }
    }, [])

    return (
        <div className="onboarding-step">
            <div className="step-content">
                <h2 className="step-title">{t('onboarding.step3.title')}</h2>
                <p className="step-description">{t('onboarding.step3.description')}</p>
                
                <div className="menu-demo-container">
                    <div className="demo-text-selection">
                        <div className="demo-text-wrapper">
                            <div className="demo-text">
                                <span className="demo-text-base">{t('onboarding.step3.demoText')}</span>
                                {isSelecting && (
                                    <>
                                        <span 
                                            className="demo-selection-overlay"
                                            style={{
                                                width: `${selectionProgress * (i18n.language === 'zh' ? 65.5 : 68)}%`
                                            }}
                                        />
                                        <span 
                                            className="demo-selection-text"
                                            style={{
                                                width: `${selectionProgress * (i18n.language === 'zh' ? 65.5 : 68)}%`
                                            }}
                                        >
                                            {t('onboarding.step3.demoText').substring(0, Math.floor(t('onboarding.step3.demoText').length * selectionProgress))}
                                        </span>
                                    </>
                                )}
                            </div>
                            {isSelecting && (
                                <div 
                                    className="demo-cursor"
                                    style={{
                                        left: `${3 + selectionProgress * 70}%`
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        <circle cx="3" cy="3" r="1.5" fill="currentColor"/>
                                    </svg>
                                </div>
                            )}
                        </div>
                        <div className="demo-menu-wrapper" style={{ opacity: showDemo ? 1 : 0 }}>
                            <MenuPopup selectedText={t('onboarding.step3.demoText')} onAction={() => {}} />
                        </div>
                    </div>
                    
                    {/* <div className="demo-instructions">
                        <p>{t('onboarding.step3.instruction')}</p>
                    </div> */}
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

export default MenuDemoStep

