// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  ClearContent,
  ClearContentStats,
  ClearJob,
  ClearStats,
  ClearWeek,
  ClearWeekMove
} from '#entities/ranking'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { CLEAR_CONTENT_STATS_URL, CLEAR_STATS_URL } from './api/clears.handlers'
import { ClearDetailScreen } from './ClearDetailScreen'

let container: HTMLDivElement
let root: Root
let requested: string[]

beforeEach(() => {
  requested = []
  // 2026-11-14 14:00 KST. 타이머는 그대로 두고 지금 시각만 고정한다.
  vi.useFakeTimers({ now: new Date('2026-11-14T05:00:00.000Z'), toFake: ['Date'] })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

const LATEST_WEEK = '2026-11-12'
const LAST_CLOSED_WEEK = '2026-11-05'
const PREVIOUS_WEEK = '2026-10-29'

function week(
  weekStart: string,
  cleared: number,
  ratios: ClearWeek['ratios'] = [{ ratio: null, cleared }]
): ClearWeek {
  return {
    weekStart,
    closed: weekStart !== LATEST_WEEK,
    population: 1000,
    minFame: 104292,
    cleared,
    newlyCleared: null,
    ratios
  }
}

function content(
  id: string,
  kind: ClearContent['kind'],
  name: string,
  releasedAt: string,
  weeks: ClearWeek[]
): ClearContent {
  return { id, kind, name, releasedAt, entryFame: 104292, latest: true, weeks }
}

const MICHAELA_RELEASE = '2026-08-05T21:00:00.000Z'

const michaelaHard = content(
  'michaela-hard',
  'raid',
  '무너진 성자 미카엘라 (하드)',
  MICHAELA_RELEASE,
  [
    week(PREVIOUS_WEEK, 61, [
      { ratio: null, cleared: 61 },
      { ratio: 50, cleared: 0 }
    ]),
    week(LAST_CLOSED_WEEK, 57, [
      { ratio: null, cleared: 47 },
      { ratio: 50, cleared: 10 }
    ]),
    week(LATEST_WEEK, 60)
  ]
)
const michaelaNormal = content(
  'michaela-normal',
  'raid',
  '무너진 성자 미카엘라 (일반)',
  MICHAELA_RELEASE,
  [week(PREVIOUS_WEEK, 106), week(LAST_CLOSED_WEEK, 106), week(LATEST_WEEK, 100)]
)
const inae = content('inae-twilight', 'raid', '이내 황혼전', '2025-08-20T21:00:00.000Z', [
  week(LAST_CLOSED_WEEK, 50),
  week(LATEST_WEEK, 53)
])
const nightmare = content(
  'engraved-nightmare-1',
  'challenge',
  '각인된 악몽 "죽음을 딛고 선 자"',
  '2026-11-04T21:00:00.000Z',
  [week(LAST_CLOSED_WEEK, 3), week(LATEST_WEEK, 6)]
)

const apocalypse = content(
  'legion-apocalypse',
  'legion',
  '아포칼립스',
  '2026-04-22T21:00:00.000Z',
  [week(LAST_CLOSED_WEEK, 400), week(LATEST_WEEK, 420)]
)

const stats: ClearStats = {
  contents: [inae, michaelaNormal, michaelaHard, nightmare],
  legions: [{ ...apocalypse, entryFame: null }]
}

const noScores = { equipment: null, buff: null }

const fame = { p5: 110000, p25: 118000, median: 122000, p75: 126000, p95: 132000, max: 140000 }

function job(index: number, population: number, cleared: number, median: number): ClearJob {
  return {
    jobId: `job-${index}`,
    jobGrowId: `grow-${index}`,
    jobName: `직업${index}`,
    jobGrowName: `眞 전직${index}`,
    population,
    cleared,
    fame: { ...fame, median },
    scores: noScores
  }
}

// 클리어율은 전직6, 클리어 수는 전직11, 명성은 전직5가 가장 높고 셋 다 입력 순서의 첫 줄이 아니다.
const jobs = Array.from({ length: 12 }, (_, index) => {
  if (index === 6) {
    return job(index, 50, 25, 120006)
  }

  return job(index, 100 + index * 50, 30 + index, index === 5 ? 130000 : 120000 + index)
})

const RAID_WEEK_OVER_WEEK = {
  both: { cleared: 40, fame, scores: noScores },
  returned: { cleared: 7, fame: null, scores: noScores },
  left: { cleared: 21, fame, scores: noScores },
  first: { cleared: 10, fame, scores: noScores }
}

const MICHAELA_WEEK_MOVES: ClearWeekMove[] = [
  { from: 'hard', to: 'hard', characters: 40 },
  { from: 'hard', to: 'normal', characters: 6 },
  { from: 'hard', to: 'left', characters: 8 },
  { from: 'normal', to: 'hard', characters: 9 },
  { from: 'normal', to: 'normal', characters: 90 },
  { from: 'normal', to: 'matching', characters: 7 },
  { from: 'normal', to: 'left', characters: 12 },
  { from: 'matching', to: 'normal', characters: 2 },
  { from: 'matching', to: 'matching', characters: 30 },
  { from: 'matching', to: 'left', characters: 5 },
  { from: 'returned', to: 'hard', characters: 5 },
  { from: 'returned', to: 'normal', characters: 4 },
  { from: 'first', to: 'hard', characters: 3 },
  { from: 'first', to: 'normal', characters: 0 },
  { from: 'first', to: 'matching', characters: 1 }
]

const RAID_STREAKS = [
  { weeks: 1, characters: 20 },
  { weeks: 2, characters: 37 }
]

function statsOf(contentId: string, weekStart: string): ClearContentStats {
  const { weeks, ...header } = [...stats.contents, ...stats.legions].find(
    ({ id }) => id === contentId
  )!
  const raid = header.kind === 'raid'
  const selected = weeks.find((candidate) => candidate.weekStart === weekStart) ?? null
  const weekOverWeek = raid ? RAID_WEEK_OVER_WEEK : null
  const weekMoves = contentId.startsWith('michaela') ? MICHAELA_WEEK_MOVES : null
  const streaks = raid ? RAID_STREAKS : null
  const weekdays = [4, 5, 6, 7, 1, 2, 3].map((weekday) => {
    const cleared = weekday === 6 ? 50 : 1

    return { weekday, cleared }
  })

  return {
    ...header,
    week: selected,
    jobs,
    adventures: [
      { characters: 1, adventures: 40 },
      { characters: 16, adventures: 3 },
      { characters: 17, adventures: 2 },
      { characters: 19, adventures: 4 },
      { characters: 20, adventures: 5 },
      { characters: 29, adventures: 8 },
      { characters: 30, adventures: 1 },
      { characters: 49, adventures: 2 },
      { characters: 50, adventures: 3 },
      { characters: 164, adventures: 7 }
    ],
    weeklyClears: weeks.map((item) => {
      const firstCleared = Math.min(item.cleared, 5)

      return {
        weekStart: item.weekStart,
        population: item.population,
        firstCleared,
        repeatCleared: item.cleared - firstCleared,
        everCleared: 100
      }
    }),
    fameBands: [
      { fame: 104000, population: 500, cleared: 10 },
      { fame: 106000, population: 400, cleared: 40 }
    ],
    weekOverWeek,
    weekMoves,
    streaks,
    scoreBands: { equipment: [], buff: [] },
    weekdays,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, cleared: hour }))
  }
}

