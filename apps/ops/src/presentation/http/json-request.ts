import type { Context, MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { OpsFailure } from '#domain/failure.js'

const BODY_LIMIT_BYTES = 16 * 1024
// 재화와 아이템 아이콘은 base64로 JSON에 실어 받으므로 아이콘 상한(64KiB)의 4/3배와 이름을 담을 만큼 둔다.
const ICON_BODY_LIMIT_BYTES = 96 * 1024
const SAFE_METHODS = new Set(['GET', 'HEAD'])

// 로그인이 없는 운영 포트라, 소유자 브라우저에서 다른 사이트가 form으로 보내는 요청을 preflight가 필요한 JSON으로만 받아 막는다.
export const requireJsonContentType: MiddlewareHandler = async (c, next) => {
  const mediaType = c.req.header('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (!SAFE_METHODS.has(c.req.method) && mediaType !== 'application/json') {
    throw new OpsFailure('mediaType')
  }
  await next()
}

function rejectLargeBody(): never {
  throw new OpsFailure('request')
}

export const limitJsonBody = bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: rejectLargeBody })

export const limitIconJsonBody = bodyLimit({
  maxSize: ICON_BODY_LIMIT_BYTES,
  onError: rejectLargeBody
})

export async function readJsonBody(c: Context): Promise<unknown> {
  const text = await c.req.text()
  // 본문 없이 보낸 요청은 빈 object를 보낸 요청과 같게 다룬다.
  if (text === '') {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new OpsFailure('request')
  }
}
