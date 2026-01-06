import { BrowserWindow } from 'electron'

/**
 * Show toast notification in browser window
 */
export async function showToast(window: BrowserWindow, message: string): Promise<void> {
    const toastScript = `(function() {
        try {
            // Ensure body exists
            if (!document.body) {
                return;
            }
            
            const existingToast = document.getElementById('webpilot-toast');
            const existingOverlay = document.getElementById('webpilot-overlay');
            
            // If toast already exists, just update its text content
            if (existingToast) {
                existingToast.textContent = ${JSON.stringify(message)};
                // Ensure overlay exists
                if (!existingOverlay) {
                    const overlay = document.createElement('div');
                    overlay.id = 'webpilot-overlay';
                    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255, 255, 255, 0.1); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 999998; will-change: opacity; animation: fadeIn 0.2s ease-out;';
                    document.body.appendChild(overlay);
                }
                return;
            }
            
            // Create overlay (full screen blur background)
            const overlay = document.createElement('div');
            overlay.id = 'webpilot-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255, 255, 255, 0.1); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); z-index: 999998; will-change: opacity; animation: fadeIn 0.2s ease-out;';
            
            // Create toast element
            const toast = document.createElement('div');
            toast.id = 'webpilot-toast';
            toast.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate3d(-50%, -50%, 0); background-color: white; color: #333; padding: 16px 24px; border-radius: 16px; border: 2px solid #5BCFD1; box-shadow: 0 4px 12px rgba(91, 207, 209, 0.3); z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 14px; font-weight: 500; max-width: 80%; text-align: center; word-wrap: break-word; will-change: transform, opacity; animation: fadeInUp 0.2s cubic-bezier(0.4, 0, 0.2, 1);';
            toast.textContent = ${JSON.stringify(message)};
            
            // Add fade-in animations (optimized for performance)
            const style = document.createElement('style');
            style.textContent = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes fadeInUp { from { opacity: 0; transform: translate3d(-50%, calc(-50% + 20px), 0); } to { opacity: 1; transform: translate3d(-50%, -50%, 0); } } @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } } @keyframes fadeOutDown { from { opacity: 1; transform: translate3d(-50%, -50%, 0); } to { opacity: 0; transform: translate3d(-50%, calc(-50% + 20px), 0); } }';
            if (document.head && !document.getElementById('webpilot-toast-style')) {
                style.id = 'webpilot-toast-style';
                document.head.appendChild(style);
            }
            
            document.body.appendChild(overlay);
            document.body.appendChild(toast);
        } catch(e) {
            console.error('Failed to show toast:', e);
        }
    })();`
    
    try {
        // Add timeout to prevent hanging
        await Promise.race([
            window.webContents.executeJavaScript(toastScript),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Toast timeout')), 5000)
            )
        ])
    } catch (error) {
        // Ignore errors if page is not ready
        console.warn('[OperationTool] Failed to show toast:', error)
    }
}

/**
 * Hide toast notification in browser window
 */
export async function hideToast(window: BrowserWindow): Promise<void> {
    const hideScript = `(function() {
        try {
            const toast = document.getElementById('webpilot-toast');
            const overlay = document.getElementById('webpilot-overlay');
            
            if (toast) {
                toast.style.animation = 'fadeOutDown 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
                setTimeout(function() {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 200);
            }
            
            if (overlay) {
                overlay.style.animation = 'fadeOut 0.2s ease-out';
                setTimeout(function() {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 200);
            }
        } catch(e) {
            console.error('Failed to hide toast:', e);
        }
    })();`
    try {
        // Add timeout to prevent hanging
        await Promise.race([
            window.webContents.executeJavaScript(hideScript),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Hide toast timeout')), 5000)
            )
        ])
    } catch (error) {
        // Ignore errors if page is not ready
        console.warn('[OperationTool] Failed to hide toast:', error)
    }
}

/**
 * Show message panel for tool calls and streaming code
 * Panel is positioned at 50% window height, centered horizontally
 * Size: 400x260px
 */