type Replies = Readonly<{
  stats?: () => Response | Promise<Response>
  contentStats?: (contentId: string, weekStart: string) => Response | Promise<Response>
}>

type Props = Readonly<{
  contentKey: string
  stage?: string
  week?: string
  onStageSelect?: (stage: string) => void
  onWeekSelect?: (weekStart: string) => void
  onContentOpen?: (contentKey: string) => void
}>

function respond({
  stats: statsReply = () => HttpResponse.json(stats),
  contentStats = (contentId, weekStart) => HttpResponse.json(statsOf(contentId, weekStart))
}: Replies): void {
  server.use(
    http.get(CLEAR_STATS_URL, ({ request }) => {
      requested.push(request.url.slice(API_BASE_URL.length))

      return statsReply()
    }),
    http.get(CLEAR_CONTENT_STATS_URL, ({ params, request }) => {
      requested.push(request.url.slice(API_BASE_URL.length))

      return contentStats(
        String(params.contentId),
        new URL(request.url).searchParams.get('week') ?? ''
      )
    })
  )
}

function render(
  {
    contentKey,
    stage,
    week: weekStart,
    onStageSelect = () => {},
    onWeekSelect = () => {},
    onContentOpen = () => {}
  }: Props,
  replies: Replies = {}
): Promise<void> {
  respond(replies)

  return act(async () =>
    root.render(
      <TestQueryClient>
        <ClearDetailScreen
          contentKey={contentKey}
          stage={stage}
          week={weekStart}
          onStageSelect={onStageSelect}
          onWeekSelect={onWeekSelect}
          onContentOpen={onContentOpen}
        />
      </TestQueryClient>
    )
  )
}

