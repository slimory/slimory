import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Type, Pencil, FileText, Languages, MessageSquare, Search,
    Sparkles, Wand2, BookOpen, Code, ListChecks, AlignLeft,
    Hash, Quote, Scissors, Copy, ClipboardPaste, RotateCcw,
    ArrowRightLeft, Braces, Heading1, CaseSensitive, SpellCheck,
    ScanText, TextCursorInput, Lightbulb, Zap, Bot, Eraser, Replace,
    CheckCircle, XCircle, AlertCircle, Info, HelpCircle, Star,
    Heart, ThumbsUp, ThumbsDown, Flag, Bookmark, Tag, Filter,
    SortAsc, SortDesc, Calendar, Clock, Timer, Bell, Mail,
    Send, Inbox, Archive, Trash, Download, Upload, Share2,
    Link, Unlink, Eye, EyeOff, Lock, Unlock, Key, Shield,
    Settings, Sliders, Wrench, Hammer, Package, Box,
    Folder, FolderOpen, File, FileEdit, FilePlus, FileMinus, FileCheck,
    Image, Video, Music, Mic, Volume2, VolumeX, Play, Pause,
    SkipForward, SkipBack, Repeat, Shuffle, Maximize, Minimize, ZoomIn,
    ZoomOut, Move, Crop, MoreHorizontal, MoreVertical, Menu, Grid,
    List, Columns, Rows, Table, Database, Server, Cloud, HardDrive
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './IconPicker.css'

const ICON_MAP: Record<string, LucideIcon> = {
    Type, Pencil, FileText, Languages, MessageSquare, Search,
    Sparkles, Wand2, BookOpen, Code, ListChecks, AlignLeft,
    Hash, Quote, Scissors, Copy, ClipboardPaste, RotateCcw,
    ArrowRightLeft, Braces, Heading1, CaseSensitive, SpellCheck,
    ScanText, TextCursorInput, Lightbulb, Zap, Bot, Eraser, Replace,
    CheckCircle, XCircle, AlertCircle, Info, HelpCircle, Star,
    Heart, ThumbsUp, ThumbsDown, Flag, Bookmark, Tag, Filter,
    SortAsc, SortDesc, Calendar, Clock, Timer, Bell, Mail,
    Send, Inbox, Archive, Trash, Download, Upload, Share2,
    Link, Unlink, Eye, EyeOff, Lock, Unlock, Key, Shield,
    Settings, Sliders, Wrench, Hammer, Package, Box,
    Folder, FolderOpen, File, FileEdit, FilePlus, FileMinus, FileCheck,
    Image, Video, Music, Mic, Volume2, VolumeX, Play, Pause,
    SkipForward, SkipBack, Repeat, Shuffle, Maximize, Minimize, ZoomIn,
    ZoomOut, Move, Crop, MoreHorizontal, MoreVertical, Menu, Grid,
    List, Columns, Rows, Table, Database, Server, Cloud, HardDrive
}

export const ICON_NAMES = Object.keys(ICON_MAP)

export function getIconComponent(name: string): LucideIcon {
    return ICON_MAP[name] || Type
}

interface IconPickerProps {
    value?: string
    onChange: (iconName: string) => void
}

export default function IconPicker({ value, onChange }: IconPickerProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        if (open) document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    const SelectedIcon = getIconComponent(value || 'Type')
    const filtered = search
        ? ICON_NAMES.filter(n => n.toLowerCase().includes(search.toLowerCase()))
        : ICON_NAMES

    return (
        <div className="icon-picker" ref={ref}>
            <button
                type="button"
                className="icon-picker-trigger"
                onClick={() => setOpen(!open)}
            >
                <SelectedIcon size={16} />
            </button>
            {open && (
                <div className="icon-picker-popover">
                    <input
                        className="icon-picker-search"
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('settings.customActionIconSearch')}
                        autoFocus
                    />
                    <div className="icon-picker-grid">
                        {filtered.map(name => {
                            const Icon = ICON_MAP[name]
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    className={`icon-picker-item${value === name ? ' selected' : ''}`}
                                    title={name}
                                    onClick={() => { onChange(name); setOpen(false); setSearch('') }}
                                >
                                    <Icon size={16} />
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
