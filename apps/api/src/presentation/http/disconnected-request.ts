import type { AccessLogEnv } from '@dfragon/http-server'
import type { Context } from 'hono'

/**
 * 요청의 signal은 응답이 닫힐 때 abort되므로, handler에 닿기 전에 닫힌 socket은 signal로 알 수 없다.
 * 받을 클라이언트가 없는 요청은 `respond`를 부르지 않고 빈 응답으로 끝낸다.
 */
export async function respondUnlessDisconnected(
  c: Context<AccessLogEnv>,
  respond: (signal: AbortSignal) => Promise<Response>
): Promise<Response> {
  if (c.env.incoming.socket.destroyed) {
    return c.body(null)
  }

  return respond(c.req.raw.signal)
}
