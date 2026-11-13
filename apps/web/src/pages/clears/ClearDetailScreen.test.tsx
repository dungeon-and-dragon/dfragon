// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type {
  ClearContent,
  ClearContentStats,
  ClearJob,
  ClearStats,
  ClearWeek
} from '#core/ranking/clear-stats'
import { type ClientHost, ClientHostContext } from '../../host/client-host'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { ClearDetailScreen } from './ClearDetailScreen'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
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
  vi.unstubAllGlobals()
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
    collectedAt: '2026-11-13T22:39:00.000Z',
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
    week(PREVIOUS_WEEK, 61),
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

const stats: ClearStats = { contents: [inae, michaelaNormal, michaelaHard, nightmare] }

const fame = { p5: 110000, p25: 118000, median: 122000, p75: 126000, p95: 132000, max: 140000 }

function job(index: number, population: number, cleared: number, median: number): ClearJob {
  return {
    jobId: `job-${index}`,
    jobGrowId: `grow-${index}`,
    jobName: `직업${index}`,
    jobGrowName: `眞 전직${index}`,
    population,
    cleared,
    fame: { ...fame, median }
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
  both: { cleared: 40, fame },
  returned: { cleared: 7, fame: null },
  left: { cleared: 21, fame },
  first: { cleared: 10, fame }
}

const MICHAELA_STAGE_MOVES = {
  hard: { same: 40, other: 9, none: 8 },
  normal: { same: 90, other: 6, none: 10 }
}

const RAID_STREAKS = [
  { weeks: 1, characters: 20 },
  { weeks: 2, characters: 37 }
]

function statsOf(contentId: string, weekStart: string): ClearContentStats {
  const { weeks, ...header } = stats.contents.find(({ id }) => id === contentId)!
  const raid = header.kind === 'raid'
  const selected = weeks.find((candidate) => candidate.weekStart === weekStart) ?? null
  const weekOverWeek = raid ? RAID_WEEK_OVER_WEEK : null
  const stageMoves = contentId.startsWith('michaela') ? MICHAELA_STAGE_MOVES : null
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
      { characters: 30, adventures: 1 }
    ],
    weeklyClears: weeks.map((item) => ({
      weekStart: item.weekStart,
      population: item.population,
      firstCleared: 5,
      repeatCleared: item.cleared - 5,
      everCleared: 100
    })),
    fameBands: [
      { fame: 104000, population: 500, cleared: 10 },
      { fame: 106000, population: 400, cleared: 40 }
    ],
    weekOverWeek,
    stageMoves,
    streaks,
    weekdays,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, cleared: hour }))
  }
}

type Loaders = Partial<Pick<ClientHost, 'getClearStats' | 'getClearContentStats'>>

type Props = Readonly<{
  contentKey: string
  stage?: string
  week?: string
  onStageSelect?: (stage: string) => void
  onWeekSelect?: (weekStart: string) => void
  onContentOpen?: (contentKey: string) => void
}>

function render(
  {
    contentKey,
    stage,
    week: weekStart,
    onStageSelect = () => {},
    onWeekSelect = () => {},
    onContentOpen = () => {}
  }: Props,
  {
    getClearStats = async () => stats,
    getClearContentStats = vi.fn(async (contentId: string, selected: string | undefined) =>
      statsOf(contentId, selected ?? LATEST_WEEK)
    )
  }: Loaders = {}
): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost({ getClearStats, getClearContentStats })}>
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
      </ClientHostContext>
    )
  )
}

function panelNames(): string[] {
  return [...container.querySelectorAll('section[aria-label]')].map(
    (section) => section.getAttribute('aria-label') ?? ''
  )
}

function panel(name: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)
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

it('받는 중에는 제목 줄만 둔다', async () => {
  await render({ contentKey: 'michaela' }, { getClearStats: () => new Promise<never>(() => {}) })

  expect(container.querySelector('h1')?.textContent).toBe('클리어 집계')
  expect(panelNames()).toEqual([])
})

