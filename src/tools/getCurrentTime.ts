import { Tool, ToolResult } from './types'

/**
 * Tool to get the current precise date and time
 * Use this tool only when you need to know the exact current time (with seconds or milliseconds precision).
 * For general date information, use the date context provided in the system prompt.
 */
export class GetCurrentTimeTool implements Tool {
    name = 'get_current_time'
    description = 'Get the current precise date and time information. Use this tool only when you need to know the exact current time with seconds or milliseconds precision. For general date information, the system prompt already provides the current date.'
    
    parameters = {
        type: 'object' as const,
        properties: {
            format: {
                type: 'string',
                description: 'The format of the time to return. Options: "iso" (ISO 8601 format with milliseconds), "datetime" (readable date and time), "time" (time only with seconds), or "all" (all formats). Default: "all".'
            },
            timezone: {
                type: 'string',
                description: 'Timezone for the time (e.g., "UTC", "Asia/Shanghai"). Default: local timezone.'
            }
        },
        required: []
    }

    async execute(params: Record<string, any>, _onStatusUpdate?: (status: 'start' | 'processing' | 'end', message: string) => boolean, _currentLang: string = 'zh', _messages?: Array<{ role: string; content: string }>, _conversationId?: string): Promise<ToolResult> {
        const { format = 'all', timezone } = params

        try {
            const now = new Date()
            
            // Get time in specified timezone or local time
            let dateTime: Date
            if (timezone && timezone !== 'local') {
                // For timezone conversion, we'll use the local time but format it according to timezone
                // Note: Full timezone support would require a library like date-fns-tz
                dateTime = now
            } else {
                dateTime = now
            }

            const currentDate = dateTime.toISOString().split('T')[0] // YYYY-MM-DD
            const currentTime = dateTime.toTimeString().split(' ')[0] // HH:MM:SS
            const currentDateTime = dateTime.toISOString() // Full ISO string
            const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateTime.getDay()]
            const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][dateTime.getMonth()]
            
            let result: any = {}

            if (format === 'iso' || format === 'all') {
                result.iso = currentDateTime
            }
            if (format === 'datetime' || format === 'all') {
                result.datetime = `${currentDate} ${currentTime}`
                result.readable = `${dayOfWeek}, ${monthName} ${dateTime.getDate()}, ${dateTime.getFullYear()} ${currentTime}`
            }
            if (format === 'time' || format === 'all') {
                result.time = currentTime
            }
            if (format === 'all') {
                result.date = currentDate
                result.dayOfWeek = dayOfWeek
                result.monthName = monthName
                result.year = dateTime.getFullYear()
                result.month = dateTime.getMonth() + 1
                result.day = dateTime.getDate()
                result.hour = dateTime.getHours()
                result.minute = dateTime.getMinutes()
                result.second = dateTime.getSeconds()
                result.millisecond = dateTime.getMilliseconds()
                result.timestamp = dateTime.getTime()
            }

            return {
                success: true,
                data: result
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }
}

