import { describe, expect, it } from 'vitest'
import { FakeOpsApi, job, run } from '../testing/fake-ops-api'
import { createOpsClient, JOB_ALREADY_RUNNING, OpsRequestFailure } from './ops-client'

const BASE_URL = 'http://ops.test/api/'

function clientWith(respond: () => Response) {
  const transport: typeof fetch = async () => respond()

  return createOpsClient(BASE_URL, transport)
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('운영 API 응답 검증', () => {
  it('job 목록의 시각을 Date로, 진행률과 오류를 화면이 쓰는 형태로 읽는다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [
      job({
        name: 'stats',
        displayName: '통계',
        activeRun: run({
          id: 2,
          status: 'running',
          finishedAt: null,
          progress: { done: 87, total: 132 }
        }),
        lastFinishedRun: run({
          id: 1,
          status: 'failed',
          error: [{ name: 'PrismaClientKnownRequestError', code: 'P2024', frames: ['at x'] }]
        })
      })
    ]
    const client = createOpsClient(BASE_URL, api.fetch)

    const { workerSeenAt, jobs } = await client.readJobs()

    expect(workerSeenAt).toEqual(new Date('2026-11-10T05:31:00.000Z'))
    expect(jobs[0]?.activeRun?.progress).toEqual({ done: 87, total: 132 })
    expect(jobs[0]?.lastFinishedRun?.error).toEqual([
      { name: 'PrismaClientKnownRequestError', code: 'P2024' }
    ])
    expect(jobs[0]?.lastFinishedRun?.finishedAt).toEqual(new Date('2026-11-09T15:02:41.000Z'))
  })

  it('정해진 상태 밖의 실행 상태를 받으면 응답을 거절한다', async () => {
    const client = clientWith(() =>
      jsonResponse(200, {
        workerSeenAt: null,
        jobs: [job({ name: 'stats', activeRun: run({ id: 1, status: 'cancelled' as never }) })]
      })
    )

    await expect(client.readJobs()).rejects.toThrow()
  })

  it('수집 대기열의 시각이 ISO 문자열이 아니면 응답을 거절한다', async () => {
    const client = clientWith(() =>
      jsonResponse(200, { waiting: 3, oldestQueuedAt: 'yesterday', failures: [] })
    )

    await expect(client.readCollection()).rejects.toThrow()
  })

  it('중복 실행 거절은 오류 code를 담은 OpsRequestFailure로 알린다', async () => {
    const client = clientWith(() => jsonResponse(409, { error: { code: JOB_ALREADY_RUNNING } }))

    const failure = await client.requestRun('stats', {}).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(OpsRequestFailure)
    expect(failure).toMatchObject({ status: 409, code: JOB_ALREADY_RUNNING })
  })

  it('오류 본문이 형태에 맞지 않으면 code 없이 status만 남긴다', async () => {
    const client = clientWith(() => new Response('Bad Gateway', { status: 502 }))

    await expect(client.readQueues()).rejects.toMatchObject({ status: 502, code: undefined })
  })

  // 운영 app은 GET, HEAD가 아닌 요청을 Content-Type: application/json일 때만 받는다(415).
  it('쓰기 요청은 모두 JSON 본문으로 보낸다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [job({ name: 'stats' })]
    api.collection = {
      waiting: 0,
      oldestQueuedAt: null,
      failures: [{ failure: 'neople-api', count: 7, lastAttemptedAt: null }]
    }
    const client = createOpsClient(BASE_URL, api.fetch)

    await client.setPaused('stats', true)
    await client.requestRun('stats', { limit: 5000 })
    const requeued = await client.requeue('neople-api')

    expect(requeued).toBe(7)
    expect(api.writes()).toEqual([
      { method: 'POST', path: '/api/jobs/stats/pause', contentType: 'application/json', body: {} },
      {
        method: 'POST',
        path: '/api/jobs/stats/runs',
        contentType: 'application/json',
        body: { args: { limit: 5000 } }
      },
      {
        method: 'POST',
        path: '/api/collection/requeue',
        contentType: 'application/json',
        body: { failure: 'neople-api' }
      }
    ])
  })

  it('전체 되돌리기는 failure 없이 요청한다', async () => {
    const api = new FakeOpsApi()
    const client = createOpsClient(BASE_URL, api.fetch)

    await client.requeue(undefined)

    expect(api.writes()[0]?.body).toEqual({})
  })
})
