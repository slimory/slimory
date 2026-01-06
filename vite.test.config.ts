import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
    base: './',
    root: path.resolve(__dirname, 'scripts/tests'),
    plugins: [
        electron([
            {
                entry: './testOperationGenerator.ts',
                onstart() {
                    // No-op for test builds
                },
                vite: {
                    build: {
                        outDir: '../../dist-electron/scripts/tests',
                        rollupOptions: {
                            external: ['electron', 'uiohook-napi'],
                            output: {
                                format: 'cjs'
                            }
                        }
                    }
                }
            }
        ])
    ]
})

