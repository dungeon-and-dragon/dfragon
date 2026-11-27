import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createOpsClient } from '#ops-api/ops-client'
import { OpsApp } from './OpsApp'
import { FakeOpsApi, job, labCandidate, type RunBody, run } from '#ops-testing/fake-ops-api'
import type { OpsPageId } from './pages'

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
  // 실험실 아이템과 재화 이름은 지어낸 이름이다.
  api.labCurrencies = [
    {
      id: 1,
      name: '합성 재화',
      description: '합성 교환처에서 아이템과 바꿀 수 있다.',
      updatedAt: minutesAgo(30)
    }
  ]
  api.labItemDetails = [
    {
      itemName: '합성 보주',
      description: '합성 교환처에서 받는 상자.',
      itemRarity: '유니크',
      itemTypeDetail: '합성 재료',
      availableLevel: 115,
      fame: 232,
      card: {
        slots: ['무기'],
        enchants: [
          { upgrade: 0, status: [{ name: '힘', value: '90' }] },
          {
            upgrade: 1,
            status: [
              { name: '힘', value: '100' },
              { name: '지능', value: '20' }
            ]
          }
        ]
      },
      hasIcon: false,
      updatedAt: minutesAgo(10)
    }
  ]
  api.labItems = [
    {
      category: 'WEAPON',
      role: 'dealer',
      tier: '종결',
      items: [
        { itemName: '합성 카드 A', cost: null },
        { itemName: '합성 보주', cost: { currencyId: 1, count: 5 } }
      ]
    },
    {
      category: 'TITLE',
      role: 'all',
      tier: '종결',
      items: [{ itemName: '합성 칭호 A', cost: null }]
    }
  ]

  return api
}

const TITLE_OPTIONS = [
  { name: '공격력 증폭', value: '20%' },
  { name: '모든 속성 강화', value: '10' },
  { name: '힘', value: '100' },
  { name: '지능', value: '100' }
]
const TITLE_BUFF = ['50레벨 액티브 스킬 Lv +2', '1~95레벨 모든 스킬 Lv +1']

// 후보 이름과 옵션, 가격은 지어낸 값이다.
function candidatesApi(): FakeOpsApi {
  const api = new FakeOpsApi()
  const checkedAt = minutesAgo(12)
  const wearCountedAt = minutesAgo(600)
  const previousCheckedAt = minutesAgo(1_440)
  const previous = (unitPrice: number) => ({
    itemId: 'synthetic-item',
    unitPrice,
    checkedAt: previousCheckedAt
  })
  const lastFinishedRun = finishedRun(50, 'succeeded', 12)

  api.workerSeenAt = minutesAgo(1)
  api.jobs = [job({ name: 'lab-candidate-price-refresh', schedule: '0 * * * *', lastFinishedRun })]
  api.labCandidates = [
    labCandidate({
      itemName: '합성 칭호 플래티넘[80Lv]',
      fame: 1123,
      options: TITLE_OPTIONS,
      buffLines: TITLE_BUFF,
      unitPrice: 2_150_000_000,
      previousPrice: previous(2_063_000_000),
      checkedAt,
      wearCount: 1284,
      wearCountedAt,
      recommendedTier: '종결'
    }),
    labCandidate({
      itemName: '합성 칭호',
      fame: 1123,
      options: TITLE_OPTIONS,
      buffLines: TITLE_BUFF,
      unitPrice: 1_240_000_000,
      previousPrice: previous(1_254_000_000),
      checkedAt,
      wearCount: 6902,
      wearCountedAt,
      recommendedTier: '종결'
    }),
    labCandidate({
      itemName: '합성 기사단 칭호',
      fame: 1123,
      options: TITLE_OPTIONS,
      buffLines: TITLE_BUFF,
      itemId: null,
      unitPrice: null,
      checkedAt,
      recommendedTier: '종결',
      badge: '검색 없음'
    }),
    labCandidate({
      itemName: '합성 각성 칭호',
      fame: 849,
      options: TITLE_OPTIONS.slice(0, 2),
      buffLines: TITLE_BUFF.slice(0, 1),
      unitPrice: 218_000_000,
      previousPrice: previous(216_000_000),
      checkedAt,
      wearCount: 3417,
      wearCountedAt,
      recommendedTier: '준종결'
    }),
    labCandidate({
      itemName: '합성 수호자 칭호',
      fame: 849,
      options: TITLE_OPTIONS.slice(0, 2),
      buffLines: TITLE_BUFF.slice(0, 1),
      unitPrice: null,
      checkedAt,
      wearCount: 412,
      wearCountedAt,
      recommendedTier: '준종결',
      badge: '매물 없음'
    }),
    labCandidate({
      itemName: '합성 길잡이 칭호',
      fame: 731,
      options: TITLE_OPTIONS.slice(0, 1),
      buffLines: ['50레벨 액티브 스킬 Lv +1'],
      itemId: null,
      unitPrice: null,
      checkedAt: null,
      badge: '미조회'
    }),
    labCandidate({
      itemName: '합성 딜러 상의 카드',
      kind: 'ENCHANT',
      itemRarity: '레전더리',
      categories: ['JACKET', 'PANTS'],
      roles: ['dealer'],
      fame: 232,
      card: {
        slots: ['상의', '하의'],
        enchants: [
          {
            upgrade: 0,
            status: [
              { name: '최종 데미지 증가', value: '3%' },
              { name: '힘', value: '90' }
            ]
          }
        ]
      },
      unitPrice: 4_800_000,
      checkedAt,
      recommendedTier: '종결'
    })
  ]
  const history = [1_240, 1_254, 1_254, 1_195, 1_180].map((millions, index) => ({
    id: 5 - index,
    itemName: '합성 칭호',
    itemId: 'synthetic-item',
    unitPrice: millions * 1_000_000,
    checkedAt: minutesAgo(12 + index * 900)
  }))
  api.labCandidateHistory = { '합성 칭호': history }
  api.labItems = [
    {
      category: 'TITLE',
      role: 'all',
      tier: '종결',
      items: [
        { itemName: '합성 칭호 플래티넘[80Lv]', cost: null },
        { itemName: '합성 칭호', cost: null }
      ]
    },
    {
      category: 'TITLE',
      role: 'all',
      tier: '준종결',
      items: [{ itemName: '합성 각성 칭호', cost: null }]
    }
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

function Screen({
  fetch,
  page = 'ops'
}: {
  fetch: typeof globalThis.fetch
  page?: OpsPageId
}): React.JSX.Element {
  const [client] = useState(() => createOpsClient('http://ops.story/api/', fetch))
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  )

  return <OpsApp client={client} queryClient={queryClient} page={page} />
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

export const 실험실후보: Story = {
  render: () => <Screen fetch={candidatesApi().fetch} page="lab-candidates" />
}

export const 실험실후보빈목록: Story = {
  render: () => <Screen fetch={emptyApi().fetch} page="lab-candidates" />
}

export const 실험실후보받지못함: Story = {
  render: () => <Screen fetch={failingFetch} page="lab-candidates" />
}
