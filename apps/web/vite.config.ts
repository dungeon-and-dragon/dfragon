import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { desktopNotices, uiNotices } from '@dfragon/licenses/vite'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { unplugin as stylex } from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig, type Plugin } from 'vite'
import { workspaceAliases } from './workspace-aliases.ts'

const siteNotices = {
  name: 'site-notices',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'notices/site/NOTICE.md',
      source: readFileSync(fileURLToPath(new URL('./NOTICE.md', import.meta.url)), 'utf8')
    })
  }
} satisfies Plugin

// 개발 서버는 같은 origin 경로를 운영 API로 넘겨, 운영 API의 CORS 허용 origin 없이 웹 앱을 연다.
const DEV_API_PROXY = { target: 'https://api.dfragon.com', changeOrigin: true }

export default defineConfig({
  plugins: [stylex.vite(stylexOptions), react(), uiNotices(), desktopNotices(), siteNotices],
  worker: { format: 'es' },
  resolve: {
    alias: workspaceAliases,
    dedupe: ['react', 'react-dom'],
    // onnxruntime-web의 기본 번들은 WASM을 import.meta.url 기준으로도 참조해 Vite가 같은 WASM을 assets에 한 벌 더
    // 내보낸다. OCR worker는 wasmPaths로 public/ocr의 사본만 읽으므로, 그 참조가 없는 extern WASM 빌드를 고른다.
    conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions]
  },
  server: { proxy: { '/characters': DEV_API_PROXY, '/items': DEV_API_PROXY } }
})
