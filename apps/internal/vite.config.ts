import { clientNotices, uiNotices } from '@dfragon/licenses/vite'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import { unplugin as stylex } from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { workspaceAliases } from './workspace-aliases.ts'

// 운영에서는 host의 reverse proxy가 /api를 그대로 API 운영 포트로 넘기므로, 개발 서버도 경로를 바꾸지 않고 넘긴다.
const DEFAULT_OPS_PORT = '3444'
const opsPort = process.env.OPS_PORT ?? DEFAULT_OPS_PORT

export default defineConfig({
  plugins: [stylex.vite(stylexOptions), react(), uiNotices(), clientNotices()],
  resolve: { alias: workspaceAliases, dedupe: ['react', 'react-dom'] },
  server: { port: 5174, proxy: { '/api/': { target: `http://localhost:${opsPort}` } } }
})
