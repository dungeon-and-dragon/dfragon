interface Env {
  ASSETS: Fetcher
  OCR_ASSETS: R2Bucket
  OCR_ASSET_VERSION: string
  SKILLTAB_ASSETS: R2Bucket
}

const API_ORIGIN = 'https://api.dfragon.com'
const API_PATH_PREFIX = '/api'
const OCR_PATH_PREFIX = '/ocr/'
const SKILLTAB_PATH_PREFIX = '/skilltab/'
const SKILLTAB_INDEXES: ReadonlySet<string> = new Set(['skilltab.json', 'oath.json'])

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith(OCR_PATH_PREFIX)) {
      return serveOcrAsset(request, env, url.pathname.slice(OCR_PATH_PREFIX.length))
    }

    if (url.pathname.startsWith(SKILLTAB_PATH_PREFIX)) {
      return serveSkillTabAsset(request, env, url.pathname.slice(SKILLTAB_PATH_PREFIX.length))
    }

    if (url.pathname.startsWith(`${API_PATH_PREFIX}/`)) {
      const apiPath = url.pathname.slice(API_PATH_PREFIX.length)

      return fetch(new Request(new URL(`${apiPath}${url.search}`, API_ORIGIN), request))
    }

    return env.ASSETS.fetch(request)
  }
} satisfies ExportedHandler<Env>

async function serveBucketObject(
  request: Request,
  bucket: R2Bucket,
  key: string,
  responseHeaders: Readonly<Record<string, string>>
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  }

  const object = await bucket.get(key, { onlyIf: request.headers })
  if (object === null) {
    return new Response(null, { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  // 올릴 때 객체에 붙은 metadata보다 이 Worker가 정한 캐시 정책을 앞세운다.
  for (const [name, value] of Object.entries(responseHeaders)) {
    headers.set(name, value)
  }
  if (!('body' in object)) {
    return new Response(null, { status: 304, headers })
  }

  const body = request.method === 'HEAD' ? null : object.body

  return new Response(body, { headers })
}

// ONNX Runtime WASM은 static assets의 파일 하나 25 MiB 한도를 넘어 R2에 둔다. 브라우저 주소는 /ocr/ 그대로 두고,
// R2 key는 배포가 올린 자산 묶음의 hash 폴더를 가리켜 모델을 바꿔도 이전 배포가 새 파일을 섞어 받지 않게 한다.
function serveOcrAsset(request: Request, env: Env, file: string): Promise<Response> {
  const headers = {
    // 주소에 hash가 없어 모델을 바꾼 배포 직후 브라우저 캐시가 옛 파일을 쓰지 않도록 매번 ETag로 확인한다.
    'Cache-Control': 'no-cache',
    // ONNX Runtime은 thread마다 ort/*.mjs로 worker를 띄운다. 격리된 페이지의 worker script는 같은 COEP를 가져야 한다.
    'Cross-Origin-Embedder-Policy': 'credentialless'
  }

  return serveBucketObject(request, env.OCR_ASSETS, `ocr/${env.OCR_ASSET_VERSION}/${file}`, headers)
}

// 스킬 창과 서약 데이터는 게임 클라이언트에서 뽑아 저장소 밖에서 올리므로 배포와 따로 바뀐다. skilltab.json, oath.json은 매번
// ETag로 확인하고, 이 파일들이 가리키는 sprite와 아이콘은 이름에 내용 hash가 있어 오래 캐시한다.
function serveSkillTabAsset(request: Request, env: Env, file: string): Promise<Response> {
  const headers = {
    'Cache-Control': SKILLTAB_INDEXES.has(file) ? 'no-cache' : 'public, max-age=31536000, immutable'
  }

  return serveBucketObject(request, env.SKILLTAB_ASSETS, `skilltab/${file}`, headers)
}
