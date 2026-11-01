import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { desktopNotices, uiNotices } from '@dfragon/licenses/vite'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { unplugin as stylex } from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
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
  resolve: { alias: workspaceAliases, dedupe: ['react', 'react-dom'] },
  server: { proxy: { '/characters': DEV_API_PROXY, '/items': DEV_API_PROXY } }
})