it('모르는 컨텐츠 주소는 제목 줄 아래 한 줄만 둔다', async () => {
  await render({ contentKey: 'unknown' })

  expect(container.textContent).toBe('클리어 집계수집 기록이 없습니다.')
})

it('고른 컨텐츠 카드를 눌린 상태로 두고, 고른 카드나 다른 카드를 누르면 그 컨텐츠 묶음을 알린다', async () => {
  const onContentOpen = vi.fn()
  await render({ contentKey: 'michaela', onContentOpen })

  const pressed = cardButtons().map((card) => card.getAttribute('aria-pressed'))
  expect(pressed).toEqual(['false', 'true', 'false'])

  await click(cardButtons()[1]!)
  expect(onContentOpen).toHaveBeenLastCalledWith('michaela')
  await click(cardButtons()[0]!)
  expect(onContentOpen).toHaveBeenLastCalledWith('nightmare')
})

it('컨텐츠 줄에 종류와 출시일, 이름, 단계, 클리어 캐릭터, 비율, 지난주 대비와 주차 휠을 둔다', async () => {
  await render({ contentKey: 'michaela', week: LAST_CLOSED_WEEK })

  expect(panel('컨텐츠')?.textContent).toBe(
    '레이드 · 출시 2026-08-06무너진 성자 미카엘라하드일반클리어 캐릭터57클리어 비율5.7%지난주 대비▼ 0.4%p13주차14주차15주차집계 중'
  )
})

it('단계를 고르면 그 단계를 알리고, 고른 단계의 컨텐츠 집계를 받아 컨텐츠 줄을 그 단계 값으로 바꾼다', async () => {
  const onStageSelect = vi.fn()
  const getClearContentStats = vi.fn(async (contentId: string, selected: string | undefined) =>
    statsOf(contentId, selected ?? LATEST_WEEK)
  )
  await render({ contentKey: 'michaela', onStageSelect }, { getClearContentStats })
  expect(getClearContentStats).toHaveBeenLastCalledWith('michaela-hard', LATEST_WEEK)

  await click(buttonNamed('일반'))
  expect(onStageSelect).toHaveBeenCalledWith('normal')

  await render({ contentKey: 'michaela', stage: 'normal' }, { getClearContentStats })
  expect(getClearContentStats).toHaveBeenLastCalledWith('michaela-normal', LATEST_WEEK)
  expect(panel('컨텐츠')?.textContent).toContain('클리어 캐릭터100클리어 비율10.0%')
})

it('휠의 이전 주를 누르면 그 주를 고른다', async () => {
  const onWeekSelect = vi.fn()
  await render({ contentKey: 'michaela', onWeekSelect })

  await click(buttonNamed('14주차'))

  expect(onWeekSelect).toHaveBeenCalledWith(LAST_CLOSED_WEEK)
})

it('일반과 하드가 있는 레이드는 상세 카드를 모두 두고, 배율 클리어가 한 번이라도 있는 컨텐츠에만 배율별 클리어를 둔다', async () => {
  await render({ contentKey: 'michaela', week: LAST_CLOSED_WEEK })

  expect(panelNames()).toEqual([
    '컨텐츠',
    '주차별 클리어',
    '명성 구간',
    '지난주 대비 이탈과 복귀',
    '일반과 하드 사이 이동',
    '클리어 캐릭터의 명성',
    '연속 클리어 주 수',
    '클리어 요일과 시간대',
    '배율별 클리어',
    '모험단당 클리어 캐릭터',
    '전직별 클리어'
  ])

  await render({ contentKey: 'michaela', week: LATEST_WEEK })
  expect(panelNames()).toContain('배율별 클리어')

  await render({ contentKey: 'michaela', stage: 'normal', week: LAST_CLOSED_WEEK })
  expect(panelNames()).not.toContain('배율별 클리어')
})

