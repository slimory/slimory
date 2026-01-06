import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Copy webPilot scripts folder to dist-electron
const sourceDir = path.join(__dirname, '..', 'src', 'tools', 'webPilot', 'scripts')
const targetDir = path.join(__dirname, '..', 'dist-electron', 'tools', 'webPilot', 'scripts')

// Also copy the common operations.json file
const commonSourceFile = path.join(__dirname, '..', 'src', 'tools', 'webPilot', 'scripts', 'operations.json')
const commonTargetFile = path.join(__dirname, '..', 'dist-electron', 'tools', 'webPilot', 'scripts', 'operations.json')

function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
    }

    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath)
        } else {
            fs.copyFileSync(srcPath, destPath)
            console.log(`Copied: ${path.relative(sourceDir, srcPath)}`)
        }
    }
}

try {
    if (!fs.existsSync(sourceDir)) {
        console.warn(`⚠️  Source directory not found: ${sourceDir}`)
        process.exit(0)
    }

    copyDirectory(sourceDir, targetDir)
    
    // Copy common operations.json if it exists (it should already be copied by copyDirectory, but ensure it's there)
    if (fs.existsSync(commonSourceFile)) {
        const targetDirForCommon = path.dirname(commonTargetFile)
        if (!fs.existsSync(targetDirForCommon)) {
            fs.mkdirSync(targetDirForCommon, { recursive: true })
        }
        if (!fs.existsSync(commonTargetFile)) {
            fs.copyFileSync(commonSourceFile, commonTargetFile)
            console.log('Copied: operations.json')
        }
    }
    
    console.log('✅ WebPilot scripts folder copied successfully')
} catch (error) {
    console.error('❌ Error copying webPilot scripts folder:', error)
    process.exit(1)
}