async function open(props: Props, replies: Replies = {}): Promise<void> {
  await render(props, replies)
  await vi.waitFor(() =>
    expect(
      container.querySelector('[aria-busy="true"], [aria-hidden="true"] .skeleton-text')
    ).toBeNull()
  )
}

function contentRequests(): string[] {
  return requested.filter((request) => request !== '/stats/clears')
}

function panelNames(): string[] {
  return [...container.querySelectorAll('section[aria-label]')].map(
    (section) => section.getAttribute('aria-label') ?? ''
  )
}

function panel(name: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)
}

function legendNames(name: string): string[] {
  return [...(panel(name)?.querySelectorAll('ul li:has(> i)') ?? [])].map(
    (item) => item.textContent ?? ''
  )
}

function cardButtons(): HTMLButtonElement[] {
  return [
    ...container.querySelectorAll<HTMLButtonElement>('nav[aria-label="컨텐츠"] > div > button')
  ]
}

function buttonNamed(name: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent === name
  )!
}

async function columnTooltips(name: string): Promise<(string | null)[]> {
  const box = panel(name)!
  const tooltip = box.querySelector('ul + [aria-hidden="true"]')!
  const texts: (string | null)[] = []

  for (const column of box.querySelectorAll('li:not([aria-hidden])')) {
    await act(async () => {
      column.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    texts.push(tooltip.textContent)
  }

  return texts
}

function click(element: Element): Promise<void> {
  return act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function jobNames(): string[] {
  return [...(panel('전직별 클리어')?.querySelectorAll('tbody th') ?? [])].map(
    (cell) => cell.firstChild?.textContent ?? ''
  )
}

it('받는 중에는 제목을 두고 패널은 두지 않는다', async () => {
  await render({ contentKey: 'michaela' }, { stats: () => new Promise<never>(() => {}) })

  expect(container.querySelector('h1')?.textContent).toBe('클리어 집계')
  expect(panelNames()).toEqual([])
})

it('모르는 컨텐츠 주소는 제목 줄 아래 한 줄만 둔다', async () => {
  await open({ contentKey: 'unknown' })

  expect(container.textContent).toBe('클리어 집계수집 기록이 없습니다.')
})

it('고른 컨텐츠 카드를 눌린 상태로 두고, 고른 카드나 다른 카드를 누르면 그 컨텐츠 묶음을 알린다', async () => {
  const onContentOpen = vi.fn()
  await open({ contentKey: 'michaela', onContentOpen })

  const pressed = cardButtons().map((card) => card.getAttribute('aria-pressed'))
  expect(pressed).toEqual(['false', 'true', 'false', 'false'])

  await click(cardButtons()[1]!)
  expect(onContentOpen).toHaveBeenLastCalledWith('michaela')
  await click(cardButtons()[0]!)
  expect(onContentOpen).toHaveBeenLastCalledWith('nightmare')
})

it('컨텐츠 줄에 종류와 출시일, 이름, 단계, 클리어 캐릭터, 비율, 지난주 대비와 주차 휠을 둔다', async () => {
  await open({ contentKey: 'michaela', week: LAST_CLOSED_WEEK })

  expect(panel('컨텐츠')?.textContent).toBe(
    '레이드 · 출시 2026-08-06무너진 성자 미카엘라하드일반클리어 캐릭터57클리어 비율5.7%지난주 대비▼ 0.4%p13주차14주차15주차집계 중'
  )
})

it('단계를 고르면 그 단계를 알리고, 고른 단계의 컨텐츠 집계를 받아 컨텐츠 줄을 그 단계 값으로 바꾼다', async () => {
  const onStageSelect = vi.fn()
  await open({ contentKey: 'michaela', onStageSelect })
  expect(contentRequests()).toEqual([`/stats/clears/michaela-hard?week=${LATEST_WEEK}`])

  await click(buttonNamed('일반'))
  expect(onStageSelect).toHaveBeenCalledWith('normal')

  await open({ contentKey: 'michaela', stage: 'normal' })
  expect(contentRequests()).toEqual([
    `/stats/clears/michaela-hard?week=${LATEST_WEEK}`,
    `/stats/clears/michaela-normal?week=${LATEST_WEEK}`
  ])
  expect(panel('컨텐츠')?.textContent).toContain('클리어 캐릭터100클리어 비율10.0%')
})

it('휠의 이전 주를 누르면 그 주를 고른다', async () => {
  const onWeekSelect = vi.fn()
  await open({ contentKey: 'michaela', onWeekSelect })

  await click(buttonNamed('14주차'))

  expect(onWeekSelect).toHaveBeenCalledWith(LAST_CLOSED_WEEK)
})

it('일반과 하드가 있는 레이드는 상세 카드를 모두 두고, 클리어가 있는 배율이 둘 이상인 주에만 배율별 클리어를 둔다', async () => {
  await open({ contentKey: 'michaela', week: LAST_CLOSED_WEEK })

  expect(panelNames()).toEqual([
    '컨텐츠',
    '주차별 클리어',
    '명성 구간',
    '지난주 대비 이동',
    '클리어 캐릭터의 명성',
    '연속 클리어 주 수',
    '클리어 요일과 시간대',
    '배율별 클리어',
    '모험단 기준 클리어 횟수',
    '전직별 클리어'
  ])

  await open({ contentKey: 'michaela', week: LATEST_WEEK })
  expect(panelNames()).not.toContain('배율별 클리어')

  await open({ contentKey: 'michaela', week: PREVIOUS_WEEK })
  expect(panelNames()).not.toContain('배율별 클리어')

  await open({ contentKey: 'michaela', stage: 'normal', week: LAST_CLOSED_WEEK })
  expect(panelNames()).not.toContain('배율별 클리어')
})

it('이동 집계가 없는 레이드는 이동 생키 대신 지난주 대비 이탈과 복귀 카드를 둔다', async () => {
  await open({ contentKey: 'inae' })

  expect(panelNames()).toContain('지난주 대비 이탈과 복귀')
  expect(panelNames()).not.toContain('지난주 대비 이동')
  expect(panel('지난주 대비 이탈과 복귀')?.querySelector('dl')?.textContent).toBe(
    '이탈21복귀7신규10'
  )
})

it('일반과 하드가 있는 레이드에 그 주 이동이 없으면 2행에 이동 생키도 이탈과 복귀 카드도 두지 않는다', async () => {
  await open(
    { contentKey: 'michaela', week: LAST_CLOSED_WEEK },
    {
      contentStats: (contentId, weekStart) =>
        HttpResponse.json({ ...statsOf(contentId, weekStart), weekMoves: [] })
    }
  )

  expect(panelNames()).not.toContain('지난주 대비 이동')
  expect(panelNames()).not.toContain('지난주 대비 이탈과 복귀')
})

it('챌린지는 미션 선택을 두고, 응답에 없는 지난주 대비, 이동, 연속 클리어 주 수, 그룹별 명성 카드와 응답에 있는 클리어 요일과 시간대 카드를 두지 않는다', async () => {
  await open({ contentKey: 'nightmare' })

  expect(container.querySelector('[aria-label="단계"]')?.textContent).toBe('죽음을 딛고 선 자')
  expect(panelNames()).toEqual([
    '컨텐츠',
    '주차별 클리어',
    '명성 구간',
    '모험단 기준 클리어 횟수',
    '전직별 클리어'
  ])
})

it('주차별 클리어는 레이드면 다시 클리어와 신규 막대를, 챌린지면 신규 막대만 두고 한 번이라도 깬 캐릭터 비율 선을 둔다', async () => {
  await open({ contentKey: 'michaela' })
  expect(legendNames('주차별 클리어')).toEqual([
    '다시 클리어',
    '신규',
    '한 번이라도 깬 캐릭터 비율'
  ])

  await open({ contentKey: 'nightmare' })
  expect(legendNames('주차별 클리어')).toEqual(['신규', '한 번이라도 깬 캐릭터 비율'])
})

it('지난주 대비 이동은 지난주 하드, 일반, 싱글/매칭, 복귀, 신규에서 이번 주 하드, 일반, 싱글/매칭, 이탈로 가는 수를 노드마다 적는다', async () => {
  await open({ contentKey: 'michaela', week: LAST_CLOSED_WEEK })

  const labels = [...(panel('지난주 대비 이동')?.querySelectorAll('svg text') ?? [])].map(
    (text) => text.textContent
  )
  expect(labels).toEqual([
    '13주차',
    '14주차',
    '하드',
    '54',
    '일반',
    '118',
    '싱글/매칭',
    '37',
    '복귀',
    '9',
    '신규',
    '4',
    '하드',
    '57',
    '일반',
    '102',
    '싱글/매칭',
    '38',
    '이탈',
    '25'
  ])
})

it('클리어 캐릭터의 명성은 분포가 있는 그룹만 둔다', async () => {
  await open({ contentKey: 'michaela' })

  const names = [
    ...(panel('클리어 캐릭터의 명성')?.querySelectorAll('li > span:first-child') ?? [])
  ].map((name) => name.firstChild?.textContent)
  expect(names).toEqual(['잔존', '이탈', '신규'])
})

it('모험단 기준 클리어 횟수는 16명까지 1명씩, 17명부터 구간으로 묶고 50명 이상을 한 칸에 센다', async () => {
  await open({ contentKey: 'michaela' })

  const columns = await columnTooltips('모험단 기준 클리어 횟수')
  expect(columns).toHaveLength(22)
  expect(columns.at(15)).toMatch(/^16명3 /)
  expect(columns.at(16)).toMatch(/^17~19명6 /)
  expect(columns.at(17)).toMatch(/^20~24명5 /)
  expect(columns.at(18)).toMatch(/^25~29명8 /)
  expect(columns.at(19)).toMatch(/^30~39명1 /)
  expect(columns.at(20)).toMatch(/^40~49명2 /)
  expect(columns.at(21)).toMatch(/^50명 이상10 /)
})

it('모험단 기준 클리어 횟수는 1~5명과 6명 이상을 나눠 각 묶음의 가장 큰 칸에 막대 높이를 맞추고 비율은 전체 기준으로 둔다', async () => {
  await open({ contentKey: 'michaela' })

  const box = panel('모험단 기준 클리어 횟수')!
  const heights = [...box.querySelectorAll('li:not([aria-hidden])')].map((column) =>
    column.querySelector('[data-chart-mark]')?.getAttribute('style')
  )

  expect(heights[0]).toContain('100%')
  expect(heights[15]).toContain('30%')
  expect(heights[21]).toContain('100%')

  const columns = await columnTooltips('모험단 기준 클리어 횟수')
  expect(columns.at(0)).toMatch(/^1명40 +53\.3%$/)
})

it('전직별 클리어는 클리어율 순 10줄에 분포와 클리어율을 두고, 정렬을 바꾸거나 모두 볼 수 있다', async () => {
  await open({ contentKey: 'michaela' })

  const first = panel('전직별 클리어')?.querySelector('tbody tr')
  expect([...(first?.children ?? [])].map((cell) => cell.textContent)).toEqual([
    '전직6',
    '',
    '50.0%'
  ])
  expect(jobNames()).toHaveLength(10)

  await click(buttonNamed('클리어 순'))
  expect(jobNames()[0]).toBe('전직11')

  await click(buttonNamed('명성 순'))
  expect(jobNames()[0]).toBe('전직5')

  await click(buttonNamed('전직 12개 모두 보기'))
  expect(jobNames()).toHaveLength(12)
})

it('전직별 클리어는 眞 각성 전 전직을 클리어율이 가장 높아도 두지 않는다', async () => {
  await open(
    { contentKey: 'michaela' },
    {
      contentStats: (contentId, weekStart) => {
        const stats = statsOf(contentId, weekStart)
        const unawakened = { ...job(12, 2, 2, 120000), jobName: '나이트', jobGrowName: '나이트' }

        return HttpResponse.json({ ...stats, jobs: [...stats.jobs, unawakened] })
      }
    }
  )

  await click(buttonNamed('전직 12개 모두 보기'))

  expect(jobNames()).toHaveLength(12)
  expect(jobNames()).not.toContain('나이트')
})

it('전직별 클리어 줄에 마우스를 올리면 전직명 아래 클리어 / 캐릭터 수와 분포 값 여섯 개를 띄운다', async () => {
  await open({ contentKey: 'michaela' })

  const row = panel('전직별 클리어')?.querySelector('tbody tr')
  await act(async () => {
    row?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }))
  })

  const tooltip = panel('전직별 클리어')?.querySelector('span[aria-hidden="true"]')
  const lines = [...(tooltip?.lastElementChild?.children ?? [])].map((line) => line.textContent)
  expect(tooltip?.firstElementChild?.textContent).toBe('전직6')
  expect(lines).toEqual([
    '클리어 / 캐릭터 수25 / 50',
    '최고140,000',
    '95%132,000',
    '75%126,000',
    '중앙값120,006',
    '25%118,000',
    '5%110,000'
  ])
})

