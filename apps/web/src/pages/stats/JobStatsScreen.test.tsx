// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { skillWindowHandlers } from '#entities/catalog/api/skill-window.handlers'
import { RANKING_JOBS } from '#entities/character'
import type { SetStatsFilter, SkillStats } from '#entities/ranking'
import { storyItemStats } from '#entities/ranking/api/item-stats.fixture'
import { ITEM_STATS_URL, itemStatsHandlers } from '#entities/ranking/api/item-stats.handlers'
import { storySetStats } from '#entities/ranking/api/set-stats.fixture'
import { SET_STATS_URL, setStatsHandlers } from '#entities/ranking/api/set-stats.handlers'
import { SKILL_STATS_URL, skillStatsHandlers } from '#entities/ranking/api/skill-stats.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { skillStatsCatalogFixture, skillStatsFixture } from './api/skill-stats.fixture'
import { JobStatsScreen } from './JobStatsScreen'

const MARK_FILE = /(evolution|enhancement)-\d/
const COMPUTED_AT = '2026-11-28T15:00:00.000Z'
const SET_STATS = storySetStats(COMPUTED_AT)
const ITEM_STATS = storyItemStats(COMPUTED_AT)

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
  server.use(
    ...skillWindowHandlers([skillStatsCatalogFixture]),
    http.get(SET_STATS_URL, () => HttpResponse.json(SET_STATS)),
    http.get(ITEM_STATS_URL, () => HttpResponse.json(ITEM_STATS))
  )
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  server.events.removeListener('request:start', recordRequest)
  vi.unstubAllGlobals()
})

const SWORDMAN = RANKING_JOBS.find((job) => job.name === '귀검사(남)')!
const WEAPON_MASTER = SWORDMAN.grows.find((grow) => grow.name === '웨펀마스터')!
const WEAPON_MASTER_FILTER: SetStatsFilter = {
  jobId: SWORDMAN.jobId,
  jobGrowId: WEAPON_MASTER.jobGrowId
}

async function render(
  filter: SetStatsFilter,
  onFilterChange: (filter: SetStatsFilter) => void = vi.fn()
): Promise<void> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <JobStatsScreen filter={filter} onFilterChange={onFilterChange} />
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

function chips(): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')]
}

function chip(label: string): HTMLButtonElement | undefined {
  return chips().find((button) => button.textContent === label)
}

function pressedChips(): string[] {
  return chips()
    .filter((button) => button.hasAttribute('data-pressed'))
    .map((button) => button.textContent ?? '')
}

function requestsTo(apiUrl: string): string[] {
  return requests.filter((url) => url.href.startsWith(apiUrl)).map(({ search }) => search)
}

function skillRequests(): string[] {
  return requestsTo(SKILL_STATS_URL)
}

function box(name: string): HTMLElement {
  return container.querySelector(`section[aria-label="${name}"]`)!
}

type BarRow = Readonly<{ text: string; value: string; link: Record<string, string> }>

