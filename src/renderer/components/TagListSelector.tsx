import { useState, useEffect, useRef } from 'react'
import plusIcon from '../assets/icons/plus.svg'
import './TagListSelector.css'

export interface TagItem {
    name: string
    displayName: string
}

interface TagListSelectorProps {
    title: string
    selectedItems: TagItem[]
    availableItems: TagItem[]
    onAdd: (itemName: string) => Promise<void>
    onRemove: (itemName: string) => Promise<void>
    emptyMessage?: string
    addButtonTitle?: string
    availableItemsTitle?: string
    noAvailableItemsMessage?: string
    onLoadAvailableItems?: () => Promise<TagItem[]>
    className?: string
    errorMessage?: string
}

const TagListSelector: React.FC<TagListSelectorProps> = ({
    title,
    selectedItems,
    availableItems: initialAvailableItems,
    onAdd,
    onRemove,
    emptyMessage = '',
    addButtonTitle = 'Add',
    availableItemsTitle = '',
    noAvailableItemsMessage = '',
    onLoadAvailableItems,
    className = '',
    errorMessage = ''
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [hoveredItem, setHoveredItem] = useState<string | null>(null)
    const [availableItems, setAvailableItems] = useState<TagItem[]>(initialAvailableItems)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    // Update availableItems when initialAvailableItems changes
    useEffect(() => {
        setAvailableItems(initialAvailableItems)
    }, [initialAvailableItems])

    const handleAdd = async (itemName: string) => {
        const normalizedName = itemName.toLowerCase()
        if (selectedItems.some(item => item.name.toLowerCase() === normalizedName)) {
            setIsDropdownOpen(false)
            return
        }
        await onAdd(itemName)
        setIsDropdownOpen(false)
        setHoveredItem(null)
    }

    const handleRemove = async (itemName: string) => {
        await onRemove(itemName)
    }

    const openDropdown = async () => {
        // Always load latest available items when opening dropdown
        if (onLoadAvailableItems) {
            try {
                const items = await onLoadAvailableItems()
                setAvailableItems(items)
            } catch (error) {
                console.error('Error loading available items:', error)
            }
        } else {
            // If no onLoadAvailableItems callback, use initialAvailableItems
            setAvailableItems(initialAvailableItems)
        }
        setIsDropdownOpen(true)
    }

    const closeDropdown = () => {
        setIsDropdownOpen(false)
    }

    const handleDropdownClick = async () => {
        if (!isDropdownOpen) {
            await openDropdown()
        } else {
            closeDropdown()
        }
    }

    // Get items that are available for selection
    const getAvailableItemsForSelection = () => {
        return availableItems
    }

    // Check if an item is already selected
    const isItemSelected = (itemName: string) => {
        const normalizedName = itemName.toLowerCase()
        return selectedItems.some(item => item.name.toLowerCase() === normalizedName)
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                closeDropdown()
            }
        }

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isDropdownOpen])

    const availableItemsForSelection = getAvailableItemsForSelection()

    return (
        <div className={`tag-list-selector ${className}`} style={{ marginTop: '20px', position: 'relative' }}>
            <div className="tag-list-selector-header">
                <h3 className="tag-list-selector-title">
                    {title}
                </h3>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {errorMessage && (
                        <span style={{ 
                            color: '#d32f2f', 
                            fontSize: '12px', 
                            lineHeight: '24px',
                            whiteSpace: 'nowrap'
                        }}>
                            {errorMessage}
                        </span>
                    )}
                    <button
                        ref={buttonRef}
                        onClick={handleDropdownClick}
                        className="tag-list-selector-add-button"
                        title={addButtonTitle}
                    >
                        <img 
                            src={plusIcon} 
                            alt="Add" 
                            className="tag-list-selector-add-icon"
                        />
                    </button>
                    {isDropdownOpen && (
                        <div 
                            ref={dropdownRef}
                            className="provider-dropdown-menu tag-list-selector-dropdown"
                            style={{
                                position: 'absolute',
                                top: `-${availableItemsForSelection.length === 0 ? 20 : Math.min(availableItemsForSelection.length * 40 + 20, 180)}px`,
                                left: '-184px',
                                marginBottom: '4px',
                                zIndex: 1000,
                                maxHeight: '200px',
                                overflowY: 'auto',
                                width: '180px'
                            }}
                        >
                            {availableItemsForSelection.length > 0 && availableItemsTitle && (
                                <div className="tag-list-selector-dropdown-title">
                                    {availableItemsTitle}
                                </div>
                            )}
                            {availableItemsForSelection.length === 0 ? (
                                <div className="tag-list-selector-empty-dropdown">
                                    {noAvailableItemsMessage}
                                </div>
                            ) : (
                                availableItemsForSelection.map(item => {
                                    const isSelected = isItemSelected(item.name)
                                    return (
                                        <div
                                            key={item.name}
                                            className={`provider-item tag-list-selector-dropdown-item ${isSelected ? 'tag-selected' : ''}`}
                                            onClick={() => handleAdd(item.name)}
                                        >
                                            <div className="provider-item-name">
                                                {item.displayName || (item.name.charAt(0).toUpperCase() + item.name.slice(1))}
                                            </div>
                                            {/* isSelected && (
                                                <svg 
                                                    className="tag-list-selector-checkmark"
                                                    width="16" 
                                                    height="16" 
                                                    viewBox="0 0 16 16" 
                                                    fill="none" 
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <path 
                                                        d="M13.5 4.5L6 12L2.5 8.5" 
                                                        stroke="currentColor" 
                                                        strokeWidth="1.5" 
                                                        strokeLinecap="round" 
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            ) */}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
            {selectedItems.length === 0 ? (
                <p className="tag-list-selector-empty-message">
                    {emptyMessage}
                </p>
            ) : (
                <div className="tag-list-selector-items">
                    {selectedItems.map(item => (
                        <div
                            key={item.name}
                            onMouseEnter={() => setHoveredItem(item.name)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className="tag-list-selector-item"
                        >
                            <button
                                onClick={() => handleRemove(item.name)}
                                className={`tag-list-selector-item-remove ${hoveredItem === item.name ? 'visible' : ''}`}
                            >
                                ×
                            </button>
                            <span>{item.displayName || (item.name.charAt(0).toUpperCase() + item.name.slice(1))}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default TagListSelector

