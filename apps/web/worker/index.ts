interface Env {
  ASSETS: Fetcher
  OCR_ASSETS: R2Bucket
  OCR_ASSET_VERSION: string
}

const API_ORIGIN = 'https://api.dfragon.com'
const API_PATH_PREFIXES = ['/characters', '/items']
const OCR_PATH_PREFIX = '/ocr/'

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith(OCR_PATH_PREFIX)) {
      return serveOcrAsset(request, env, url.pathname.slice(OCR_PATH_PREFIX.length))
    }

    if (API_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      return fetch(new Request(new URL(`${url.pathname}${url.search}`, API_ORIGIN), request))
    }

    return env.ASSETS.fetch(request)
  }
} satisfies ExportedHandler<Env>

// ONNX Runtime WASM은 static assets의 파일 하나 25 MiB 한도를 넘어 R2에 둔다. 브라우저 주소는 /ocr/ 그대로 두고,
// R2 key는 배포가 올린 자산 묶음의 hash 폴더를 가리켜 모델을 바꿔도 이전 배포가 새 파일을 섞어 받지 않게 한다.
async function serveOcrAsset(request: Request, env: Env, file: string): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  }

  const object = await env.OCR_ASSETS.get(`ocr/${env.OCR_ASSET_VERSION}/${file}`, {
    onlyIf: request.headers
  })
  if (object === null) {
    return new Response(null, { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  // 주소에 hash가 없어 모델을 바꾼 배포 직후 브라우저 캐시가 옛 파일을 쓰지 않도록 매번 ETag로 확인한다.
  headers.set('Cache-Control', 'no-cache')
  // ONNX Runtime은 thread마다 ort/*.mjs로 worker를 띄운다. 격리된 페이지의 worker script는 같은 COEP를 가져야 한다.
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless')
  if (!('body' in object)) {
    return new Response(null, { status: 304, headers })
  }

  const body = request.method === 'HEAD' ? null : object.body

  return new Response(body, { headers })
}