it('컨텐츠 집계가 실패하면 컨텐츠 줄 아래 오류 한 줄을 둔다', async () => {
  await open(
    { contentKey: 'michaela' },
    {
      contentStats: () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_SERVER_ERROR', message: '집계를 불러오지 못했습니다.' } },
          { status: 500 }
        )
    }
  )

  expect(panelNames()).toEqual(['컨텐츠'])
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('집계를 불러오지 못했습니다.')
})

const equipment = { p5: 280000, p25: 310000, median: 330000, p75: 350000, p95: 380000, max: 420000 }
const buff = { p5: 120000, p25: 140000, median: 150000, p75: 160000, p95: 180000, max: 200000 }

function scoredStatsOf(contentId: string, weekStart: string): ClearContentStats {
  const base = statsOf(contentId, weekStart)
  const scores = { equipment, buff }
  const weekOverWeek = {
    both: { ...RAID_WEEK_OVER_WEEK.both, scores },
    returned: { ...RAID_WEEK_OVER_WEEK.returned, scores },
    left: { ...RAID_WEEK_OVER_WEEK.left, scores },
    first: { ...RAID_WEEK_OVER_WEEK.first, scores }
  }

  return {
    ...base,
    jobs: base.jobs.map((item) => ({ ...item, scores: { equipment, buff: null } })),
    weekOverWeek,
    scoreBands: {
      equipment: [
        { score: 300000, population: 50, cleared: 10 },
        { score: 350000, population: 400, cleared: 40 }
      ],
      buff: [{ score: 150000, population: 50, cleared: 5 }]
    }
  }
}

