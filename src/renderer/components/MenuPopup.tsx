import './MenuPopup.css'
import translateIcon from '../assets/icons/translate.svg'
import qaIcon from '../assets/icons/qa.svg'
import explainIcon from '../assets/icons/explain.svg'
import modifyIcon from '../assets/icons/edit.svg'
import customIcon from '../assets/icons/text.svg'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef } from 'react';
import { getIconComponent } from './IconPicker'

interface CustomAction {
    id: string
    name: string
    prompt: string
    icon?: string
}

interface MenuPopupProps {
    selectedText: string
    onAction: (action: string) => void
    actions?: string[]
    customActions?: CustomAction[]
}

const MenuPopup = ({ selectedText, onAction, actions = ['explain', 'translate', 'ask'], customActions = [] }: MenuPopupProps) => {
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
    const actionsRef = useRef<HTMLDivElement>(null);

    // Balance flex wrap: shrink container to the minimum width that keeps the same row count
    useEffect(() => {
        const el = actionsRef.current
        if (!el) return
        // Reset to max so we can measure natural wrap
        el.style.width = ''
        const children = Array.from(el.children) as HTMLElement[]
        if (children.length <= 1) return

        const getRowCount = () => {
            const tops = new Set(children.map(c => c.offsetTop))
            return tops.size
        }

        const rows = getRowCount()
        if (rows <= 1) return

        // Binary search for minimum width that keeps the same row count
        let lo = 0
        let hi = el.offsetWidth
        while (hi - lo > 1) {
            const mid = Math.floor((lo + hi) / 2)
            el.style.width = mid + 'px'
            if (getRowCount() > rows) {
                lo = mid
            } else {
                hi = mid
            }
        }
        el.style.width = hi + 'px'
    }, [actions, customActions])

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
                <div className="menu-actions" ref={actionsRef}>
                    {actions
                        .map(actionType => {
                            // Built-in action
                            const config = actionConfigMap.get(actionType)
                            if (config) {
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
                            }
                            // Custom action (custom:<id>)
                            if (actionType.startsWith('custom:')) {
                                const customId = actionType.replace('custom:', '')
                                const ca = customActions.find(a => a.id === customId)
                                if (!ca) return null
                                const renderIcon = () => {
                                    if (ca.icon) {
                                        const LucideIcon = getIconComponent(ca.icon)
                                        return <LucideIcon size={16} className="action-icon" />
                                    }
                                    return <img src={customIcon} alt={ca.name} className="action-icon" />
                                }
                                return (
                                    <button
                                        key={actionType}
                                        className={`action-btn ${isHovered === actionType ? 'action-btn-hover' : ''}`}
                                        onMouseEnter={() => handleMouseEnter(actionType)}
                                        onMouseLeave={handleMouseLeave}
                                        onClick={() => handleClick(actionType)}
                                    >
                                        {renderIcon()}
                                        <span className="action-label">{ca.name}</span>
                                    </button>
                                )
                            }
                            return null
                        })
                        .filter(button => button !== null)}
                </div>
            </div>
        </div>
    )
}

export default MenuPopup