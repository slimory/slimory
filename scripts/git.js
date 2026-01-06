import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import readline from 'readline'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env.dev file
const loadEnvFile = (filePath) => {
    const envVars = {}
    
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8')
            const lines = content.split('\n')
            
            for (const line of lines) {
                const trimmedLine = line.trim()
                
                // Skip empty lines and comments
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                    continue
                }
                
                // Parse KEY=VALUE format
                const equalIndex = trimmedLine.indexOf('=')
                if (equalIndex > 0) {
                    const key = trimmedLine.substring(0, equalIndex).trim()
                    const value = trimmedLine.substring(equalIndex + 1).trim()
                    
                    // Remove quotes if present
                    const cleanValue = value.replace(/^["']|["']$/g, '')
                    envVars[key] = cleanValue
                }
            }
        }
    } catch (error) {
        console.warn(`Failed to load environment file ${filePath}:`, error)
    }
    
    return envVars
}

// Get API key from .env.dev or environment variables
const getApiKey = () => {
    const projectRoot = process.cwd()
    const envDevPath = path.join(projectRoot, '.env.dev')
    const envDevVars = loadEnvFile(envDevPath)
    
    // Check .env.dev first, then fallback to environment variables
    return envDevVars.OPENAI_API_KEY || 
            envDevVars.DEEPSEEK_API_KEY ||
            envDevVars.GLM_API_KEY || 
            process.env.OPENAI_API_KEY || 
            process.env.DEEPSEEK_API_KEY ||
            process.env.GLM_API_KEY || 
            ''
}

// Call DeepSeek API to generate commit message
const generateCommitMessage = async (filePath, status, diff) => {
    const apiKey = getApiKey()
    
    if (!apiKey) {
        throw new Error('API key not found. Please set OPENAI_API_KEY, DEEPSEEK_API_KEY, or GLM_API_KEY in .env.dev or environment variables.')
    }

    const baseUrl = 'https://api.deepseek.com'
    const model = 'deepseek-chat'

    const prompt = `Generate a standard git commit message for the following file changes.

File path: ${filePath}
Change status: ${status}
File diff:
${diff}

Requirements:
1. Use standard commit message format (type: subject)
2. Type can be: feat, fix, docs, style, refactor, perf, test, chore, build, ci
3. Use English description, concise and clear
4. Return only the commit message, no additional explanations
5. If the file is deleted, mention it in the message
6. If the file is newly added, mention it in the message

Examples:
- feat: add git commit message generator script
- fix: update API key loading logic
- refactor: improve error handling in chat service
- docs: update installation instructions
- style: format code with prettier
- test: add unit tests for helper functions
- chore: update dependencies to latest versions
- perf: optimize database query performance
- build: add GitHub Actions workflow
- fix: remove unused import statement
- feat: add new user authentication component
- refactor: extract common logic into utility function
- fix: handle edge case in error response
- docs: add JSDoc comments to public methods

Commit message:`

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional git commit message generator. Return only the commit message in English, no additional explanations or extra text.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 200
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`API error: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        const message = data.choices?.[0]?.message?.content?.trim() || ''
        
        // Remove markdown code blocks if present
        return message.replace(/^```[\s\S]*?\n/, '').replace(/\n```$/, '').trim()
    } catch (error) {
        throw new Error(`Failed to generate commit message: ${error.message}`)
    }
}

// Get git diff for a file
const getFileDiff = (filePath) => {
    // Escape file path for shell commands
    const escapedPath = filePath.replace(/"/g, '\\"')
    
    try {
        // Try git diff HEAD first (for modified/deleted files)
        try {
            const diff = execSync(`git diff HEAD -- "${escapedPath}"`, { 
                encoding: 'utf-8', 
                stdio: 'pipe',
                shell: true,
                cwd: process.cwd()
            })
            if (diff.trim()) return diff
        } catch (e) {
            // Ignore and try next method
        }
        
        // Try git diff --cached (for staged files)
        try {
            const diff = execSync(`git diff --cached -- "${escapedPath}"`, { 
                encoding: 'utf-8', 
                stdio: 'pipe',
                shell: true,
                cwd: process.cwd()
            })
            if (diff.trim()) return diff
        } catch (e) {
            // Ignore and try next method
        }
        
        // Try git diff (for unstaged files)
        try {
            const diff = execSync(`git diff -- "${escapedPath}"`, { 
                encoding: 'utf-8', 
                stdio: 'pipe',
                shell: true,
                cwd: process.cwd()
            })
            if (diff.trim()) return diff
        } catch (e) {
            // Ignore
        }
        
        // For new files, try to get file content
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8')
                return `new file\n${content.substring(0, 1000)}`
            } catch (e) {
                return 'new file (unable to read content)'
            }
        }
        
        return 'deleted file'
    } catch (error) {
        return `unable to get diff: ${error.message}`
    }
}

// Get all changed files (modified, deleted, added)
const getChangedFiles = () => {
    const files = []
    
    try {
        const fileMap = new Map()
        
        // Get modified and deleted files (compared to HEAD)
        try {
            execSync('git diff --name-status HEAD', { 
                encoding: 'utf-8',
                stdio: 'pipe',
                shell: true,
                cwd: process.cwd()
            })
                .split('\n')
                .filter(line => line.trim())
                .forEach(line => {
                    const [status, ...fileParts] = line.split('\t')
                    const filePath = fileParts.join('\t')
                    if (filePath) {
                        const statusCode = status.charAt(0)
                        fileMap.set(filePath, statusCode === 'M' ? 'modified' : statusCode === 'D' ? 'deleted' : 'added')
                    }
                })
        } catch (e) {
            // No HEAD or no changes, continue
        }
        
        // Get staged files
        try {
            execSync('git diff --cached --name-status', { 
                encoding: 'utf-8',
                stdio: 'pipe',
                shell: true,
                cwd: process.cwd()
            })
                .split('\n')
                .filter(line => line.trim())
                .forEach(line => {
                    const [status, ...fileParts] = line.split('\t')
                    const filePath = fileParts.join('\t')
                    if (filePath) {
                        fileMap.set(filePath, 'added')
                    }
                })
        } catch (e) {
            // No staged files, continue
        }
        
        // Get untracked files
        try {
            execSync('git ls-files --others --exclude-standard', { 
                encoding: 'utf-8',
                stdio: 'pipe',
                shell: true,
                cwd: process.cwd()
            })
                .split('\n')
                .filter(line => line.trim())
                .forEach(filePath => {
                    if (filePath && !fileMap.has(filePath)) {
                        fileMap.set(filePath, 'added')
                    }
                })
        } catch (e) {
            // Ignore errors
        }
        
        return Array.from(fileMap.entries()).map(([path, status]) => ({
            path,
            status
        }))
    } catch (error) {
        console.error('Error getting changed files:', error.message)
        return []
    }
}

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

// Prompt user for input
const promptUser = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer)
        })
    })
}

// Execute git commands
const executeGitCommands = async (filePath, message) => {
    try {
        console.log(`\nExecuting git add "${filePath}"...`)
        // Use spawn-like approach with proper escaping for Windows
        execSync(`git add "${filePath.replace(/"/g, '\\"')}"`, { 
            stdio: 'inherit',
            shell: true,
            cwd: process.cwd()
        })
        
        console.log(`Executing git commit -m "${message}"...`)
        // Use JSON.stringify to properly escape the message
        const commitCommand = `git commit -m ${JSON.stringify(message)}`
        execSync(commitCommand, { 
            stdio: 'inherit',
            shell: true,
            cwd: process.cwd()
        })
        
        console.log('Executing git push...')
        execSync('git push', { 
            stdio: 'inherit',
            shell: true,
            cwd: process.cwd()
        })
        
        console.log('✅ Commit successful!\n')
    } catch (error) {
        console.error('❌ Git operation failed:', error.message)
        throw error
    }
}