function panelTicks(name: string): string[] {
  return [...(panel(name)?.querySelectorAll('svg text') ?? [])].map(
    (text) => text.textContent ?? ''
  )
}

it('점수가 있으면 그룹별 장비 점수와 장비 점수 구간별 클리어율을 시안 자리에 둔다', async () => {
  await open(
    { contentKey: 'michaela', week: LAST_CLOSED_WEEK },
    {
      contentStats: (contentId, weekStart) => HttpResponse.json(scoredStatsOf(contentId, weekStart))
    }
  )

  expect(panelNames()).toEqual([
    '컨텐츠',
    '주차별 클리어',
    '명성 구간',
    '지난주 대비 이동',
    '클리어 캐릭터의 명성',
    '클리어 캐릭터의 장비 점수',
    '연속 클리어 주 수',
    '클리어 요일과 시간대',
    '배율별 클리어',
    '장비 점수 구간별 클리어율',
    '모험단 기준 클리어 횟수',
    '전직별 클리어'
  ])
})

it('그룹별 장비 점수는 장비와 버프를 바꾸면 축이 그 점수 기준으로 바뀐다', async () => {
  await open(
    { contentKey: 'michaela' },
    {
      contentStats: (contentId, weekStart) => HttpResponse.json(scoredStatsOf(contentId, weekStart))
    }
  )

  expect(panelTicks('클리어 캐릭터의 장비 점수')).toContain('30만')

  await click(
    panel('클리어 캐릭터의 장비 점수')!.querySelector('[aria-label="점수 종류"] button:last-child')!
  )

  expect(panelTicks('클리어 캐릭터의 장비 점수')).toContain('14만')
})

