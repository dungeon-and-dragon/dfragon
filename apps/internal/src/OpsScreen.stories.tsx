import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createOpsClient } from '#ops-api/ops-client'
import { OpsApp } from './OpsApp'
import { FakeOpsApi, job, type RunBody, run } from '#ops-testing/fake-ops-api'

const meta = {
  title: 'Screens/운영',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

const MINUTE_MS = 60_000

// 화면은 받은 시각을 지금과 비교하므로 story를 연 시각에서 거슬러 시각을 만든다.
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE_MS).toISOString()
}

function minutesLater(minutes: number): string {
  return minutesAgo(-minutes)
}

function finishedRun(id: number, status: 'succeeded' | 'failed' | 'interrupted', endedAgo: number) {
  const requestedAt = minutesAgo(endedAgo + 3)
  const startedAt = minutesAgo(endedAgo + 3)
  const finishedAt = minutesAgo(endedAgo)
  const summary = status === 'succeeded' ? { processed: 18_402, skipped: 12 } : null
  const error = status === 'failed' ? [{ name: 'NeopleRequestError', code: 'API_ERROR' }] : null

  return run({ id, status, requestedAt, startedAt, finishedAt, summary, error })
}

const CHARACTER = '/df/servers/{serverId}/characters/{characterId}'
const TIMELINE_API = { group: '캐릭터 타임라인', endpoints: [`${CHARACTER}/timeline`] }

function statsJob() {
  const nextRunAt = minutesLater(540)
  const lastFinishedRun = finishedRun(10, 'succeeded', 120)

  return job({
    name: 'stats',
    displayName: '통계',
    description: '직업별 통계를 다시 계산한다',
    nextRunAt,
    lastFinishedRun
  })
}

function timelineBackfillJob() {
  const nextRunAt = minutesLater(12)
  const requestedAt = minutesAgo(6)
  const startedAt = minutesAgo(6)
  const activeRun = run({
    id: 21,
    status: 'running',
    requestedAt,
    startedAt,
    finishedAt: null,
    progress: { done: 6_120, total: 9_870 }
  })
  const lastFinishedRun = finishedRun(20, 'failed', 40)

  return job({
    name: 'timeline-backfill',
    displayName: '타임라인 백필',
    schedule: '*/30 * * * *',
    neopleApi: TIMELINE_API,
    nextRunAt,
    activeRun,
    lastFinishedRun
  })
}

function seasonBackfillJob() {
  const requestedAt = minutesAgo(0)
  const activeRun = run({
    id: 41,
    trigger: 'manual',
    status: 'requested',
    requestedAt,
    startedAt: null,
    finishedAt: null
  })
  const lastFinishedRun = finishedRun(30, 'interrupted', 300)

  return job({
    name: 'season-backfill',
    displayName: '옛 시즌 백필',
    neopleApi: TIMELINE_API,
    paused: true,
    nextRunAt: null,
    activeRun,
    lastFinishedRun
  })
}

// 모든 값은 합성 값이며 batch key 끝 4자도 실제 Neople key가 아니다.
function filledApi(): FakeOpsApi {
  const api = new FakeOpsApi()
  const workerSeenAt = minutesAgo(1)
  const manualJob = job({
    name: 'skill-style-sample',
    displayName: '스킬 스타일 표본 채우기',
    neopleApi: { group: '스킬 스타일', endpoints: [`${CHARACTER}/skill/style`] },
    schedule: null,
    nextRunAt: null,
    argsSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer' },
        serverId: { type: 'string', enum: ['cain', 'siroco'] }
      },
      required: ['limit']
    }
  })
  const interruptedRun = finishedRun(8, 'interrupted', 3_000)
  const catchupRun = finishedRun(7, 'succeeded', 4_440)
  const manualRun = finishedRun(6, 'succeeded', 5_880)
  const statsRuns: RunBody[] = [
    finishedRun(10, 'succeeded', 120),
    finishedRun(9, 'failed', 1_560),
    { ...interruptedRun, progress: { done: 3_400, total: 9_870 } },
    { ...catchupRun, trigger: 'catchup' },
    { ...manualRun, trigger: 'manual' }
  ]
  const oldestQueuedAt = minutesAgo(318)
  const internalFailedAt = minutesAgo(4)
  const notFoundFailedAt = minutesAgo(52)
  const rejectedAt = minutesAgo(90)

  api.workerSeenAt = workerSeenAt
  api.jobs = [statsJob(), timelineBackfillJob(), seasonBackfillJob(), manualJob]
  api.runs = { stats: statsRuns, 'timeline-backfill': [finishedRun(20, 'failed', 40)] }
  api.collection = {
    waiting: 18_402,
    oldestQueuedAt,
    failures: [
      { failure: 'neople-internal', count: 41, lastAttemptedAt: internalFailedAt },
      { failure: 'character-not-found', count: 7, lastAttemptedAt: notFoundFailedAt }
    ]
  }
  api.addBatchKey('batch-1', 'synthetic-0000-a1b2')
  api.addBatchKey('batch-2', 'synthetic-0000-c3d4', { enabled: false })
  api.addBatchKey('batch-3', 'synthetic-0000-e5f6', { enabled: false, rejectedAt })
  // 실험실 아이템 이름은 지어낸 이름이다.
  api.labItems = [
    { category: 'WEAPON', role: 'dealer', tier: '종결', itemNames: ['합성 카드 A', '합성 카드 B'] },
    { category: 'TITLE', role: 'all', tier: '종결', itemNames: ['합성 칭호 A'] }
  ]

  return api
}

function emptyApi(): FakeOpsApi {
  const api = new FakeOpsApi()
  api.workerSeenAt = null

  return api
}

const failingFetch: typeof fetch = async () =>
  new Response(JSON.stringify({ error: { code: 'INTERNAL' } }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  })

function Screen({ fetch }: { fetch: typeof globalThis.fetch }): React.JSX.Element {
  const [client] = useState(() => createOpsClient('http://ops.story/api/', fetch))
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  )

  return <OpsApp client={client} queryClient={queryClient} />
}

export const 전체: Story = {
  render: () => <Screen fetch={filledApi().fetch} />
}

export const 빈목록: Story = {
  render: () => <Screen fetch={emptyApi().fetch} />
}

export const 받지못함: Story = {
  render: () => <Screen fetch={failingFetch} />
}
