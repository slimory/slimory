import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
    base: './',
    root: 'src/renderer', // 设置根目录为 src/renderer
    plugins: [
        react(),
        electron([
            {
                entry: '../../src/main/main.ts',
                onstart(options) {
                    //options.startup()
                },
                vite: {
                    build: {
                        outDir: '../../dist-electron/main',
                        rollupOptions: {
                            external: (id) => {
                                // Externalize electron and native modules
                                if (id === 'electron' || id === 'uiohook-napi') {
                                    return true
                                }
                                // Externalize @xenova/transformers and its dependencies
                                if (id.startsWith('@xenova/transformers') ||
                                    id.startsWith('onnxruntime')) {
                                    return true
                                }
                                // Externalize pi-ai and its provider SDKs (Node.js ESM modules)
                                if (id.startsWith('@earendil-works/pi-ai') ||
                                    id.startsWith('@anthropic-ai/') ||
                                    id.startsWith('@mistralai/') ||
                                    id.startsWith('@google/') ||
                                    id.startsWith('openai') ||
                                    id.startsWith('@opentelemetry/') ||
                                    id.startsWith('@aws-sdk/') ||
                                    id === 'typebox' ||
                                    id.startsWith('partial-json')) {
                                    return true
                                }
                                // Externalize any .node files (native modules)
                                if (id.endsWith('.node')) {
                                    return true
                                }
                                return false
                            },
                            output: {
                                format: 'cjs'
                            }
                        },
                        commonjsOptions: {
                            transformMixedEsModules: true,
                            ignoreDynamicRequires: true
                        }
                    }
                }
            },
            {
                entry: '../../src/preload/preload.ts',
                onstart(options) {
                    options.reload()
                },
                vite: {
                    build: {
                        outDir: '../../dist-electron/preload',
                        rollupOptions: {
                            output: {
                                format: 'cjs'
                            }
                        }
                    }
                }
            }
        ]),
        renderer()
    ],
    server: {
        port: 5174,
        host: '127.0.0.1', // 明确绑定到 127.0.0.1，避免 VPN TUN 模式下的 localhost 路由问题
        strictPort: true
    },
    build: {
        outDir: '../../dist', // 相对于 src/renderer 的输出目录
        emptyOutDir: true,
        rollupOptions: {
            input: {
                menu: path.resolve(__dirname, 'src/renderer/menu.html'),
                chat: path.resolve(__dirname, 'src/renderer/chat.html'),
                message: path.resolve(__dirname, 'src/renderer/message.html'),
                fullChat: path.resolve(__dirname, 'src/renderer/fullChat.html'),
                onboarding: path.resolve(__dirname, 'src/renderer/onboarding.html'),
                settings: path.resolve(__dirname, 'src/renderer/settings.html')
            },
            output: {
                // Ensure worklet files are copied as-is
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name && assetInfo.name.endsWith('.worklet.js')) {
                        return '[name][extname]'
                    }
                    return 'assets/[name]-[hash][extname]'
                }
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    }
})