it('장비 점수 구간별 클리어율은 클리어 수가 아니라 그 구간 캐릭터 가운데 클리어한 비율로 막대 높이를 둔다', async () => {
  await open(
    { contentKey: 'michaela' },
    {
      contentStats: (contentId, weekStart) => HttpResponse.json(scoredStatsOf(contentId, weekStart))
    }
  )

  const columns = [...(panel('장비 점수 구간별 클리어율')?.querySelectorAll('li') ?? [])]
  expect(await columnTooltips('장비 점수 구간별 클리어율')).toEqual([
    '300,000~10  20.0%',
    '350,000~40  10.0%'
  ])
  const heights = columns.map((column) =>
    column.querySelector('[data-chart-mark]')?.getAttribute('style')
  )
  expect(heights[0]).toContain('100%')
  expect(heights[1]).toContain('50%')
})

it('장비 점수 구간별 클리어율은 캐릭터가 5% 이상 처음 몰리는 구간 아래를 한 막대로 접고 그 위는 사람이 적어도 구간마다 그린다', async () => {
  await open(
    { contentKey: 'michaela' },
    {
      contentStats: (contentId, weekStart) => {
        const stats = scoredStatsOf(contentId, weekStart)
        const equipment = [
          { score: 0, population: 10, cleared: 1 },
          { score: 50000, population: 10, cleared: 0 },
          { score: 300000, population: 900, cleared: 90 },
          { score: 350000, population: 70, cleared: 35 },
          { score: 400000, population: 10, cleared: 10 }
        ]

        return HttpResponse.json({ ...stats, scoreBands: { ...stats.scoreBands, equipment } })
      }
    }
  )

  expect(await columnTooltips('장비 점수 구간별 클리어율')).toEqual([
    '~300,0001  5.0%',
    '300,000~90  10.0%',
    '350,000~35  50.0%',
    '400,000~10  100.0%'
  ])
})

