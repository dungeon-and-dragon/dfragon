import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '#testing/test-support/msw-server'

const unhandledRequests: string[] = []

// handler가 없는 요청은 MSW가 network 오류로 끝내므로, 화면이 오류 상태를 그려 테스트가 통과하지 않게 테스트 끝에 실패시킨다.
beforeAll(() =>
  server.listen({
    async onUnhandledFrame({ frame, defaults }) {
      unhandledRequests.push(await frame.getUnhandledMessage())
      defaults.error()
    }
  })
)

afterEach(() => {
  server.resetHandlers()
  const requests = unhandledRequests.splice(0)

  if (requests.length > 0) {
    throw new Error(`handler가 없는 API 요청을 보냈습니다: ${requests.join(', ')}`)
  }
})

afterAll(() => server.close())
