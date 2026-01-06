import './MenuPopup.css'
import translateIcon from '../assets/icons/translate.svg'
import qaIcon from '../assets/icons/qa.svg'
import explainIcon from '../assets/icons/explain.svg'
import modifyIcon from '../assets/icons/edit.svg'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef } from 'react';

interface MenuPopupProps {
    selectedText: string
    onAction: (action: string) => void
    actions?: string[]
}

const MenuPopup = ({ selectedText, onAction, actions = ['explain', 'translate', 'ask'] }: MenuPopupProps) => {
    console.log('selectedText:', selectedText)
    const { t } = useTranslation()
    const [isHovered, setIsHovered] = useState<string | null>(null);

    const actionConfigMap = new Map([
        ['explain', { icon: explainIcon, altKey: 'alt.explain', labelKey: 'menu.explain' }],
        ['translate', { icon: translateIcon, altKey: 'alt.translate', labelKey: 'menu.translate' }],
        ['ask', { icon: qaIcon, altKey: 'alt.ask', labelKey: 'menu.ask' }],
        ['modify', { icon: modifyIcon, altKey: 'alt.modify', labelKey: 'menu.modify' }],
    ])

    const handleMouseEnter = (buttonType: string) => {
        setIsHovered(buttonType);
    };

    const handleMouseLeave = () => {
        setIsHovered(null);
    };

    const handleClick = (action: string) => {
        // Manually trigger unhover by resetting state
        setIsHovered(null);
        setTimeout(() => {
            onAction(action);
        }, 0);
    };

    const menuPopupRef = useRef<HTMLDivElement>(null);

    // Handle mouse enter on menu-popup - disable ignore mouse
    const handleMenuPopupMouseEnter = () => {
        if (window.electronAPI && window.electronAPI.setWindowIgnoreMouse) {
            window.electronAPI.setWindowIgnoreMouse('menu', false, false)
        }
    }

    // Setup ignore mouse events
    useEffect(() => {
        const handleDocumentMouseMove = (event: MouseEvent) => {
            const menuPopup = menuPopupRef.current
            if (!menuPopup) return

            // Check if mouse is inside menu-popup using coordinates
            const rect = menuPopup.getBoundingClientRect()
            const isInside = (
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom
            )

            // If mouse is outside menu-popup, enable ignore mouse
            if (!isInside) {
                if (window.electronAPI && window.electronAPI.setWindowIgnoreMouse) {
                    window.electronAPI.setWindowIgnoreMouse('menu', true, true)
                }
            }
        }

        // Initially set ignore mouse for areas outside menu-popup
        if (window.electronAPI && window.electronAPI.setWindowIgnoreMouse) {
            window.electronAPI.setWindowIgnoreMouse('menu', true, true)
        }

        document.addEventListener('mousemove', handleDocumentMouseMove)

        return () => {
            document.removeEventListener('mousemove', handleDocumentMouseMove)
            // Reset ignore mouse when component unmounts
            if (window.electronAPI && window.electronAPI.setWindowIgnoreMouse) {
                window.electronAPI.setWindowIgnoreMouse('menu', false, false)
            }
        }
    }, [])

    return (
        <div className="menu-popup-overlay">
            <div 
                className="menu-popup"
                ref={menuPopupRef}
                onMouseEnter={handleMenuPopupMouseEnter}
            >
                <div className="menu-actions">
                    {actions
                        .map(actionType => {
                            const config = actionConfigMap.get(actionType)
                            if (!config) return null
                            return (
                                <button
                                    key={actionType}
                                    className={`action-btn ${isHovered === actionType ? 'action-btn-hover' : ''}`}
                                    onMouseEnter={() => handleMouseEnter(actionType)}
                                    onMouseLeave={handleMouseLeave}
                                    onClick={() => handleClick(actionType)}
                                >
                                    <img src={config.icon} alt={t(config.altKey)} className="action-icon" />
                                    <span className="action-label">{t(config.labelKey)}</span>
                                </button>
                            )
                        })
                        .filter(button => button !== null)}
                </div>
            </div>
        </div>
    )
}

export default MenuPopup