// Main function
const main = async () => {
    console.log('🔍 Finding changed files...\n')
    
    const changedFiles = getChangedFiles()
    
    if (changedFiles.length === 0) {
        console.log('No changed files found.')
        rl.close()
        return
    }
    
    console.log(`Found ${changedFiles.length} changed file(s):\n`)
    changedFiles.forEach((file, index) => {
        console.log(`${index + 1}. [${file.status}] ${file.path}`)
    })
    console.log('')
    
    // Process each file
    for (let i = 0; i < changedFiles.length; i++) {
        const file = changedFiles[i]
        console.log(`\n${'='.repeat(60)}`)
        console.log(`Processing file ${i + 1}/${changedFiles.length}: ${file.path}`)
        console.log(`Status: ${file.status}`)
        console.log('='.repeat(60))
        
        try {
            // Get file diff
            const diff = getFileDiff(file.path)
            const diffPreview = diff.substring(0, 2000) // Limit diff size for API
            
            // Generate commit message
            console.log('\n🤖 Generating commit message...')
            const generatedMessage = await generateCommitMessage(file.path, file.status, diffPreview)
            
            console.log(`\nGenerated commit message:`)
            console.log(`"${generatedMessage}"`)
            
            // Prompt user
            const userInput = await promptUser('\nPress Enter to use this message, or enter a new message: ')
            
            const finalMessage = userInput.trim() || generatedMessage
            
            if (!finalMessage) {
                console.log('⚠️  Message is empty, skipping this file.')
                continue
            }
            
            // Execute git commands
            await executeGitCommands(file.path, finalMessage)
            
        } catch (error) {
            console.error(`\n❌ Error processing file ${file.path}:`, error.message)
            const continueProcessing = await promptUser('\nContinue processing next file? (y/n): ')
            if (continueProcessing.toLowerCase() !== 'y') {
                break
            }
        }
    }
    
    console.log('\n✅ All files processed!')
    rl.close()
}

// Run main function
main().catch((error) => {
    console.error('❌ Script execution failed:', error)
    rl.close()
    process.exit(1)
})