it('전직 표는 전직 점수가 있으면 명성, 장비 점수 전환을 두고 장비 점수로 바꾸면 그 축을 쓴다', async () => {
  await open(
    { contentKey: 'michaela' },
    {
      contentStats: (contentId, weekStart) => HttpResponse.json(scoredStatsOf(contentId, weekStart))
    }
  )

  await click(buttonNamed('장비 점수'))

  const head = panel('전직별 클리어')?.querySelector('thead')
  expect(head?.textContent).toContain('클리어 캐릭터의 장비 점수')
  expect(head?.textContent).toContain('30만')
})

it('점수가 없으면 점수 카드와 전직 표의 전환을 두지 않는다', async () => {
  await open({ contentKey: 'michaela' })

  expect(panelNames()).not.toContain('클리어 캐릭터의 장비 점수')
  expect(panelNames()).not.toContain('장비 점수 구간별 클리어율')
  expect(panel('전직별 클리어')?.querySelector('[aria-label="분포"]')).toBeNull()
})

it('레기온 상세는 단계 선택 없이 컨텐츠 줄만 두고 레기온 집계를 받는다', async () => {
  await open({ contentKey: 'apocalypse' })

  expect(contentRequests()).toEqual([`/stats/clears/legion-apocalypse?week=${LATEST_WEEK}`])
  expect(container.querySelector('[aria-label="단계"]')).toBeNull()
  expect(panel('컨텐츠')?.textContent).toContain('레기온 · 출시 2026-04-23아포칼립스')
  expect(
    cardButtons().find((card) => card.getAttribute('aria-pressed') === 'true')?.textContent
  ).toMatch(/^레기온아포칼립스/)
})
