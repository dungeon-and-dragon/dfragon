import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clientNotices, uiNotices } from '@dfragon/licenses/vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defaultClientConditions, defineConfig, type Plugin } from 'vite'
import { buildCommit } from './build-commit.ts'
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

// 개발 서버는 같은 origin의 /api 경로를 운영 API로 넘겨, 배포된 사이트와 같은 주소로 API를 부른다.
// Nitro가 Vite의 server.proxy보다 먼저 요청을 받으므로 Nitro의 route rule로 넘기며, 개발 서버에만 넣는다.
const DEV_API_ORIGIN = 'https://api.dfragon.com'
const DEV_API_PROXY_RULE = { '/api/**': { proxy: `${DEV_API_ORIGIN}/**` } }

// 개발 서버의 서버 렌더링은 Node에서 API를 부르므로 proxy와 같은 API를 주소로 준다.
// 배포한 서버는 이 설정을 읽지 않아 DFRAGON_API_ORIGIN을 직접 받아야 한다.
process.env.DFRAGON_API_ORIGIN ??= DEV_API_ORIGIN

// 개발 서버는 DFRAGON_SKILLTAB_DIR에 데이터 묶음 폴더를 주면 그 폴더를 배포된 사이트와 같은 /skilltab/ 주소로 내준다.
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

const HASHED_ASSET_CACHE = 'public, max-age=31536000, immutable'

// Cross-origin isolation이 있어야 OCR worker가 ONNX Runtime WASM을 thread로 돌린다. worker script도 같은 헤더가
// 필요해 모든 경로에 붙인다. credentialless는 API와 초상화 응답에 Cross-Origin-Resource-Policy 없이도 읽게 한다.
// HTML과 이름에 hash가 없는 OCR 파일은 매번 확인하게 하고, Vite가 이름에 content hash를 넣는 /assets만 오래 둔다.
const RESPONSE_HEADER_RULES = {
  '/**': {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cache-Control': 'no-cache'
    }
  },
  '/assets/**': { headers: { 'Cache-Control': HASHED_ASSET_CACHE } },
  // Nitro는 모르는 확장자를 text/plain으로 내는데, 그러면 edge nginx가 30MB 모델을 요청마다 gzip으로 압축한다.
  '/ocr/korean-rec.onnx': { headers: { 'Content-Type': 'application/octet-stream' } }
}

export default defineConfig(({ command }) => {
  const routeRules =
    command === 'serve'
      ? { ...RESPONSE_HEADER_RULES, ...DEV_API_PROXY_RULE }
      : RESPONSE_HEADER_RULES

  return {
    plugins: [
      tailwindcss(),
      tanstackStart({
        srcDirectory: 'src',
        router: {
          entry: 'app/router.tsx',
          routesDirectory: 'app/routes',
          generatedRouteTree: 'app/routeTree.gen.ts'
        },
        client: { entry: 'app/client.tsx' },
        start: { entry: 'app/start.ts' }
      }),
      nitro({ routeRules }),
      react(),
      uiNotices(),
      clientNotices(),
      siteNotices,
      localSkillTab(process.env.DFRAGON_SKILLTAB_DIR)
    ],
    define: { __BUILD_COMMIT__: JSON.stringify(buildCommit(process.env.SOURCE_COMMIT)) },
    worker: { format: 'es' },
    resolve: {
      alias: workspaceAliases,
      dedupe: ['react', 'react-dom']
    },
    environments: {
      client: {
        resolve: {
          // onnxruntime-web의 기본 번들은 WASM을 import.meta.url 기준으로도 참조해 Vite가 같은 WASM을 assets에 한 벌 더
          // 내보낸다. OCR worker는 wasmPaths로 public/ocr의 사본만 읽으므로, 그 참조가 없는 extern WASM 빌드를 고른다.
          conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions]
        }
      }
    }
  }
})
