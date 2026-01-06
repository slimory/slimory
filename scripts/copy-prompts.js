import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Copy prompts folder to dist-electron
const sourceDir = path.join(__dirname, '..', 'src', 'prompts')
const targetDir = path.join(__dirname, '..', 'dist-electron', 'prompts')

try {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
    }

    // Copy all files from source to target
    const files = fs.readdirSync(sourceDir)
    for (const file of files) {
        const sourceFile = path.join(sourceDir, file)
        const targetFile = path.join(targetDir, file)
        
        if (fs.statSync(sourceFile).isFile()) {
            fs.copyFileSync(sourceFile, targetFile)
            console.log(`Copied: ${file}`)
        }
    }
    
    console.log('✅ Prompts folder copied successfully')
} catch (error) {
    console.error('❌ Error copying prompts folder:', error)
    process.exit(1)
}
