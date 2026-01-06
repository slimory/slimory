import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sourceFile = path.join(__dirname, '..', 'src', 'renderer', 'audio-processor.worklet.js')
const destDir = path.join(__dirname, '..', 'dist')
const destFile = path.join(destDir, 'audio-processor.worklet.js')

// Create dist directory if it doesn't exist
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
}

// Copy worklet file
if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, destFile)
    console.log(`✅ Copied: audio-processor.worklet.js`)
} else {
    console.error(`❌ Source file not found: ${sourceFile}`)
    process.exit(1)
}

console.log('✅ Worklet file copied successfully')

