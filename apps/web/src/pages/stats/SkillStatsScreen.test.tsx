// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { skillWindowHandlers } from '#entities/catalog/api/skill-window.handlers'
import { RANKING_JOBS } from '#entities/character'
import type { FameRankingFilter, SkillStats } from '#entities/ranking'
import { SKILL_STATS_URL, skillStatsHandlers } from '#entities/ranking/api/skill-stats.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { skillStatsCatalogFixture, skillStatsFixture } from './api/skill-stats.fixture'
import { SkillStatsScreen } from './SkillStatsScreen'

const MARK_FILE = /(evolution|enhancement)-\d/

let container: HTMLDivElement
let root: Root
let requests: URL[]

function recordRequest({ request }: { request: Request }): void {
  requests.push(new URL(request.url))
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  requests = []
  server.events.on('request:start', recordRequest)
  server.use(...skillWindowHandlers([skillStatsCatalogFixture]))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  server.events.removeListener('request:start', recordRequest)
  vi.unstubAllGlobals()
})

const SWORDMAN = RANKING_JOBS.find((job) => job.name === '귀검사(남)')!
const WEAPON_MASTER = SWORDMAN.grows.find((grow) => grow.name === '웨펀마스터')!
const WEAPON_MASTER_FILTER: FameRankingFilter = {
  jobId: SWORDMAN.jobId,
  jobGrowId: WEAPON_MASTER.jobGrowId
}

async function render(filter: FameRankingFilter): Promise<void> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <SkillStatsScreen filter={filter} onFilterChange={vi.fn()} />
        </TestRouter>
      </TestQueryClient>
    )
  )
}

async function renderStats(stats: SkillStats): Promise<void> {
  server.use(skillStatsHandlers.of(stats))
  await render(WEAPON_MASTER_FILTER)
  await vi.waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
}

function skillRequests(): string[] {
  return requests.filter((url) => url.href.startsWith(SKILL_STATS_URL)).map(({ search }) => search)
}

type SkillCell = Readonly<{
  level: string
  dim: boolean
  marks: string[]
  picked: boolean
}>

function cellOf(name: string): SkillCell {
  const window = container.querySelector('[role="group"][aria-label="스킬 창"]')!
  const icon = window.querySelector(`[role="img"][aria-label="${name}"]`)
  const trigger = icon?.closest('[data-skill-id]')
  if (icon == null || trigger == null) {
    throw new Error(`${name} 아이콘이 없다`)
  }

  const marks = [...trigger.querySelectorAll('img')].map(
    (img) => img.src.match(MARK_FILE)?.[0] ?? img.src
  )

  const level = trigger.lastElementChild?.textContent ?? ''
  const dim = icon.className.includes('opacity-30')
  const picked = icon.parentElement?.className.includes('outline-signal') ?? false

  return { level, dim, marks, picked }
}

function chainPanel(): HTMLElement {
  return container.querySelector('section[aria-label="스킬 체인"]')!
}

function chainRows(): [string[], string][] {
  return [...chainPanel().querySelectorAll('li')].map((row) => {
    const cells = [...row.firstElementChild!.children].filter((cell) => cell.tagName === 'SPAN')
    const names = cells.map(
      (cell) => cell.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '빈 칸'
    )

    return [names, row.lastElementChild?.textContent ?? '']
  })
}

async function tooltipOf(name: string): Promise<Element> {
  const trigger = container
    .querySelector(`[role="group"] [role="img"][aria-label="${name}"]`)
    ?.closest('[data-skill-id]')

  await act(async () => {
    trigger?.dispatchEvent(new MouseEvent('mouseenter'))
  })

  return vi.waitFor(() => {
    const popup = document.querySelector('[data-base-ui-portal] > [data-open]')
    if (popup === null) {
      throw new Error('Tooltip이 열리지 않았다')
    }

    return popup
  })
}

it('전직을 고르기 전에는 통계를 받지 않고 전직을 고르라는 한 줄만 보인다', async () => {
  await render({ jobId: SWORDMAN.jobId })

  expect(container.querySelector('p.state')?.textContent).toBe('전직을 고르세요.')
  expect(container.querySelector('[aria-label="스킬 창"]')).toBeNull()
  expect(skillRequests()).toEqual([])
})

it('스킬마다 가장 많이 찍은 레벨을 보이고, 수가 같으면 높은 레벨을 고른다', async () => {
  await renderStats(skillStatsFixture)

  expect(skillRequests()).toEqual([`?jobId=${SWORDMAN.jobId}&jobGrowId=${WEAPON_MASTER.jobGrowId}`])
  expect(cellOf('류심 충').level).toBe('30')
  expect(cellOf('발도').level).toBe('20')
  expect(cellOf('도약').level).toBe('1')
})

