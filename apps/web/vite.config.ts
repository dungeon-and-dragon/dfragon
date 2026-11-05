import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clientNotices, uiNotices } from '@dfragon/licenses/vite'
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

// 개발 서버는 같은 origin의 /api 경로를 운영 API로 넘겨, 운영 API의 CORS 허용 origin 없이 웹 앱을 연다.
const API_PATH_PREFIX = '/api'
const DEV_API_PROXY = {
  target: 'https://api.dfragon.com',
  changeOrigin: true,
  rewrite: (path: string) => path.slice(API_PATH_PREFIX.length)
}

// 스킬 창 데이터는 저장소 밖에서 만들어 올리고, 배포된 사이트는 Worker가 R2에서 /skilltab/ 아래로 내준다. 개발 서버는
// DFRAGON_SKILLTAB_DIR에 build-skilltab.mjs의 출력 폴더를 주면 그 폴더를 같은 주소로 내준다.
const SKILLTAB_PATH = '/skilltab/'
const SKILLTAB_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.json': 'application/json',
  '.png': 'image/png'
}

async function readSkillTabFile(
  directory: string | undefined,
  url: string
): Promise<{ contentType: string; body: Buffer } | null> {
  if (directory === undefined) {
    return null
  }
  const root = normalize(directory)
  const path = normalize(join(root, decodeURIComponent(url.split('?')[0] ?? '')))
  const contentType = SKILLTAB_CONTENT_TYPES[extname(path)]
  if (!path.startsWith(root + sep) || contentType === undefined) {
    return null
  }
  const body = await readFile(path).catch(() => null)
  if (body === null) {
    return null
  }

  return { contentType, body }
}

function localSkillTab(directory: string | undefined): Plugin {
  return {
    name: 'local-skilltab',
    apply: 'serve',
    configureServer(server) {
      // 개발 서버는 없는 주소에 index.html을 돌려주므로, 폴더가 없거나 폴더에 없는 파일은 여기서 404로 끝낸다.
      server.middlewares.use(SKILLTAB_PATH, async (request, response) => {
        const file = await readSkillTabFile(directory, request.url ?? '')
        if (file === null) {
          response.statusCode = 404
          response.end()

          return
        }
        response.setHeader('Content-Type', file.contentType)
        response.end(file.body)
      })
    }
  }
}

export default defineConfig({
  plugins: [
    stylex.vite(stylexOptions),
    react(),
    uiNotices(),
    clientNotices(),
    siteNotices,
    localSkillTab(process.env.DFRAGON_SKILLTAB_DIR)
  ],
  worker: { format: 'es' },
  resolve: {
    alias: workspaceAliases,
    dedupe: ['react', 'react-dom'],
    // onnxruntime-web의 기본 번들은 WASM을 import.meta.url 기준으로도 참조해 Vite가 같은 WASM을 assets에 한 벌 더
    // 내보낸다. OCR worker는 wasmPaths로 public/ocr의 사본만 읽으므로, 그 참조가 없는 extern WASM 빌드를 고른다.
    conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions]
  },
  server: { proxy: { [`${API_PATH_PREFIX}/`]: DEV_API_PROXY } }
})