export async function showMessagePanel(window: BrowserWindow, title: string): Promise<void> {
    console.log('showMessagePanel', title)
    const showScript = `(function() {
        try {
            if (!document.body) return;
            
            // Remove existing panel if any
            const existingPanel = document.getElementById('webpilot-message-panel');
            if (existingPanel) {
                // Remove resize event listener to prevent memory leak
                if (existingPanel._resizeHandler) {
                    window.removeEventListener('resize', existingPanel._resizeHandler);
                    delete existingPanel._resizeHandler;
                }
                existingPanel.remove();
            }
            
            // Panel dimensions
            const panelWidth = 450;
            const panelHeight = 200;
            
            // Function to update panel position
            function updatePanelPosition() {
                const panel = document.getElementById('webpilot-message-panel');
                if (!panel) return;
                
                const windowHeight = window.innerHeight;
                const windowWidth = window.innerWidth;
                const panelTop = windowHeight * 0.5 + 50;
                const panelLeft = (windowWidth - panelWidth) / 2;
                
                panel.style.top = panelTop + 'px';
                panel.style.left = panelLeft + 'px';
            }
            
            // Get initial window dimensions and calculate position
            const windowHeight = window.innerHeight;
            const panelTop = windowHeight * 0.5 + 50;
            const panelLeft = (window.innerWidth - panelWidth) / 2;
            
            // Create panel container
            const panel = document.createElement('div');
            panel.id = 'webpilot-message-panel';
            panel.style.cssText = 'position: fixed; top: ' + panelTop + 'px; left: ' + panelLeft + 'px; width: ' + panelWidth + 'px; height: ' + panelHeight + 'px; background-color: rgba(255, 255, 255, 0.98); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); z-index: 999999; font-family: "Consolas", "Monaco", "Courier New", monospace; font-size: 11px; overflow: hidden; display: flex; flex-direction: column; animation: slideDown 0.3s ease-out;';
            
            // Add resize event listener to update panel position when window is resized
            const resizeHandler = function() {
                updatePanelPosition();
            };
            window.addEventListener('resize', resizeHandler);
            
            // Store resize handler on panel element for cleanup
            panel._resizeHandler = resizeHandler;
            
            // Create header
            const header = document.createElement('div');
            header.style.cssText = 'padding: 10px 14px; background-color: #f5f5f5; color: #333; font-weight: 500; font-size: 12px; border-bottom: 1px solid rgba(0, 0, 0, 0.08);';
            header.textContent = ${JSON.stringify(title)};
            
            // Create content area
            const content = document.createElement('div');
            content.id = 'webpilot-message-content';
            content.style.cssText = 'padding: 12px 14px; overflow-y: auto; flex: 1; color: #333; line-height: 1.5;';
            const initDiv = document.createElement('div');
            initDiv.style.cssText = 'color: #999; font-style: italic;';
            initDiv.textContent = 'Initializing...';
            content.appendChild(initDiv);
            
            // Add animations
            const style = document.createElement('style');
            style.id = 'webpilot-message-panel-style';
            style.textContent = \`
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slideUp {
                    from { opacity: 1; transform: translateY(0); }
                    to { opacity: 0; transform: translateY(-20px); }
                }
                #webpilot-message-content::-webkit-scrollbar {
                    width: 6px;
                }
                #webpilot-message-content::-webkit-scrollbar-track {
                    background: #f5f5f5;
                    border-radius: 3px;
                }
                #webpilot-message-content::-webkit-scrollbar-thumb {
                    background: #ccc;
                    border-radius: 3px;
                }
                #webpilot-message-content::-webkit-scrollbar-thumb:hover {
                    background: #999;
                }
            \`;
            if (document.head && !document.getElementById('webpilot-message-panel-style')) {
                document.head.appendChild(style);
            }
            
            panel.appendChild(header);
            panel.appendChild(content);
            document.body.appendChild(panel);
        } catch(e) {
            console.error('Failed to show message panel:', e);
        }
    })();`
    
    try {
        await Promise.race([
            window.webContents.executeJavaScript(showScript),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Show message panel timeout')), 5000)
            )
        ])
    } catch (error) {
        console.warn('[WebPilot] Failed to show message panel:', error)
    }
}

/**
 * Update message panel content (append new content)
 */