it('이동 집계가 없는 레이드는 일반과 하드 이동 카드를 두지 않는다', async () => {
  await render({ contentKey: 'inae' })

  expect(panelNames()).toContain('지난주 대비 이탈과 복귀')
  expect(panelNames()).not.toContain('일반과 하드 사이 이동')
})

it('챌린지는 미션 선택을 두고, 응답에 없는 지난주 대비, 이동, 연속 클리어 주 수, 그룹별 명성 카드를 두지 않는다', async () => {
  await render({ contentKey: 'nightmare' })

  expect(container.querySelector('[aria-label="단계"]')?.textContent).toBe('죽음을 딛고 선 자')
  expect(panelNames()).toEqual([
    '컨텐츠',
    '주차별 클리어',
    '명성 구간',
    '클리어 요일과 시간대',
    '모험단당 클리어 캐릭터',
    '전직별 클리어'
  ])
})

it('지난주 대비는 이탈, 복귀, 첫 클리어 수와 두 주의 분할 막대를 두고, 이동은 두 방향의 수를 둔다', async () => {
  await render({ contentKey: 'michaela', week: LAST_CLOSED_WEEK })

  const weekOverWeek = panel('지난주 대비 이탈과 복귀')
  expect(weekOverWeek?.querySelector('dl')?.textContent).toBe('이탈21복귀7첫 클리어10')
  expect(weekOverWeek?.textContent).toContain('13주차61')
  expect(weekOverWeek?.textContent).toContain('14주차57')
  const moves = panel('일반과 하드 사이 이동')
  expect(moves?.querySelector('dl')?.textContent).toBe('일반에서 하드로9하드에서 일반으로6')
  expect(moves?.textContent).toContain('14주차 하드57')
  expect(moves?.textContent).toContain('14주차 일반106')
})

it('클리어 캐릭터의 명성은 분포가 있는 그룹만 둔다', async () => {
  await render({ contentKey: 'michaela' })

  const names = [
    ...(panel('클리어 캐릭터의 명성')?.querySelectorAll('li > span:first-child') ?? [])
  ].map((name) => name.firstChild?.textContent)
  expect(names).toEqual(['두 주 모두 클리어', '이탈', '첫 클리어'])
})

it('모험단당 클리어 캐릭터는 1명부터 16명과 17명 이상으로 센다', async () => {
  await render({ contentKey: 'michaela' })

  const columns = [...(panel('모험단당 클리어 캐릭터')?.querySelectorAll('li') ?? [])].map(
    (column) => column.querySelector('span')?.textContent
  )
  expect(columns).toHaveLength(17)
  expect(columns.at(15)).toMatch(/^16명 3 /)
  expect(columns.at(16)).toMatch(/^17명 이상 3 /)
})

it('전직별 클리어는 클리어율 순 10줄에 클리어 / 캐릭터 수와 클리어율을 두고, 정렬을 바꾸거나 모두 볼 수 있다', async () => {
  await render({ contentKey: 'michaela' })

  const first = panel('전직별 클리어')?.querySelector('tbody tr')
  expect([...(first?.children ?? [])].map((cell) => cell.textContent)).toEqual([
    '眞 전직6 직업6',
    '25 / 50',
    '중앙값 120,006',
    '50.0%'
  ])
  expect(jobNames()).toHaveLength(10)

  await click(buttonNamed('클리어 순'))
  expect(jobNames()[0]).toBe('眞 전직11')

  await click(buttonNamed('명성 순'))
  expect(jobNames()[0]).toBe('眞 전직5')

  await click(buttonNamed('전직 12개 모두 보기'))
  expect(jobNames()).toHaveLength(12)
})

it('컨텐츠 집계가 실패하면 컨텐츠 줄 아래 오류 한 줄을 둔다', async () => {
  await render(
    { contentKey: 'michaela' },
    {
      getClearContentStats: async () => {
        throw new Error('집계를 불러오지 못했습니다.')
      }
    }
  )

  expect(panelNames()).toEqual(['컨텐츠'])
  expect(container.querySelector('[role="alert"]')?.textContent).toBe('집계를 불러오지 못했습니다.')
})
