import type { MiddlewareHandler } from 'hono'

export const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

export const setCommonHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  if (!c.res.headers.has('Cache-Control')) {
    c.res.headers.set('Cache-Control', 'no-store')
  }

  // `c.json`은 charset 없이 보낸다. 클라이언트가 받아 온 값을 유지한다.
  if (c.res.headers.get('Content-Type') === 'application/json') {
    c.res.headers.set('Content-Type', JSON_CONTENT_TYPE)
  }
}
