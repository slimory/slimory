import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { matchCleanUrls } from '../tools/webPilot/urlUtils'

export interface ScriptEntry {
    scriptId: string
    scriptName: string
    script: string
    cleanUrls: string[]
}

export class ScriptStorage {
    private scriptsFile: string

    constructor() {
        // Use Electron's userData directory for storing scripts
        const storageDir = app.getPath('userData')
        this.scriptsFile = path.join(storageDir, 'scripts.json')
        
        // Ensure storage directory exists
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true })
        }
    }

    /**
     * Generate a unique script ID
     */
    private generateScriptId(): string {
        return `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * Load all scripts from file
     */
    private loadAllScripts(): ScriptEntry[] {
        try {
            if (!fs.existsSync(this.scriptsFile)) {
                return []
            }

            const data = fs.readFileSync(this.scriptsFile, 'utf-8')
            const parsed = JSON.parse(data)
            
            // Migrate old format to new format if needed
            if (parsed && !Array.isArray(parsed)) {
                // Old format: Record<string, {script: string, cleanUrl: string}>
                const migrated: ScriptEntry[] = []
                for (const [cleanUrl, entry] of Object.entries(parsed)) {
                    if (entry && typeof entry === 'object' && 'script' in entry) {
                        migrated.push({
                            scriptId: this.generateScriptId(),
                            scriptName: cleanUrl,
                            script: (entry as any).script,
                            cleanUrls: [cleanUrl]
                        })
                    }
                }
                return migrated
            }
            
            // Ensure all entries have scriptName field (migration for existing entries)
            if (Array.isArray(parsed)) {
                return parsed.map(entry => {
                    if (!entry.scriptName) {
                        entry.scriptName = entry.cleanUrls[0] || '未命名脚本'
                    }
                    return entry
                })
            }
            
            return Array.isArray(parsed) ? parsed : []
        } catch (error) {
            console.error('Error loading scripts:', error)
            return []
        }
    }

    /**
     * Save all scripts to file
     */
    private saveAllScripts(scripts: ScriptEntry[]): boolean {
        try {
            fs.writeFileSync(this.scriptsFile, JSON.stringify(scripts, null, 2), 'utf-8')
            return true
        } catch (error) {
            console.error('Error saving scripts:', error)
            return false
        }
    }

    /**
     * Save script for a Clean URL
     * If a matching script exists, adds the cleanUrl to its cleanUrls array
     * If no matching script exists, creates a new entry
     * Before adding, removes the cleanUrl from any existing script entry
     */
    saveScript(cleanUrl: string | null, script: string, name: string): boolean {
        try {
            const scripts = this.loadAllScripts()

            if (!cleanUrl) {
                scripts.push({
                    scriptId: this.generateScriptId(),
                    scriptName: name || 'unnamed script',
                    script: script,
                    cleanUrls: []
                })
                return this.saveAllScripts(scripts)
            }
            
            // First, remove cleanUrl from any existing script entry
            for (let i = scripts.length - 1; i >= 0; i--) {
                const entry = scripts[i]
                const urlIndex = entry.cleanUrls.indexOf(cleanUrl)
                
                if (urlIndex !== -1) {
                    entry.cleanUrls.splice(urlIndex, 1)
                    break
                }
            }
            
            // Find if there's a script with the same content
            const existingScriptIndex = scripts.findIndex(entry => entry.script === script)
            
            if (existingScriptIndex !== -1) {
                // Script exists, add cleanUrl to its cleanUrls array
                const entry = scripts[existingScriptIndex]
                entry.cleanUrls.push(cleanUrl)
            } else {
                // Create new script entry
                scripts.push({
                    scriptId: this.generateScriptId(),
                    scriptName: name || cleanUrl,
                    script: script,
                    cleanUrls: [cleanUrl]
                })
            }
            
            return this.saveAllScripts(scripts)
        } catch (error) {
            console.error('Error saving script:', error)
            return false
        }
    }

    /**
     * Get script for a Clean URL
     */
    getScript(cleanUrl: string): string | null {
        try {
            const scripts = this.loadAllScripts()
            const entry = scripts.find(e => e.cleanUrls.includes(cleanUrl))
            return entry ? entry.script : null
        } catch (error) {
            console.error('Error getting script:', error)
            return null
        }
    }

    /**
     * Get all saved scripts
     * Returns a list of script entries
     */
    getAllScripts(): ScriptEntry[] {
        try {
            return this.loadAllScripts()
        } catch (error) {
            console.error('Error getting all scripts:', error)
            return []
        }
    }

    /**
     * Delete script for a Clean URL
     * Removes the cleanUrl from the script's cleanUrls array
     * If the script has no more cleanUrls, removes the entire entry
     */
    deleteScript(cleanUrl: string): boolean {
        try {
            const scripts = this.loadAllScripts()
            let modified = false
            
            for (let i = scripts.length - 1; i >= 0; i--) {
                const entry = scripts[i]
                const urlIndex = entry.cleanUrls.indexOf(cleanUrl)
                
                if (urlIndex !== -1) {
                    entry.cleanUrls.splice(urlIndex, 1)
                    modified = true
                    
                    // If no more cleanUrls, remove the entire entry
                    if (entry.cleanUrls.length === 0) {
                        scripts.splice(i, 1)
                    }
                    break
                }
            }
            
            return modified ? this.saveAllScripts(scripts) : true
        } catch (error) {
            console.error('Error deleting script:', error)
            return false
        }
    }

    /**
     * Remove cleanUrl association from script
     * This is used when clearing the effect for a specific URL
     */
    removeCleanUrlAssociation(cleanUrl: string): boolean {
        const scripts = this.loadAllScripts()
        let matchedUrl = ''
        let shouldBreak = false
        for (const entry of scripts) {
            for (const savedCleanUrl of entry.cleanUrls) {
                if (matchCleanUrls(cleanUrl, savedCleanUrl)) {
                    matchedUrl = savedCleanUrl
                    shouldBreak = true
                    break
                }
            }
            if (shouldBreak) break;
        }
        // First, remove matchedUrl from any existing script entry
        for (let i = scripts.length - 1; i >= 0; i--) {
            const entry = scripts[i]
            const urlIndex = entry.cleanUrls.indexOf(matchedUrl)
            
            if (urlIndex !== -1) {
                entry.cleanUrls.splice(urlIndex, 1)
                this.saveAllScripts(scripts)
                return true
            }
        }
        return false
    }

    /**
     * Delete a script entry by scriptId
     * Removes the entire script entry from storage
     */
    deleteScriptById(scriptId: string): boolean {
        try {
            const scripts = this.loadAllScripts()
            const index = scripts.findIndex(entry => entry.scriptId === scriptId)
            
            if (index !== -1) {
                scripts.splice(index, 1)
                return this.saveAllScripts(scripts)
            }
            
            return false
        } catch (error) {
            console.error('Error deleting script by ID:', error)
            return false
        }
    }

    /**
     * Find matching script using matching algorithm
     * Matches if parent path is the same
     */
    findMatchingScript(currentCleanUrl: string, inMatchCleanUrls: (url1: string, url2: string) => boolean = matchCleanUrls): { cleanUrl: string, script: string } | null {
        try {
            const scripts = this.loadAllScripts()
            
            for (const entry of scripts) {
                for (const savedCleanUrl of entry.cleanUrls) {
                    if (inMatchCleanUrls(currentCleanUrl, savedCleanUrl)) {
                        return {
                            cleanUrl: savedCleanUrl,
                            script: entry.script
                        }
                    }
                }
            }
            
            return null
        } catch (error) {
            console.error('Error finding matching script:', error)
            return null
        }
    }
}

