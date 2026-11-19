import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '#testing/test-support/msw-server'

const unhandledRequests: Promise<string>[] = []

// MSW 3의 사용자 정의 callback은 실패하는 promise를 돌려줘야 요청을 실제 네트워크로 보내지 않고 오류로 끝낸다.
// 그 오류로 화면이 오류 상태를 그려 테스트가 통과하지 않게, 테스트 끝에 따로 실패시킨다.
beforeAll(() =>
  server.listen({
    async onUnhandledFrame({ frame }) {
      unhandledRequests.push(frame.getUnhandledMessage())

      throw new TypeError('handler가 없는 API 요청입니다.')
    }
  })
)

afterEach(async () => {
  server.resetHandlers()
  const requests = await Promise.all(unhandledRequests.splice(0))

  if (requests.length > 0) {
    throw new Error(`handler가 없는 API 요청을 보냈습니다: ${requests.join(', ')}`)
  }
})

afterAll(() => server.close())
