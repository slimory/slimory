import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create package.json in dist-electron/src/tools
const targetDir = path.join(__dirname, '..', 'dist-electron', 'src', 'tools')
const packageJsonPath = path.join(targetDir, 'package.json')

const packageJson = {
  "type": "module",
  "main": "./index.js",
  "exports": {
    ".": "./index.js"
  }
}

// Ensure directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

// Write package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8')
console.log(`Created: ${packageJsonPath}`)