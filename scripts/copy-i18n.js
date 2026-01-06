import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Copy i18n locales folder to dist-electron/renderer/i18n/locales
const sourceDir = path.join(__dirname, '..', 'src', 'renderer', 'i18n', 'locales')
const targetDir = path.join(__dirname, '..', 'dist-electron', 'renderer', 'i18n', 'locales')

try {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
    }

    // Copy all JSON files from source to target
    const files = fs.readdirSync(sourceDir)
    for (const file of files) {
        if (file.endsWith('.json')) {
            const sourceFile = path.join(sourceDir, file)
            const targetFile = path.join(targetDir, file)
            
            if (fs.statSync(sourceFile).isFile()) {
                fs.copyFileSync(sourceFile, targetFile)
                console.log(`✅ Copied i18n: ${file}`)
            }
        }
    }
    
    console.log('✅ i18n locales folder copied successfully')
} catch (error) {
    console.error('❌ Error copying i18n locales folder:', error)
    process.exit(1)
}