export async function updateMessagePanel(window: BrowserWindow, message: string, type: 'tool' | 'code' = 'code', appendToLast: boolean = false): Promise<void> {
    // Escape the message for safe insertion into JavaScript string
    const escapedMessage = JSON.stringify(message)
    const typeStr = JSON.stringify(type)
    const appendMode = appendToLast ? 'true' : 'false'
    
    const updateScript = `(function() {
        try {
            const content = document.getElementById('webpilot-message-content');
            if (!content) {
                console.warn('Message panel content not found');
                return;
            }
            
            // Clear "Initializing..." message if present
            if (content.children.length === 1 && content.children[0].textContent && content.children[0].textContent.includes('Initializing')) {
                content.textContent = '';
            }
            
            const typeValue = ${typeStr};
            const append = ${appendMode};
            
            // Check if user is at bottom (within 10px threshold)
            const isAtBottom = content.scrollHeight - content.scrollTop - content.clientHeight < 10;
            
            // If appending to last message and last message is of same type
            if (append && content.children.length > 0) {
                const lastChild = content.children[content.children.length - 1];
                const lastChildText = lastChild.textContent || '';
                const isCodeMessage = lastChildText.includes('[CODE]');
                const isToolMessage = lastChildText.includes('[TOOL]');
                
                if ((typeValue === 'code' && isCodeMessage) || (typeValue === 'tool' && isToolMessage)) {
                    // Find the content span and append to it
                    const contentSpan = lastChild.querySelector('span[style*="white-space"]');
                    if (contentSpan) {
                        const messageStr = ${escapedMessage};
                        contentSpan.textContent += messageStr;
                        // Auto scroll to bottom only if user was at bottom
                        if (isAtBottom) {
                            content.scrollTop = content.scrollHeight;
                        }
                        return;
                    }
                }
            }
            
            // Create new message div
            const timestamp = new Date().toLocaleTimeString();
            
            // Parse and escape HTML in message
            const messageStr = ${escapedMessage};
            
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = 'margin-bottom: 6px; padding: 6px 8px; background-color: rgba(0, 0, 0, 0.02); border-radius: 4px;';
            
            // Create timestamp span
            const timeSpan = document.createElement('span');
            timeSpan.style.cssText = 'color: #999; font-size: 10px;';
            timeSpan.textContent = '[' + timestamp + ']';
            messageDiv.appendChild(timeSpan);
            messageDiv.appendChild(document.createTextNode(' '));
            
            // Create prefix span
            const prefixSpan = document.createElement('span');
            prefixSpan.style.cssText = typeValue === 'tool' ? 'color: #5BCFD1; font-weight: 600;' : 'color: #666;';
            prefixSpan.textContent = typeValue === 'tool' ? '[TOOL]' : '[CODE]';
            messageDiv.appendChild(prefixSpan);
            messageDiv.appendChild(document.createTextNode(' '));
            
            // Create message content span
            const contentSpan = document.createElement('span');
            contentSpan.style.cssText = 'white-space: pre-wrap; word-break: break-all;';
            contentSpan.textContent = messageStr;
            messageDiv.appendChild(contentSpan);
            
            content.appendChild(messageDiv);
            
            // Auto scroll to bottom only if user was at bottom
            if (isAtBottom) {
                content.scrollTop = content.scrollHeight;
            }
        } catch(e) {
            console.error('Failed to update message panel:', e);
        }
    })();`
    
    try {
        await Promise.race([
            window.webContents.executeJavaScript(updateScript),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Update message panel timeout')), 5000)
            )
        ])
    } catch (error) {
        console.warn('[WebPilot] Failed to update message panel:', error)
    }
}

/**
 * Hide message panel
 */
export async function hideMessagePanel(window: BrowserWindow): Promise<void> {
    const hideScript = `(function() {
        try {
            const panel = document.getElementById('webpilot-message-panel');
            if (panel) {
                // Remove resize event listener to prevent memory leak
                if (panel._resizeHandler) {
                    window.removeEventListener('resize', panel._resizeHandler);
                    delete panel._resizeHandler;
                }
                
                panel.style.animation = 'slideUp 0.3s ease-out';
                setTimeout(function() {
                    if (panel.parentNode) {
                        panel.parentNode.removeChild(panel);
                    }
                }, 300);
            }
        } catch(e) {
            console.error('Failed to hide message panel:', e);
        }
    })();`
    
    try {
        await Promise.race([
            window.webContents.executeJavaScript(hideScript),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Hide message panel timeout')), 5000)
            )
        ])
    } catch (error) {
        console.warn('[WebPilot] Failed to hide message panel:', error)
    }
}