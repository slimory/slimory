const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Menu window APIs
    onShowMenu: (callback: (event: any, data: any) => void) => {
        ipcRenderer.on('show-menu', callback)
    },
    sendMenuAction: (action: string, text: string) => {
        ipcRenderer.send('menu-action', { action, text })
    },
    hideMenu: () => {
        ipcRenderer.send('hide-menu')
    },
    openChatWindow: (selectedText: string) => {
        ipcRenderer.send('open-chat-window', selectedText)
    },

    // Chat window APIs
    onShowChat: (callback: (event: any, text: string) => void) => {
        ipcRenderer.on('show-chat', callback)
    },
    closeChatWindow: () => {
        ipcRenderer.send('close-chat-window')
    },
    
    // Full chat window APIs
    closeFullChatWindow: () => {
        ipcRenderer.send('close-full-chat-window')
    },
    minimizeFullChatWindow: () => {
        ipcRenderer.send('minimize-full-chat-window')
    },
    setFullChatWindowIgnoreMouse: (ignore: boolean, forward: boolean = false) => {
        ipcRenderer.send('set-full-chat-window-ignore-mouse', ignore, forward)
    },
    // Generic window ignore mouse API
    setWindowIgnoreMouse: (windowName: string, ignore: boolean, forward: boolean = false) => {
        ipcRenderer.send('set-window-ignore-mouse', windowName, ignore, forward)
    },

    // Message window APIs
    onShowMessage: (callback: (event: any, messages: { role: 'user' | 'assistant'; content: string }[], selectedText: string, isNewSession: boolean, command: string, direction: string, sessionId?: string) => void) => {
        ipcRenderer.on('show-message', callback)
    },
    onHideMessage: (callback: (event: any) => void) => {
        ipcRenderer.on('hide-message', callback)
    },
    onHideFullChatWindow: (callback: () => void) => {
        ipcRenderer.on('hide-full-chat-window', callback)
    },
    onWindowMoved: (callback: (event: any, windowName: string, status: string) => void) => {
        ipcRenderer.on('window-move-status', callback)
    },
    closeMessageWindow: () => {
        ipcRenderer.send('close-message-window')
    },
    adjustMessageWindowPosition: (xOffset: number, command?: string) => {
        ipcRenderer.send('adjust-message-window-position', xOffset, command)
    },
    openMessageWindow: (messages: { role: 'user' | 'assistant'; content: string }[], selectedText: string, command: string) => {
        ipcRenderer.send('open-message-window', messages, selectedText, command)
    },

    // Language APIs
    getLanguage: () => {
        return ipcRenderer.invoke('get-language')
    },
    onLanguageUpdated: (callback: (event: any, language: string) => void) => {
        ipcRenderer.on('language-updated', callback)
    },

    // Chat service APIs
    generateChatResponse: (selectedText: string, messages: { role: 'user' | 'assistant'; content: string }[], command: string, conversationId: string = 'default') => {
        return ipcRenderer.invoke('generate-chat-response', selectedText, messages, command, conversationId)
    },
    stopChatResponse: (conversationId: string = 'default') => {
        return ipcRenderer.invoke('stop-chat-response', conversationId)
    },
    onChatResponseChunk: (callback: (event: any, chunk: { content: string; done: boolean; finishReason?: string; sessionId?: string }) => void) => {
        // Remove all existing listeners first to prevent duplicates
        ipcRenderer.removeAllListeners('chat-response-chunk')
        ipcRenderer.on('chat-response-chunk', callback)
    },
    removeChatResponseChunk: () => {
        ipcRenderer.removeAllListeners('chat-response-chunk')
    },
    sendChatResponseComplete: (message: { role: 'user' | 'assistant'; content: string }) => {
        ipcRenderer.send('chat-response-complete', message)
    },
    onChatResponseComplete: (callback: (event: any, message: { role: 'user' | 'assistant'; content: string }) => void) => {
        ipcRenderer.on('chat-response-complete', callback)
    },
    onChatResponseError: (callback: (event: any, error: string) => void) => {
        // Remove all existing listeners first to prevent duplicates
        ipcRenderer.removeAllListeners('chat-response-error')
        ipcRenderer.on('chat-response-error', callback)
    },
    removeChatResponseError: () => {
        ipcRenderer.removeAllListeners('chat-response-error')
    },
    onFullChatWindowShown: (cb: (info: any) => void) => {
		ipcRenderer.on('full-chat-window-shown', (_event: any, info?: any) => cb(info))
	},
    // Screenshot API
    getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
    captureDesktopScreenshot: () =>
	    ipcRenderer.invoke('capture-desktop-screenshot'),
    
    // Conversation storage APIs
    loadConversation: (conversationId?: string) => ipcRenderer.invoke('load-conversation', conversationId),
    saveMessage: (message: { role: 'user' | 'assistant'; content: string }, conversationId?: string) => 
        ipcRenderer.invoke('save-message', message, conversationId),
    getAllConversations: () => ipcRenderer.invoke('get-all-conversations'),
    clearConversation: (conversationId?: string) => ipcRenderer.invoke('clear-conversation', conversationId),
    deleteConversation: (conversationId: string) => ipcRenderer.invoke('delete-conversation', conversationId),
    openExternalUrl: (url: string) => {
        return ipcRenderer.invoke('open-external-url', url)
    },
    
    // Settings APIs
    getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
    saveSettings: (provider: string, apiKey: string, model?: string) => ipcRenderer.invoke('save-settings', provider, apiKey, model),
    verifyApiKey: (provider: string, apiKey: string, model?: string) => ipcRenderer.invoke('verify-api-key', provider, apiKey, model),
    getAvailableProviders: () => ipcRenderer.invoke('get-available-providers'),
    getProviderModel: (provider: string) => ipcRenderer.invoke('get-provider-model', provider),
    getProviderApiKey: (provider: string) => ipcRenderer.invoke('get-provider-api-key', provider),
    setCurrentProvider: (provider: string) => ipcRenderer.invoke('set-current-provider', provider),
    saveWordSelectionEnabled: (enabled: boolean) => ipcRenderer.invoke('save-word-selection-enabled', enabled),
    saveLanguage: (language: string) => ipcRenderer.invoke('save-language', language),
    getAvailableApps: () => ipcRenderer.invoke('get-available-apps'),
    getDisabledApps: () => ipcRenderer.invoke('get-disabled-apps'),
    addDisabledApp: (app: string) => ipcRenderer.invoke('add-disabled-app', app),
    removeDisabledApp: (app: string) => ipcRenderer.invoke('remove-disabled-app', app),
    getMenuActions: () => ipcRenderer.invoke('get-menu-actions'),
    saveMenuActions: (actions: string[]) => ipcRenderer.invoke('save-menu-actions', actions),
    getCustomActions: () => ipcRenderer.invoke('get-custom-actions'),
    addCustomAction: (action: any) => ipcRenderer.invoke('add-custom-action', action),
    updateCustomAction: (id: string, updated: any) => ipcRenderer.invoke('update-custom-action', id, updated),
    deleteCustomAction: (id: string) => ipcRenderer.invoke('delete-custom-action', id),
    
    // Onboarding APIs
    closeOnboardingWindow: () => ipcRenderer.send('close-onboarding-window'),
    quitApp: () => ipcRenderer.send('quit-app'),
    
    // Settings window APIs
    closeSettingsWindow: () => ipcRenderer.send('close-settings-window'),
    
    // WebPilot window APIs
    closeWebPilotWindow: () => ipcRenderer.send('close-webpilot-window'),
    removeScriptAssociation: (cleanUrl: string) => ipcRenderer.invoke('remove-script-association', cleanUrl),
    saveScript: (cleanUrl: string, script: string, scriptName: string) => ipcRenderer.invoke('save-script', cleanUrl, script, scriptName),
    deleteScriptById: (scriptId: string) => ipcRenderer.invoke('delete-script-by-id', scriptId),
    
    // ASR (Audio Speech Recognition) APIs
    startAudioRecording: (options?: { sampleRate?: number; channels?: number; bitsPerSample?: number }) => 
        ipcRenderer.invoke('start-audio-recording', options),
    stopAudioRecording: () => ipcRenderer.invoke('stop-audio-recording'),
    cancelAudioRecording: () => ipcRenderer.invoke('cancel-audio-recording'),
    appendAudioData: (audioData: ArrayBuffer) => ipcRenderer.invoke('append-audio-data', audioData),
    transcribeAudioFile: (audioPath: string) => ipcRenderer.invoke('transcribe-audio-file', audioPath),
    transcribeAudioBuffer: (audioData: ArrayBuffer) => ipcRenderer.invoke('transcribe-audio-buffer', audioData),
    initializeAsr: () => ipcRenderer.invoke('initialize-asr'),
    checkAsrReady: () => ipcRenderer.invoke('check-asr-ready'),
    checkModelExists: () => ipcRenderer.invoke('check-model-exists'),
    onTranscriptionResult: (callback: (event: any, result: { text: string; segments?: Array<{ start: number; end: number; text: string }> }) => void) => {
        ipcRenderer.removeAllListeners('transcription-result')
        ipcRenderer.on('transcription-result', callback)
    },
    onTranscriptionError: (callback: (event: any, error: string) => void) => {
        ipcRenderer.removeAllListeners('transcription-error')
        ipcRenderer.on('transcription-error', callback)
    },
})

export { }