it('배운 표본이 20% 미만이거나 응답에 없는 스킬은 흐리게 두고 레벨을 비운다', async () => {
  await renderStats(skillStatsFixture)

  expect(cellOf('크리티컬 히트')).toEqual({ level: '', dim: true, marks: [], picked: false })
  expect(cellOf('환영검무')).toEqual({ level: '', dim: true, marks: [], picked: false })
  expect(cellOf('류심').dim).toBe(false)
})

it('배운 표본의 절반 이상이 고른 개화, 강화 갈래만 표식과 선택 테두리를 그린다', async () => {
  await renderStats(skillStatsFixture)

  expect(cellOf('발도')).toMatchObject({ marks: ['evolution-1'], picked: true })
  expect(cellOf('차지 크래시')).toMatchObject({ marks: ['enhancement-2'], picked: true })
  expect(cellOf('맹룡단공참')).toMatchObject({ marks: [], picked: false })
})

it('스킬 체인은 응답 순서대로 조합마다 아이콘 4칸과 체인 표본 대비 비율을 보이고 비운 칸은 빈 칸으로 둔다', async () => {
  await renderStats(skillStatsFixture)

  expect(chainRows()).toEqual([
    [['류심 쾌', '류심 승', '류심 충', '빈 칸'], '32.4%'],
    [['류심 쾌', '류심 승', '류심 충', '차지 크래시'], '11.6%'],
    [['류심', '류심 쾌', '류심 승', '류심 충'], '4.2%'],
    [['빈 칸', '류심 쾌', '류심 승', '류심 충'], '2.4%'],
    [['류심 승', '류심 충', '류심 쾌', '빈 칸'], '0.8%']
  ])
})

it('스킬 Tooltip은 채택률과 레벨 분포를 보이고 레벨 분포에 점을 찍지 않는다', async () => {
  await renderStats(skillStatsFixture)

  const tooltip = await tooltipOf('발도')

  expect(tooltip.textContent).toContain('채택률90.0%')
  expect(tooltip.querySelector('polyline')).not.toBeNull()
  expect(tooltip.querySelector('[data-current-level]')).toBeNull()
})

it('표본이 20명 미만이면 스킬 창의 레벨, 흐림, 표식을 모두 빼고 체인 자리에 표본 부족을 알린다', async () => {
  await renderStats({ ...skillStatsFixture, sampleSize: 19 })

  for (const name of ['크리티컬 히트', '발도', '차지 크래시', '환영검무']) {
    expect(cellOf(name), name).toEqual({ level: '', dim: false, marks: [], picked: false })
  }
  expect(chainPanel().textContent).toBe('스킬 체인표본이 20명 미만입니다.')
  expect((await tooltipOf('발도')).textContent).toBe('발도')
})

it('체인 표본만 20명 미만이면 스킬 창은 그대로 두고 체인 자리에 표본 부족을 알린다', async () => {
  await renderStats({ ...skillStatsFixture, chainSampleSize: 19 })

  expect(cellOf('발도').level).toBe('20')
  expect(chainPanel().textContent).toBe('스킬 체인표본이 20명 미만입니다.')
})

it('체인 조합이 없으면 체인 자리에 조합이 없다고 보인다', async () => {
  await renderStats({ ...skillStatsFixture, chains: [] })

  expect(chainPanel().textContent).toBe('스킬 체인스킬 체인 조합이 없습니다.')
})

it('통계를 계산한 적이 없으면 통계가 없다고 보이고, 받지 못하면 다른 통계 탭과 같은 실패 표시를 보인다', async () => {
  await renderStats({ ...skillStatsFixture, computedAt: null })

  expect(container.querySelector('p.state')?.textContent).toBe('스킬 통계가 없습니다.')
  expect(container.querySelector('[aria-label="스킬 창"]')).toBeNull()

  await act(async () => root.unmount())
  root = createRoot(container)
  server.use(skillStatsHandlers.failure)
  await render(WEAPON_MASTER_FILTER)

  await vi.waitFor(() =>
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      '스킬 통계를 받지 못했습니다.'
    )
  )
})

it('남성 크루세이더는 고른 역할을 함께 보내 그 역할의 통계를 받는다', async () => {
  const crusader = RANKING_JOBS.find((job) => job.grows.some((grow) => grow.role === 'buffer'))!
  const buffer = crusader.grows.find((grow) => grow.role === 'buffer')!
  server.use(http.get(SKILL_STATS_URL, () => HttpResponse.json(skillStatsFixture)))
  await render({ jobId: crusader.jobId, jobGrowId: buffer.jobGrowId, role: 'buffer' })

  await vi.waitFor(() =>
    expect(skillRequests()).toEqual([
      `?jobId=${crusader.jobId}&jobGrowId=${buffer.jobGrowId}&role=buffer`
    ])
  )
})
