/// <reference types="vite/client" />

declare module '*.svg' {
    const content: string
    export default content
}

interface Window {
    electronAPI: {
        onShowMenu: (callback: (event: any, data: any) => void) => void
        onHideMenu: (callback: () => void) => void
        sendMenuAction: (action: string, text: string) => void
        hideMenu: () => void
        openChatWindow: (selectedText: string) => void
        resizeForChat: () => void
        resizeForMenu: () => void
        // Chat window APIs
        onShowChat: (callback: (event: any, text: string) => void) => void
        closeChatWindow: () => void
        // Full chat window APIs
        closeFullChatWindow: () => void
        minimizeFullChatWindow: () => void
        setFullChatWindowIgnoreMouse?: (ignore: boolean, forward?: boolean) => void
        // Generic window ignore mouse API
        setWindowIgnoreMouse?: (windowName: string, ignore: boolean, forward?: boolean) => void
        // Message window APIs
        onShowMessage: (callback: (event: any, messages: { role: 'user' | 'assistant'; content: string }[], selectedText: string, isNewSession: boolean, command: string, direction: string, sessionId?: string) => void) => void
        onHideMessage: (callback: (event: any) => void) => void
        onShowToast: (callback: (event: any, message: string) => void) => void
        onHideFullChatWindow: (callback: () => void) => void
        closeMessageWindow: () => void
        openMessageWindow: (messages: { role: 'user' | 'assistant'; content: string }[], selectedText: string, command: string) => void
        // Language APIs
        getLanguage: () => Promise<string>
        onLanguageUpdated: (callback: (event: any, language: string) => void) => void
        // Chat service APIs
        generateChatResponse: (selectedText: string, messages: { role: 'user' | 'assistant'; content: string }[], command: string, conversationId?: string) => Promise<{ success: boolean }>
        stopChatResponse: (conversationId?: string) => Promise<{ success: boolean; error?: string }>
        onChatResponseChunk: (callback: (event: any, chunk: { content: string; done: boolean; finishReason?: string; sessionId?: string }) => void) => void
        sendChatResponseComplete: (message: { role: 'user' | 'assistant'; content: string }) => void
        onChatResponseComplete: (callback: (event: any, message: { role: 'user' | 'assistant'; content: string }) => void) => void
        onChatResponseError: (callback: (event: any, error: string) => void) => void
        onFullChatWindowShown: (cb: (info: any) => void) => void
        onWindowMoved: (callback: (event: any, windowName: string, status: string) => void) => void
        captureDesktopScreenshot: () => Promise<{ success: boolean; screenshot: string; screenWidth: number; screenHeight: number; scaleFactor: number; brightness: number }>
        getWindowBounds: () => Promise<{ bounds: Electron.Rectangle; scaleFactor: number; screenWidth: number; screenHeight: number }>
        // Conversation storage APIs
        loadConversation: (conversationId?: string) => Promise<{ success: boolean; messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number; resources?: Array<{ index: number; url: string; title?: string; source?: string }>; originalMessages?: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_calls?: any[]; tool_call_id?: string }> }>; isStreaming: boolean; error?: string; streamingContent?: string }>
        saveMessage: (message: { role: 'user' | 'assistant'; content: string; resources?: Array<{ index: number; url: string; title?: string; source?: string }> }, conversationId?: string) => Promise<{ success: boolean; error?: string }>
        getAllConversations: () => Promise<{ success: boolean; conversations: Array<any>; error?: string }>
        clearConversation: (conversationId?: string) => Promise<{ success: boolean; error?: string }>
        deleteConversation: (conversationId: string) => Promise<{ success: boolean; error?: string }>
        openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
        // Settings APIs
        getAllSettings: () => Promise<{ success: boolean; hasSettings: boolean; settings?: { provider: string; baseUrl: string; model: string; language?: string; wordSelectionEnabled?: boolean; menuActions?: string[] }; error?: string }>
        saveSettings: (provider: string, apiKey: string, model?: string) => Promise<{ success: boolean; error?: string }>
        verifyApiKey: (provider: string, apiKey: string, model?: string) => Promise<{ success: boolean; error?: string }>
        getAvailableProviders: () => Promise<{ success: boolean; providers: Array<{ provider: string; providerName: string; baseUrl: string; model: string }>; error?: string }>
        getProviderModel: (provider: string) => Promise<{ success: boolean; model: string | null; error?: string }>
        getProviderApiKey: (provider: string) => Promise<{ success: boolean; apiKey: string | null; error?: string }>
        setCurrentProvider: (provider: string) => Promise<{ success: boolean; error?: string }>
        getProviderReasoningEffort: (provider: string) => Promise<{ success: boolean; effort: string; error?: string }>
        saveProviderReasoningEffort: (provider: string, effort: string) => Promise<{ success: boolean; error?: string }>
        getProviderModels: (provider: string) => Promise<{ success: boolean; models: Array<{ id: string; name: string }>; error?: string }>
        saveWordSelectionEnabled: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
        saveRequireCtrlForMenu: (requireCtrl: boolean) => Promise<{ success: boolean; error?: string }>
        getRequireCtrlForMenu: () => Promise<{ success: boolean; requireCtrl: boolean; error?: string }>
        getAutoCopyGenerated: () => Promise<{ success: boolean; autoCopy: boolean; error?: string }>
        saveAutoCopyGenerated: (autoCopy: boolean) => Promise<{ success: boolean; error?: string }>
        saveLanguage: (language: string) => Promise<{ success: boolean; error?: string }>
        getAvailableApps: () => Promise<{ success: boolean; apps: Array<{ name: string; displayName: string }>; error?: string }>
        getDisabledApps: () => Promise<{ success: boolean; apps: Array<{ name: string; displayName: string }>; error?: string }>
        addDisabledApp: (app: string) => Promise<{ success: boolean; error?: string }>
        removeDisabledApp: (app: string) => Promise<{ success: boolean; error?: string }>
        getMenuActions: () => Promise<{ success: boolean; actions: string[]; error?: string }>
        saveMenuActions: (actions: string[]) => Promise<{ success: boolean; error?: string }>
        getCustomActions: () => Promise<{ success: boolean; actions: Array<{ id: string; name: string; prompt: string; icon?: string; canEdit?: boolean }>; error?: string }>
        addCustomAction: (action: { id: string; name: string; prompt: string; icon?: string; canEdit?: boolean }) => Promise<{ success: boolean; error?: string }>
        updateCustomAction: (id: string, updated: { name?: string; prompt?: string; icon?: string; canEdit?: boolean }) => Promise<{ success: boolean; error?: string }>
        deleteCustomAction: (id: string) => Promise<{ success: boolean; error?: string }>
        closeOnboardingWindow: () => void
        quitApp: () => void
        // Settings window APIs
        closeSettingsWindow: () => void
        // ASR (Audio Speech Recognition) APIs
        startAudioRecording: (options?: { sampleRate?: number; channels?: number; bitsPerSample?: number }) => Promise<{ success: boolean; path?: string; error?: string }>
        stopAudioRecording: () => Promise<{ success: boolean; path?: string; error?: string }>
        cancelAudioRecording: () => Promise<{ success: boolean; error?: string }>
        appendAudioData: (audioData: ArrayBuffer) => Promise<{ success: boolean; error?: string }>
        transcribeAudioFile: (audioPath: string) => Promise<{ success: boolean; result?: { text: string; segments?: Array<{ start: number; end: number; text: string }> }; error?: string }>
        transcribeAudioBuffer: (audioData: ArrayBuffer | Float32Array) => Promise<{ success: boolean; result?: { text: string; segments?: Array<{ start: number; end: number; text: string }> }; error?: string }>
        initializeAsr: () => Promise<{ success: boolean; ready?: boolean; error?: string }>
        checkAsrReady: () => Promise<{ ready: boolean }>
        checkModelExists: () => Promise<{ exists: boolean; path?: string }>
        onTranscriptionResult: (callback: (event: any, result: { text: string; segments?: Array<{ start: number; end: number; text: string }> }) => void) => void
        onTranscriptionError: (callback: (event: any, error: string) => void) => void
    }
}