function barRows(name: string): BarRow[] {
  return [...box(name).querySelectorAll('li[data-chart-item]')].map((row) => {
    const value = row.querySelector('[data-chart-value]')?.textContent ?? ''
    const href = row.querySelector('a')?.getAttribute('href') ?? ''
    const url = new URL(href, 'https://dfragon.test')
    const params = Object.fromEntries(url.searchParams)
    const link = { path: url.pathname, ...params }

    return { text: row.textContent, value, link }
  })
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

function upgradeSection(heading: string): HTMLElement | null {
  return container.querySelector(`section[aria-label="${heading}"]`)
}

function upgradeRows(heading: string): [string, ...string[]][] {
  return [...upgradeSection(heading)!.querySelectorAll('li')].map((row) => {
    const name = row.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '빈 칸'
    const rates = [...row.querySelectorAll('img')].map(
      (img) => `${img.src.match(MARK_FILE)?.[0]} ${img.nextElementSibling?.textContent}`
    )

    return [name, ...rates]
  })
}

async function hover(trigger: Element | null | undefined): Promise<Element> {
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

async function leave(trigger: Element | null | undefined): Promise<void> {
  await act(async () => {
    trigger?.dispatchEvent(new MouseEvent('mouseleave'))
  })
  await vi.waitFor(() => {
    if (document.querySelector('[data-base-ui-portal] > [data-open]') !== null) {
      throw new Error('Tooltip이 닫히지 않았다')
    }
  })
}

function tooltipOf(name: string): Promise<Element> {
  const trigger = container
    .querySelector(`[role="group"] [role="img"][aria-label="${name}"]`)
    ?.closest('[data-skill-id]')

  return hover(trigger)
}

function upgradeMarkTrigger(
  heading: string,
  name: string,
  type: 1 | 2
): Element | null | undefined {
  const row = [...upgradeSection(heading)!.querySelectorAll('li')].find(
    (candidate) => candidate.querySelector(`[aria-label="${name}"]`) !== null
  )

  return row?.querySelectorAll('img')[type - 1]?.parentElement
}

it('주소에 고른 직업이 없으면 귀검사(남) 웨펀마스터를 고른 채로 스킬, 세트, 아이템 통계를 받고 직업 전체, 전직 전체 칩을 두지 않는다', async () => {
  server.use(skillStatsHandlers.of(skillStatsFixture))
  await render({})

  await vi.waitFor(() => expect(container.querySelector('[aria-label="스킬 창"]')).not.toBeNull())
  const weaponMaster = `?jobId=${SWORDMAN.jobId}&jobGrowId=${WEAPON_MASTER.jobGrowId}`
  expect(skillRequests()).toEqual([weaponMaster])
  expect(requestsTo(SET_STATS_URL)).toEqual([`${weaponMaster}&sample=all`])
  expect(requestsTo(ITEM_STATS_URL)).toEqual([`${weaponMaster}&sample=all`])
  expect(pressedChips()).toEqual(['귀검사(남)', '웨펀마스터', '전체'])
  expect(chip('직업 전체')).toBeUndefined()
  expect(chip('전직 전체')).toBeUndefined()
})

it('주소에 직업만 있으면 그 직업의 첫 전직 통계를 받고, 다른 직업을 고르면 그 직업의 첫 전직까지 넘긴다', async () => {
  const [, job, nextJob] = RANKING_JOBS.filter((candidate) =>
    candidate.grows.every((grow) => grow.role === undefined)
  )
  const onFilterChange = vi.fn()
  server.use(skillStatsHandlers.of(skillStatsFixture))
  await render({ jobId: job!.jobId }, onFilterChange)

  await vi.waitFor(() =>
    expect(skillRequests()).toEqual([`?jobId=${job!.jobId}&jobGrowId=${job!.grows[0]!.jobGrowId}`])
  )
  expect(pressedChips()).toEqual([job!.name, job!.grows[0]!.name, '전체'])

  await act(async () => chip(nextJob!.name)?.click())

  expect(onFilterChange).toHaveBeenLastCalledWith({
    jobId: nextJob!.jobId,
    jobGrowId: nextJob!.grows[0]!.jobGrowId
  })
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

it('표본이 20명 미만이면 스킬 창의 레벨, 흐림, 표식과 개화, 강화 비율을 모두 빼고 체인 자리에 표본 부족을 알린다', async () => {
  await renderStats({ ...skillStatsFixture, sampleSize: 19 })

  for (const name of ['크리티컬 히트', '발도', '차지 크래시', '환영검무']) {
    expect(cellOf(name), name).toEqual({ level: '', dim: false, marks: [], picked: false })
  }
  expect(chainPanel().textContent).toBe('스킬 체인표본이 20명 미만입니다.')
  expect(upgradeSection('스킬 개화')).toBeNull()
  expect(upgradeSection('스킬 강화')).toBeNull()
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

it('스킬 개화, 강화는 응답의 스킬마다 두 갈래 표식과 그 스킬을 배운 표본 대비 비율을 스킬 창의 줄 순서로 보인다', async () => {
  const [baldo, maengryong] = skillStatsFixture.evolutions
  const [chargeCrash, maengryongEnhancement] = skillStatsFixture.enhancements
  await renderStats({
    ...skillStatsFixture,
    evolutions: [maengryong!, baldo!, { name: '류심 충', type1: 0, type2: 0 }],
    enhancements: [maengryongEnhancement!, chargeCrash!]
  })

  expect(upgradeRows('스킬 개화')).toEqual([
    ['류심 충', 'evolution-1 0.0%', 'evolution-2 0.0%'],
    ['발도', 'evolution-1 55.6%', 'evolution-2 27.8%'],
    ['맹룡단공참', 'evolution-1 46.7%', 'evolution-2 43.3%']
  ])
  expect(upgradeRows('스킬 강화')).toEqual([
    ['차지 크래시', 'enhancement-1 33.3%', 'enhancement-2 53.3%'],
    ['맹룡단공참', 'enhancement-1 46.7%', 'enhancement-2 43.3%']
  ])
})

it('스킬 개화의 1번, 2번 표식에 마우스를 올리면 그 갈래의 개화 이름과 설명을 보이고, 스킬 강화 표식은 Tooltip이 없다', async () => {
  await renderStats(skillStatsFixture)

  const first = upgradeMarkTrigger('스킬 개화', '발도', 1)
  expect((await hover(first)).textContent).toBe('Ⅰ 명가의 손놀림합성 설명합성 설명')
  await leave(first)
  const second = upgradeMarkTrigger('스킬 개화', '맹룡단공참', 2)
  expect((await hover(second)).textContent).toBe('Ⅱ 파죽지세합성 설명합성 설명')
  expect(upgradeSection('스킬 강화')!.querySelector('button')).toBeNull()
})

it('스킬 강화는 두 강화 비율이 모두 1% 이하인 스킬을 숨기고 하나라도 넘으면 보이며, 스킬 개화는 1% 이하여도 보인다', async () => {
  const skills = skillStatsFixture.skills.map((skill) => {
    if (skill.name !== '류심 충' && skill.name !== '류심 승') {
      return skill
    }

    return { ...skill, learned: 399, levels: [[30, 399]] as [number, number][] }
  })
  const bothAtFloor = { name: '류심 쾌', type1: 4, type2: 4 }
  await renderStats({
    ...skillStatsFixture,
    skills,
    evolutions: [bothAtFloor],
    enhancements: [
      bothAtFloor,
      { name: '류심 승', type1: 4, type2: 0 },
      { name: '류심 충', type1: 0, type2: 4 }
    ]
  })

  expect(upgradeRows('스킬 개화')).toEqual([['류심 쾌', 'evolution-1 1.0%', 'evolution-2 1.0%']])
  expect(upgradeRows('스킬 강화')).toEqual([
    ['류심 충', 'enhancement-1 0.0%', 'enhancement-2 1.0%'],
    ['류심 승', 'enhancement-1 1.0%', 'enhancement-2 0.0%']
  ])
})

it('스킬 강화를 모두 숨기면 스킬 강화 제목도 그리지 않는다', async () => {
  await renderStats({
    ...skillStatsFixture,
    enhancements: [{ name: '류심 쾌', type1: 4, type2: 4 }]
  })

  expect(upgradeSection('스킬 개화')).not.toBeNull()
  expect(upgradeSection('스킬 강화')).toBeNull()
})

it('스킬 통계를 계산한 적이 없으면 통계가 없다고 보이고, 받지 못하면 다른 통계 탭과 같은 실패 표시를 보인다', async () => {
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

it('가장 많이 사용하는 조합과 무기는 많은 순 5개만 그리고, 막대마다 고른 전직과 그 조합, 무기로 거른 검색 화면에 잇는다', async () => {
  await renderStats(skillStatsFixture)

  const job = { path: '/rankings', jobId: SWORDMAN.jobId, jobGrowId: WEAPON_MASTER.jobGrowId }
  const combos = barRows('가장 많이 사용하는 조합')
  expect(combos.map(({ value }) => value)).toEqual(['9.7%', '8.9%', '7.6%', '6.2%', '5.8%'])
  expect(combos[0]!.link).toEqual({
    ...job,
    equipmentSetId: '7f788a703a87d783079b41d0fe6448c9',
    oathSetId: '16203'
  })

  const weapons = barRows('무기')
  expect(weapons.map(({ value }) => value)).toEqual(['14.8%', '6.1%', '5.7%', '5.2%', '4.9%'])
  expect(weapons[0]!.text).toContain('요도 : 날뛰는 흑혈')
  expect(weapons[0]!.link).toEqual({ ...job, itemIds: 'story-weapon-1' })
  expect(weapons.some(({ text }) => text.includes('그 밖'))).toBe(false)
})

it('표본 칩은 조합과 무기 요청의 표본만 바꾸고 스킬 통계 요청에는 표본을 보내지 않는다', async () => {
  const onFilterChange = vi.fn()
  server.use(skillStatsHandlers.of(skillStatsFixture))
  await render({ ...WEAPON_MASTER_FILTER, sample: 'top' }, onFilterChange)

  const weaponMaster = `?jobId=${SWORDMAN.jobId}&jobGrowId=${WEAPON_MASTER.jobGrowId}`
  await vi.waitFor(() => expect(requestsTo(ITEM_STATS_URL)).toEqual([`${weaponMaster}&sample=top`]))
  expect(requestsTo(SET_STATS_URL)).toEqual([`${weaponMaster}&sample=top`])
  expect(skillRequests()).toEqual([weaponMaster])
  expect(pressedChips()).toEqual(['귀검사(남)', '웨펀마스터', '상위 500명'])

  await act(async () => chip('전체')?.click())

  expect(onFilterChange).toHaveBeenLastCalledWith({ ...WEAPON_MASTER_FILTER, sample: undefined })
})

it('스킬 통계를 받지 못해도 조합과 무기 상자는 값을 보인다', async () => {
  server.use(skillStatsHandlers.failure)
  await render(WEAPON_MASTER_FILTER)

  await vi.waitFor(() =>
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      '스킬 통계를 받지 못했습니다.'
    )
  )
  await vi.waitFor(() => expect(barRows('무기')).toHaveLength(5))
  expect(barRows('가장 많이 사용하는 조합')).toHaveLength(5)
})

it('조합과 무기 상자는 각자 통계를 받지 못하거나 통계가 없으면 그 상자 안에 알리고 스킬 창은 그대로 그린다', async () => {
  server.use(
    skillStatsHandlers.of(skillStatsFixture),
    setStatsHandlers.failure,
    itemStatsHandlers.empty
  )
  await render(WEAPON_MASTER_FILTER)

  await vi.waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
  expect(box('가장 많이 사용하는 조합').textContent).toBe(
    '가장 많이 사용하는 조합세트 통계를 받지 못했습니다.'
  )
  expect(box('무기').textContent).toBe('무기아이템 통계가 없습니다.')
  expect(box('유일 장비').textContent).toBe('유일 장비아이템 통계가 없습니다.')
  expect(cellOf('발도').level).toBe('20')
})

it('세트 통계를 받는 중이면 조합 상자만 받는 중으로 두고 무기와 스킬 창은 그린다', async () => {
  server.use(skillStatsHandlers.of(skillStatsFixture), setStatsHandlers.loading)
  await render(WEAPON_MASTER_FILTER)

  await vi.waitFor(() => expect(barRows('무기')).toHaveLength(5))
  expect(cellOf('발도').level).toBe('20')
  expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1)
})

it('맨 윗줄은 조합, 무기, 유일 장비 순의 세 칸이고, 유일 장비는 고정한 네 아이템을 낀 캐릭터 수로 보이며 고른 전직과 그 아이템으로 거른 검색 화면에 잇는다', async () => {
  await renderStats(skillStatsFixture)

  const topBoxes = [...container.querySelectorAll('section[aria-label]')].map((section) =>
    section.getAttribute('aria-label')
  )
  expect(topBoxes.slice(0, 3)).toEqual(['가장 많이 사용하는 조합', '무기', '유일 장비'])
  expect(box('유일 장비').closest('[aria-label="스킬 창"], .\\@container')).toBeNull()
  const uniques = barRows('유일 장비')
  expect(uniques.map(({ text }) => text)).toEqual([
    '광휘를 머금은 눈동자29.9만명',
    '만병을 잉태한 역병의 심장28.4만명',
    '우아한 기품의 향수29만명',
    '영롱한 날씨의 큐브27.3만명'
  ])
  expect(uniques[0]!.link).toEqual({
    path: '/rankings',
    jobId: SWORDMAN.jobId,
    jobGrowId: WEAPON_MASTER.jobGrowId,
    itemIds: 'aa5273499f19ddba846919dbb6857d82'
  })
  expect(uniques.map(({ link }) => link.itemIds)).toEqual([
    'aa5273499f19ddba846919dbb6857d82',
    '6e1fcf6e59ed8d5a95dc152b84fe93ce',
    'df77236c51ea1274a3deb79c3e470695',
    '14449881bc371352c250502e7b201506'
  ])
})

it('유일 장비 인원은 1,000명부터 천, 만 단위로 소수 한 자리까지 줄이고 그 아래는 그대로 쓴다', async () => {
  const counts = [999, 1400, 14000, 100000]
  const uniques = ITEM_STATS.slots
    .filter(({ slotId }) => slotId !== 'WEAPON')
    .map((slot, index) => ({
      ...slot,
      items: slot.items.map((item) => ({ ...item, count: counts[index]! }))
    }))
  const weapons = ITEM_STATS.slots.filter(({ slotId }) => slotId === 'WEAPON')
  server.use(
    http.get(ITEM_STATS_URL, () =>
      HttpResponse.json({ ...ITEM_STATS, slots: [...weapons, ...uniques] })
    )
  )
  await renderStats(skillStatsFixture)

  expect(barRows('유일 장비').map(({ value }) => value)).toEqual([
    '999명',
    '1.4천명',
    '1.4만명',
    '10만명'
  ])
})
