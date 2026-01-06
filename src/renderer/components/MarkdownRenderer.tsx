import React from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './MarkdownRenderer.css'

interface Resource {
    index: number
    url: string
    title?: string
    source?: string
}

interface MarkdownRendererProps {
    content: string
    className?: string
    resources?: Resource[]
}

const CopyButton: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = React.useState(false)

    const handleCopy = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            console.error('Failed to copy code:', error)
        }
    }

    return (
        <button
            className="code-copy-button"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy code'}
        >
            {copied ? (
                <svg style={{ padding: "1px" }} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                    <path d="M3 11V3C3 2.44772 3.44772 2 4 2H11" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                </svg>
            )}
        </button>
    )
}

const CitationButton: React.FC<{ number: number; resource?: Resource }> = ({ number, resource }) => {
    const buttonRef = React.useRef<HTMLButtonElement>(null)
    const [tooltipOffset, setTooltipOffset] = React.useState(0)
    const calculateTooltipOffset = React.useCallback(() => {
        if (!buttonRef.current) return

        const markdownRenderer = buttonRef.current.closest('.markdown-renderer') as HTMLElement
        if (!markdownRenderer) return
        
        const containerRect = markdownRenderer.getBoundingClientRect()
        const buttonRect = buttonRef.current.getBoundingClientRect()
        
        // Tooltip width (fixed 200px)
        const tooltipWidth = 200
        const tooltipHalfWidth = tooltipWidth / 2
        
        // Calculate tooltip center position relative to container
        const buttonCenterX = buttonRect.left + buttonRect.width / 2 - containerRect.left
        const tooltipLeft = buttonCenterX - tooltipHalfWidth
        const tooltipRight = buttonCenterX + tooltipHalfWidth
        
        // Check if exceeds left boundary
        if (tooltipLeft < 0) {
            const overflow = -tooltipLeft
            setTooltipOffset(overflow + 10) // Move in opposite direction by overflow distance + 10px
        }
        // Check if exceeds right boundary
        else if (tooltipRight > containerRect.width) {
            const overflow = tooltipRight - containerRect.width
            setTooltipOffset(-(overflow + 10)) // Move in opposite direction by overflow distance + 10px
        }
        else {
            setTooltipOffset(0) // No overflow, keep centered
        }
    }, [])

    // Calculate tooltip offset on render
    React.useEffect(() => {
        // Delay one frame to ensure DOM is rendered
        const timer = requestAnimationFrame(() => {
            calculateTooltipOffset()
        })

        return () => {
            cancelAnimationFrame(timer)
        }
    }, [calculateTooltipOffset])

    // Listen for window resize and container size changes
    React.useEffect(() => {
        const markdownRenderer = buttonRef.current?.closest('.markdown-renderer') as HTMLElement
        if (!markdownRenderer) return

        // Use ResizeObserver to listen for container size changes
        const resizeObserver = new ResizeObserver(() => {
            calculateTooltipOffset()
        })

        resizeObserver.observe(markdownRenderer)

        // Listen for window resize
        const handleResize = () => {
            calculateTooltipOffset()
        }
        window.addEventListener('resize', handleResize)

        return () => {
            resizeObserver.disconnect()
            window.removeEventListener('resize', handleResize)
        }
    }, [calculateTooltipOffset])

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault()
        if (resource?.url && window.electronAPI) {
            try {
                await window.electronAPI.openExternalUrl(resource.url)
            } catch (error) {
                console.error('Error opening URL:', error)
            }
        }
    }

    if (!resource?.url) {
        // If no URL, display text only
        return <span className="citation-text">{number}</span>
    }

    // Build tooltip content: source + title
    const tooltipContent = resource.source && resource.title
        ? `${resource.source} | ${resource.title}`
        : resource.source || resource.title || resource.url

    return (
        <button
            ref={buttonRef}
            className="citation-button"
            onClick={handleClick}
            style={{
                '--tooltip-offset': `${tooltipOffset}px`
            } as React.CSSProperties}
            data-tooltip={tooltipContent}
        >
            {number}
        </button>
    )
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', resources = [] }) => {
    // Create resources map for easy lookup
    const resourcesMap = new Map<number, Resource>()
    resources.forEach(resource => {
        resourcesMap.set(resource.index, resource)
    })

    // Extract all citation numbers and create remapping
    // Example: if text has [1,11,5,2,1,12], extract [1,2,5,11,12], sort and map as 1->1, 2->2, 5->3, 11->4, 12->5
    const citationNumberMap = React.useMemo(() => {
        const citationRegex = /\[(\d+)\]/g
        const uniqueNumbers = new Set<number>()
        let match: RegExpExecArray | null
        
        // Extract all unique citation numbers
        while ((match = citationRegex.exec(content)) !== null) {
            const number = parseInt(match[1], 10)
            uniqueNumbers.add(number)
        }
        
        // Sort numbers
        const sortedNumbers = Array.from(uniqueNumbers).sort((a, b) => a - b)
        
        // Create mapping: original number -> new number (starting from 1)
        const map = new Map<number, number>()
        sortedNumbers.forEach((originalNumber, index) => {
            map.set(originalNumber, index + 1)
        })
        
        return map
    }, [content])

    // Simple markdown parser for basic markdown features
    // For more advanced features, consider using react-markdown library
    
    const parseMarkdown = (text: string): React.ReactNode => {
        if (!text) return null

        // Split by lines to process block-level elements
        const lines = text.split('\n')
        const elements: React.ReactNode[] = []
        let currentParagraph: string[] = []
        let inCodeBlock = false
        let codeBlockLanguage = ''
        let codeBlockContent: string[] = []
        let inList = false
        let listItems: string[] = []
        let inMathBlock = false
        let mathBlockContent: string[] = []

        const flushParagraph = () => {
            if (currentParagraph.length > 0) {
                const paragraphText = currentParagraph.join('\n')
                if (paragraphText.trim()) {
                    // Split by newlines and render each part separately with <br /> between them
                    const lines = paragraphText.split('\n')
                    const paragraphContent: React.ReactNode[] = []
                    lines.forEach((line, lineIdx) => {
                        if (lineIdx > 0) {
                            paragraphContent.push(<br key={`br-${lineIdx}`} />)
                        }
                        paragraphContent.push(parseInlineMarkdown(line))
                    })
                    elements.push(
                        <p key={`p-${elements.length}`} className="markdown-paragraph">
                            {paragraphContent}
                        </p>
                    )
                }
                currentParagraph = []
            }
        }

        const flushCodeBlock = () => {
            if (codeBlockContent.length > 0) {
                const codeText = codeBlockContent.join('\n')
                elements.push(
                    <div key={`code-wrapper-${elements.length}`} className="markdown-code-block-wrapper">
                        <pre className="markdown-code-block">
                            <code className={codeBlockLanguage ? `language-${codeBlockLanguage}` : ''}>
                                {codeText}
                            </code>
                        </pre>
                        <CopyButton code={codeText} />
                    </div>
                )
                codeBlockContent = []
                codeBlockLanguage = ''
            }
        }

        const flushMathBlock = () => {
            if (mathBlockContent.length > 0) {
                const mathContent = mathBlockContent.join('\n').trim()
                try {
                    const html = katex.renderToString(mathContent, {
                        displayMode: true,
                        throwOnError: false
                    })
                    elements.push(
                        <div 
                            key={`math-${elements.length}`} 
                            className="markdown-math-block"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    )
                } catch (error) {
                    // If rendering fails, show the raw LaTeX
                    elements.push(
                        <pre key={`math-${elements.length}`} className="markdown-math-block markdown-math-error">
                            {mathContent}
                        </pre>
                    )
                }
                mathBlockContent = []
            }
        }

        const flushList = () => {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={`ul-${elements.length}`} className="markdown-list">
                        {listItems.map((item, idx) => (
                            <li key={idx} className="markdown-list-item">
                                {parseInlineMarkdown(item.replace(/^[-*+]\s+/, ''))}
                            </li>
                        ))}
                    </ul>
                )
                listItems = []
            }
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            const trimmedLine = line.trim()

            // Math blocks: \[ ... \] or $$ ... $$
            if (trimmedLine === '\\[' || trimmedLine === '$$') {
                if (inMathBlock) {
                    flushMathBlock()
                    inMathBlock = false
                } else {
                    flushParagraph()
                    flushList()
                    inList = false
                    inMathBlock = true
                }
                continue
            }

            // Check for closing math block markers
            if (inMathBlock && (trimmedLine === '\\]' || trimmedLine === '$$')) {
                flushMathBlock()
                inMathBlock = false
                continue
            }

            if (inMathBlock) {
                mathBlockContent.push(line)
                continue
            }

            // Code blocks
            if (trimmedLine.startsWith('```')) {
                if (inCodeBlock) {
                    flushCodeBlock()
                    inCodeBlock = false
                } else {
                    flushParagraph()
                    flushList()
                    inList = false
                    codeBlockLanguage = trimmedLine.slice(3).trim()
                    inCodeBlock = true
                }
                continue
            }

            if (inCodeBlock) {
                codeBlockContent.push(line)
                continue
            }

            // Headers
            if (trimmedLine.match(/^#{1,6}\s+/)) {
                flushParagraph()
                flushList()
                inList = false
                const match = trimmedLine.match(/^(#{1,6})\s+(.+)$/)
                if (match) {
                    const level = match[1].length
                    const text = match[2]
                    const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements
                    elements.push(
                        <HeadingTag key={`h${level}-${elements.length}`} className={`markdown-heading markdown-h${level}`}>
                            {parseInlineMarkdown(text)}
                        </HeadingTag>
                    )
                }
                continue
            }

            // Horizontal rule
            if (trimmedLine.match(/^[-*_]{3,}$/)) {
                flushParagraph()
                flushList()
                inList = false
                elements.push(<hr key={`hr-${elements.length}`} className="markdown-hr" />)
                continue
            }

            // Lists
            if (trimmedLine.match(/^[-*+]\s+/)) {
                flushParagraph()
                if (!inList) {
                    inList = true
                }
                listItems.push(trimmedLine)
                continue
            } else if (inList && trimmedLine === '') {
                flushList()
                inList = false
                continue
            } else if (inList) {
                // Continuation of list item
                if (listItems.length > 0) {
                    listItems[listItems.length - 1] += ' ' + trimmedLine
                }
                continue
            }

            // Empty line
            if (trimmedLine === '') {
                flushParagraph()
                continue
            }

            // Regular paragraph text
            currentParagraph.push(line)
        }

        // Flush remaining content
        flushParagraph()
        flushList()
        flushCodeBlock()
        flushMathBlock()

        return elements.length > 0 ? <>{elements}</> : null
    }

    const parseInlineMarkdown = (text: string): React.ReactNode => {
        const parts: React.ReactNode[] = []
        
        // First match citation markers [1], [2], [3], etc.
        const citationMatches: Array<{ start: number; end: number; number: number }> = []
        const citationRegex = /\[(\d+)\]/g
        let match: RegExpExecArray | null
        while ((match = citationRegex.exec(text)) !== null) {
            const number = parseInt(match[1], 10)
            citationMatches.push({
                start: match.index,
                end: match.index + match[0].length,
                number
            })
        }
        
        // First, find all matches for different patterns
        // IMPORTANT: Process citations first, then math, then **bold**, then *italic*, to avoid conflicts
        const mathMatches: Array<{ start: number; end: number; content: string }> = []
        const strongMatches: Array<{ start: number; end: number; content: string }> = []
        const emMatches: Array<{ start: number; end: number; content: string }> = []
        const codeMatches: Array<{ start: number; end: number; content: string }> = []
        const linkMatches: Array<{ start: number; end: number; content: string; href: string }> = []

        // Match inline math: \( ... \) or $ ... $ (but not $$ which is block)
        // First match \( ... \) - need to handle nested parentheses (both \( \) and regular ())
        let parenSearchIndex = 0
        while (parenSearchIndex < text.length) {
            const openParen = text.indexOf('\\(', parenSearchIndex)
            if (openParen === -1) break
            
            // Find the matching closing \)
            // We need to track depth for both \( \) and regular ( )
            let depth = 0
            let found = false
            let i = openParen + 2 // Skip \(
            
            while (i < text.length) {
                if (i < text.length - 1 && text[i] === '\\') {
                    // Check for \( (nested math opening)
                    if (text[i + 1] === '(') {
                        depth++
                        i += 2 // Move past \(
                        continue
                    }
                    // Check for \) (math closing)
                    else if (text[i + 1] === ')') {
                        if (depth === 0) {
                            found = true
                            break
                        }
                        depth--
                        i += 2 // Move past \)
                        continue
                    }
                }
                
                // Check for regular parentheses (need to track depth)
                if (text[i] === '(') {
                    depth++
                } else if (text[i] === ')') {
                    depth--
                }
                
                i++ // Move to next character
            }
            
            if (found) {
                const content = text.substring(openParen + 2, i).trim()
                if (content) {
                    mathMatches.push({
                        start: openParen,
                        end: i + 2, // Include \)
                        content: content
                    })
                }
                parenSearchIndex = i + 2
            } else {
                parenSearchIndex = openParen + 2
            }
        }
        
        // Then match $ ... $ (but not $$)
        // We need to be careful to avoid matching $$ which is block math
        let searchIndex = 0
        while (searchIndex < text.length) {
            const dollarIndex = text.indexOf('$', searchIndex)
            if (dollarIndex === -1) break
            
            // Check if it's the start of $$ (block math)
            if (text[dollarIndex + 1] === '$') {
                // Skip the $$ block math delimiter
                const nextDollar = text.indexOf('$$', dollarIndex + 2)
                if (nextDollar !== -1) {
                    searchIndex = nextDollar + 2
                } else {
                    searchIndex = dollarIndex + 2
                }
                continue
            }
            
            // Find the closing $
            const closingDollar = text.indexOf('$', dollarIndex + 1)
            if (closingDollar === -1) break
            
            // Check if the closing $ is not part of $$
            if (text[closingDollar + 1] !== '$') {
                const content = text.substring(dollarIndex + 1, closingDollar).trim()
                if (content) {
                    mathMatches.push({
                        start: dollarIndex,
                        end: closingDollar + 1,
                        content: content
                    })
                }
                searchIndex = closingDollar + 1
            } else {
                searchIndex = closingDollar + 1
            }
        }

        // Match **bold** first
        const strongRegex = /\*\*(.+?)\*\*/g
        while ((match = strongRegex.exec(text)) !== null) {
            strongMatches.push({
                start: match.index,
                end: match.index + match[0].length,
                content: match[1]
            })
        }

        // Match *italic* but exclude those that are part of **bold**
        const emRegex = /\*(.+?)\*/g
        while ((match = emRegex.exec(text)) !== null) {
            // Check if this match overlaps with any strong match
            const overlaps = strongMatches.some(sm => 
                (match!.index >= sm.start && match!.index < sm.end) ||
                (match!.index + match![0].length > sm.start && match!.index + match![0].length <= sm.end) ||
                (match!.index <= sm.start && match!.index + match![0].length >= sm.end)
            )
            if (!overlaps) {
                emMatches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    content: match[1]
                })
            }
        }

        // Match inline code
        const codeRegex = /`(.+?)`/g
        while ((match = codeRegex.exec(text)) !== null) {
            codeMatches.push({
                start: match.index,
                end: match.index + match[0].length,
                content: match[1]
            })
        }

        // Match links (but exclude citation markers, as they are already processed)
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
        while ((match = linkRegex.exec(text)) !== null) {
            // Check if it's a citation marker format [number]
            const isCitation = /^\d+$/.test(match[1])
            if (!isCitation) {
                linkMatches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    content: match[1],
                    href: match[2]
                })
            }
        }

        // Combine all matches and sort by position
        // Note: citation markers have priority over other formats, followed by math formulas
        const allMatches: Array<{ start: number; end: number; type: string; content?: string; href?: string; number?: number }> = [
            ...citationMatches.map(m => ({ ...m, type: 'citation' as const, number: m.number })),
            ...mathMatches.map(m => ({ ...m, type: 'math' })),
            ...strongMatches.map(m => ({ ...m, type: 'strong' })),
            ...emMatches.map(m => ({ ...m, type: 'em' })),
            ...codeMatches.map(m => ({ ...m, type: 'code' })),
            ...linkMatches.map(m => ({ ...m, type: 'a', href: m.href }))
        ]

        // Sort matches by start position
        allMatches.sort((a, b) => a.start - b.start)

        // Remove overlapping matches (keep the first one, but citations have priority)
        const filteredMatches: typeof allMatches = []
        for (const match of allMatches) {
            const overlaps = filteredMatches.some(fm => 
                (match.start >= fm.start && match.start < fm.end) ||
                (match.end > fm.start && match.end <= fm.end) ||
                (match.start <= fm.start && match.end >= fm.end)
            )
            if (!overlaps) {
                filteredMatches.push(match)
            }
        }

        // Build React elements
        let lastIndex = 0
        filteredMatches.forEach((match, idx) => {
            // Add text before match
            if (match.start > lastIndex) {
                const beforeText = text.substring(lastIndex, match.start)
                if (beforeText) {
                    parts.push(beforeText)
                }
            }

            // Add matched element
            switch (match.type) {
                case 'citation':
                    const originalNumber = match.number!
                    // Use original number to get resource from resourcesMap
                    const resource = resourcesMap.get(originalNumber)
                    // Use remapped new number for display
                    const displayNumber = citationNumberMap.get(originalNumber) || originalNumber
                    parts.push(
                        <CitationButton 
                            key={`citation-${idx}`} 
                            number={displayNumber} 
                            resource={resource} // Pass the entire resource object
                        />
                    )
                    break
                case 'math':
                    try {
                        const html = katex.renderToString(match.content || '', {
                            displayMode: false,
                            throwOnError: false
                        })
                        parts.push(
                            <span 
                                key={`math-${idx}`} 
                                className="markdown-inline-math"
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        )
                    } catch (error) {
                        // If rendering fails, show the raw LaTeX
                        parts.push(
                            <span key={`math-${idx}`} className="markdown-inline-math markdown-math-error">
                                ${match.content}$
                            </span>
                        )
                    }
                    break
                case 'strong':
                    parts.push(<strong key={`strong-${idx}`} className="markdown-bold">{match.content}</strong>)
                    break
                case 'em':
                    parts.push(<em key={`em-${idx}`} className="markdown-italic">{match.content}</em>)
                    break
                case 'code':
                    parts.push(<code key={`code-${idx}`} className="markdown-inline-code">{match.content}</code>)
                    break
                case 'a':
                    parts.push(
                        <a 
                            key={`a-${idx}`} 
                            href={match.href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="markdown-link"
                        >
                            {match.content}
                        </a>
                    )
                    break
            }

            lastIndex = match.end
        })

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex))
        }

        return parts.length > 0 ? <>{parts}</> : text
    }

    return (
        <div className={`markdown-renderer ${className}`}>
            {parseMarkdown(content)}
        </div>
    )
}

export default MarkdownRenderer

