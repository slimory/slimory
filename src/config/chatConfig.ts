// Chat service configuration
// This file can be modified to change the API provider settings

import { getApiKey, getBaseUrl, getModel } from './envLoader'

export interface ChatConfig {
    baseUrl: string
    apiKey: string
    model?: string
}

// Mainly used for testing AI features in development mode
export const chatConfig: ChatConfig = {
    baseUrl: getBaseUrl('https://api.deepseek.com'),
    apiKey: getApiKey(),
    model: getModel('deepseek-chat')
}
