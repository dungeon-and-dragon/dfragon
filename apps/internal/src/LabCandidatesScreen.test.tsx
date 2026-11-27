// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOpsClient } from '#ops-api/ops-client'
import { FakeOpsApi, job, labCandidate, run } from '#ops-testing/fake-ops-api'
import { OpsApp } from './OpsApp'
import { pageOf } from './pages'

const NOW = new Date('2026-11-10T05:32:05.000Z')
const PRICE_JOB = 'lab-candidate-price-refresh'

let root: Root | undefined
let container: HTMLDivElement

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container.remove()
  vi.useRealTimers()
})

async function flush(): Promise<void> {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

async function waitFor(check: () => void): Promise<void> {
  let lastError: unknown

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      check()

      return
    } catch (error) {
      lastError = error
      await flush()
    }
  }

  throw lastError
}

async function renderPage(
  api: FakeOpsApi,
  pathname: string,
  transport: typeof fetch = api.fetch
): Promise<void> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const client = createOpsClient('http://ops.test/api/', transport)
  root = createRoot(container)
  act(() =>
    root?.render(<OpsApp client={client} queryClient={queryClient} page={pageOf(pathname)} />)
  )
  await waitFor(() => expect(container.querySelector('main section')).not.toBeNull())
  await flush()
}

function failing(api: FakeOpsApi, fails: (request: Request) => boolean): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init)

    if (fails(request)) {
      return new Response(JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return api.fetch(request)
  }
}

async function openCandidates(api: FakeOpsApi, transport: typeof fetch = api.fetch): Promise<void> {
  await renderPage(api, '/lab-candidates', transport)
  await waitFor(() => expect(panel().querySelector('tbody tr')).not.toBeNull())
}

function panel(): HTMLElement {
  const found = container.querySelector<HTMLElement>('section[aria-label="실험실 후보"]')

  if (found === null) {
    throw new Error('실험실 후보 영역이 없습니다.')
  }

  return found
}

function rowOf(name: string): HTMLTableRowElement {
  const row = [...panel().querySelectorAll('tbody tr')].find(
    (candidate) => candidate.querySelector('td span.truncate')?.textContent === name
  )

  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`${name} 줄이 없습니다.`)
  }

  return row
}

function rowNames(): string[] {
  return [...panel().querySelectorAll('tbody tr td:first-child span.truncate')].map(
    (name) => name.textContent ?? ''
  )
}

function cellsOf(name: string): string[] {
  return [...rowOf(name).querySelectorAll('td')].map((cell) => cell.textContent ?? '')
}

function buttonIn(scope: ParentNode, label: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label
  )

  if (button === undefined) {
    throw new Error(`${label} 버튼이 없습니다.`)
  }

  return button
}

function trigger(label: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)

  if (found === null) {
    throw new Error(`${label} 선택이 없습니다.`)
  }

  return found
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
  await flush()
}

async function choose(label: string, option: string): Promise<void> {
  await click(trigger(label))

  const item = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (candidate) => candidate.textContent === option
  )

  if (item === undefined) {
    throw new Error(`${label}에 ${option}이 없습니다.`)
  }

  await click(item)
}

async function openTab(label: string): Promise<void> {
  const tab = [...panel().querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (candidate) => candidate.textContent === label
  )

  if (tab === undefined) {
    throw new Error(`${label} 탭이 없습니다.`)
  }

  await click(tab)
}

function tierOf(name: string): string {
  const { textContent } = trigger(`${name} 등급`)

  if (textContent === null) {
    return ''
  }

  return textContent
}

function pendingDot(name: string): Element | null {
  return rowOf(name).querySelector('[aria-label="저장 전"]')
}

function labItemPuts(api: FakeOpsApi): unknown[] {
  return api
    .writes()
    .filter(({ method, path }) => method === 'PUT' && path === '/api/lab-items')
    .map(({ body }) => body)
}

const TITLE = { category: 'TITLE', role: 'all' }

describe('실험실 후보 페이지', () => {
  it('상단 바의 실험실 후보 주소를 열면 후보 패널만 보이고 메뉴가 현재 페이지로 굵게 표시된다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A' })]
    await openCandidates(api)

    const sections = [...container.querySelectorAll('main section')].map((section) =>
      section.getAttribute('aria-label')
    )

    expect(sections).toEqual(['실험실 후보'])
    expect(container.querySelector('[role="tablist"][aria-label="운영"]')).toBeNull()
    const menu = [...container.querySelectorAll('nav[aria-label="운영 화면"] a')].map((link) => [
      link.textContent,
      link.getAttribute('href'),
      link.getAttribute('aria-current')
    ])

    expect(menu).toEqual([
      ['운영', '/', null],
      ['실험실 후보', '/lab-candidates', 'page']
    ])
  })

  it('끝에 빗금이 붙은 실험실 후보 주소도 같은 페이지로, 모르는 주소는 운영 페이지로 연다', () => {
    expect(pageOf('/lab-candidates/')).toBe('lab-candidates')
    expect(pageOf('/')).toBe('ops')
    expect(pageOf('/unknown')).toBe('ops')
  })

  it('운영 주소는 지금처럼 수집 대기열과 탭을 보이고 운영 메뉴를 현재 페이지로 둔다', async () => {
    const api = new FakeOpsApi()
    await renderPage(api, '/')

    expect(container.querySelector('section[aria-label="수집 대기열"]')).not.toBeNull()
    expect(container.querySelector('section[aria-label="실험실 후보"]')).toBeNull()
    const current = container.querySelector('nav[aria-label="운영 화면"] a[aria-current="page"]')
    expect(current?.textContent).toBe('운영')
  })

  it('종류 탭을 바꾸면 그 종류로 조회하고, 마법부여는 고른 부위와 역할을 query에 넣는다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({ itemName: '합성 칭호 A' }),
      labCandidate({ itemName: '합성 크리쳐 A', kind: 'CREATURE', categories: ['CREATURE'] }),
      labCandidate({
        itemName: '합성 상의 카드',
        kind: 'ENCHANT',
        categories: ['JACKET', 'PANTS'],
        roles: ['buffer']
      })
    ]
    await openCandidates(api)
    expect(rowNames()).toEqual(['합성 칭호 A'])

    await openTab('크리쳐')
    await waitFor(() => expect(rowNames()).toEqual(['합성 크리쳐 A']))

    await openTab('마법부여')
    await waitFor(() => expect(panel().textContent).toContain('후보가 없습니다.'))
    await choose('부위', '하의')
    await choose('역할', '버퍼')
    await waitFor(() => expect(rowNames()).toEqual(['합성 상의 카드']))

    expect(api.labCandidateQueries).toContainEqual({ kind: 'CREATURE' })
    expect(api.labCandidateQueries).toContainEqual({
      kind: 'ENCHANT',
      category: 'WEAPON',
      role: 'dealer'
    })
    expect(api.labCandidateQueries.at(-1)).toEqual({
      kind: 'ENCHANT',
      category: 'PANTS',
      role: 'buffer'
    })
  })

  it('이름, 명성, 옵션, 버프, 최저가와 직전 대비, 착용 수를 보이고 카드는 부여 부위와 마지막 단계 옵션을 보인다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({
        itemName: '합성 칭호 A',
        fame: 1123,
        options: [
          { name: '공격력 증폭', value: '20%' },
          { name: '힘', value: '100' }
        ],
        buffLines: ['50레벨 액티브 스킬 Lv +2', '1~95레벨 모든 스킬 Lv +1'],
        unitPrice: 2_150_000_000,
        previousPrice: {
          itemId: 'synthetic-item',
          unitPrice: 2_000_000_000,
          checkedAt: NOW.toJSON()
        }
      }),
      labCandidate({
        itemName: '합성 칭호 B',
        fame: 849,
        unitPrice: 990_000,
        previousPrice: { itemId: 'synthetic-item', unitPrice: 1_000_000, checkedAt: NOW.toJSON() },
        wearCount: 3417
      }),
      labCandidate({
        itemName: '합성 상의 카드',
        kind: 'ENCHANT',
        itemRarity: '레전더리',
        categories: ['WEAPON', 'PANTS'],
        roles: ['dealer'],
        options: [{ name: '무시', value: '0' }],
        card: {
          slots: ['무기', '하의'],
          enchants: [
            { upgrade: 0, status: [{ name: '힘', value: '90' }] },
            {
              upgrade: 1,
              status: [
                { name: '힘', value: '100' },
                { name: '최종 데미지 증가', value: '3%' }
              ]
            }
          ]
        }
      })
    ]
    await openCandidates(api)

    expect(cellsOf('합성 칭호 A').slice(0, 6)).toEqual([
      '합성 칭호 A레어',
      '1,123',
      '공격력 증폭 20%, 힘 100',
      '50레벨 액티브 스킬 Lv +2, 1~95레벨 모든 스킬 Lv +1',
      '2,150,000,000▲ 7.5%',
      '-'
    ])
    expect(rowOf('합성 칭호 A').querySelector('.text-fg-danger')?.textContent).toBe('▲ 7.5%')
    expect(cellsOf('합성 칭호 B').slice(4, 6)).toEqual(['990,000▼ 1.0%', '3,417'])
    expect(rowOf('합성 칭호 B').querySelector('.text-fg-success')?.textContent).toBe('▼ 1.0%')

    await openTab('마법부여')
    await waitFor(() => expect(rowNames()).toEqual(['합성 상의 카드']))
    expect(cellsOf('합성 상의 카드').slice(0, 4)).toEqual([
      '합성 상의 카드레전더리 · 무기, 하의',
      '100',
      '힘 100, 최종 데미지 증가 3%',
      '-'
    ])
  })

  it('응답의 미조회, 검색 없음, 매물 없음 배지를 tone과 함께 보이고 검색 없음은 danger로 구분한다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({
        itemName: '합성 칭호 미조회',
        checkedAt: null,
        itemId: null,
        badge: '미조회'
      }),
      labCandidate({ itemName: '합성 칭호 검색 없음', itemId: null, badge: '검색 없음' }),
      labCandidate({ itemName: '합성 칭호 매물 없음', unitPrice: null, badge: '매물 없음' }),
      labCandidate({ itemName: '합성 칭호 정상' })
    ]
    await openCandidates(api)

    const badges = rowNames().map((name) => {
      const chip = rowOf(name).querySelector('.status-chip')

      return [name, chip?.textContent ?? null, chip?.getAttribute('data-tone') ?? null]
    })

    expect(badges).toEqual([
      ['합성 칭호 미조회', '미조회', 'neutral'],
      ['합성 칭호 검색 없음', '검색 없음', 'danger'],
      ['합성 칭호 매물 없음', '매물 없음', 'warning'],
      ['합성 칭호 정상', null, null]
    ])
    expect(cellsOf('합성 칭호 매물 없음')[4]).toBe('-')
  })

  it('추천 등급을 보이고 추천 적용은 지정 없는 줄만 추천 값으로 바꾸며 저장 전 표시를 붙인다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({ itemName: '합성 칭호 A', fame: 900, recommendedTier: '종결' }),
      labCandidate({ itemName: '합성 칭호 B', fame: 900, recommendedTier: '종결' }),
      labCandidate({ itemName: '합성 칭호 C', fame: 800, recommendedTier: '준종결' }),
      labCandidate({ itemName: '합성 칭호 D', fame: 700 })
    ]
    api.labItems = [{ ...TITLE, tier: '배럭', items: [{ itemName: '합성 칭호 B', cost: null }] }]
    await openCandidates(api)

    expect(rowNames().map((name) => [name, cellsOf(name)[7], tierOf(name)])).toEqual([
      ['합성 칭호 A', '종결', '없음'],
      ['합성 칭호 B', '종결', '배럭'],
      ['합성 칭호 C', '준종결', '없음'],
      ['합성 칭호 D', '-', '없음']
    ])
    expect(buttonIn(panel(), '저장').disabled).toBe(true)

    await click(buttonIn(panel(), '추천 적용'))

    expect(rowNames().map((name) => [name, tierOf(name), pendingDot(name) !== null])).toEqual([
      ['합성 칭호 A', '종결', true],
      ['합성 칭호 B', '배럭', false],
      ['합성 칭호 C', '준종결', true],
      ['합성 칭호 D', '없음', false]
    ])
    expect(panel().textContent).toContain('변경 2')
    expect(buttonIn(panel(), '저장').disabled).toBe(false)
    expect(api.writes()).toEqual([])
  })

  it('종결 아이템을 준종결로 옮겨 저장하면 종결 묶음에서 빼고 준종결 묶음에 넣으며 다른 아이템의 재화 비용을 그대로 보낸다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({ itemName: '합성 칭호 A' }),
      labCandidate({ itemName: '합성 칭호 B' })
    ]
    api.labItems = [
      {
        ...TITLE,
        tier: '종결',
        items: [
          { itemName: '합성 칭호 A', cost: { currencyId: 1, count: 3 } },
          { itemName: '합성 칭호 B', cost: { currencyId: 2, count: 5 } }
        ]
      },
      {
        ...TITLE,
        tier: '준종결',
        items: [{ itemName: '합성 칭호 C', cost: { currencyId: 1, count: 1 } }]
      }
    ]
    await openCandidates(api)

    await choose('합성 칭호 A 등급', '준종결')
    expect(pendingDot('합성 칭호 A')).not.toBeNull()
    await click(buttonIn(panel(), '저장'))

    await waitFor(() => expect(labItemPuts(api)).toHaveLength(2))
    expect(labItemPuts(api)).toEqual(
      expect.arrayContaining([
        {
          ...TITLE,
          tier: '종결',
          items: [{ itemName: '합성 칭호 B', cost: { currencyId: 2, count: 5 } }]
        },
        {
          ...TITLE,
          tier: '준종결',
          items: [
            { itemName: '합성 칭호 C', cost: { currencyId: 1, count: 1 } },
            { itemName: '합성 칭호 A', cost: { currencyId: 1, count: 3 } }
          ]
        }
      ])
    )
    await waitFor(() => expect(pendingDot('합성 칭호 A')).toBeNull())
    expect(tierOf('합성 칭호 A')).toBe('준종결')
    expect(buttonIn(panel(), '저장').disabled).toBe(true)
  })

  it('없음으로 바꾸면 그 묶음에서만 빼고, 원래 등급으로 되돌리면 변경에서 지운다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A' })]
    api.labItems = [{ ...TITLE, tier: '배럭', items: [{ itemName: '합성 칭호 A', cost: null }] }]
    await openCandidates(api)

    await choose('합성 칭호 A 등급', '종결')
    await choose('합성 칭호 A 등급', '배럭')
    expect(pendingDot('합성 칭호 A')).toBeNull()
    expect(buttonIn(panel(), '저장').disabled).toBe(true)

    await choose('합성 칭호 A 등급', '없음')
    await click(buttonIn(panel(), '저장'))

    await waitFor(() => expect(labItemPuts(api)).toEqual([{ ...TITLE, tier: '배럭', items: [] }]))
  })

  it('저장이 실패하면 저장하지 못했습니다를 보이고 바꾼 등급을 남긴다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A' })]
    await openCandidates(
      api,
      failing(api, ({ method }) => method === 'PUT')
    )

    await choose('합성 칭호 A 등급', '종결')
    await click(buttonIn(panel(), '저장'))

    await waitFor(() => expect(panel().textContent).toContain('저장하지 못했습니다.'))
    expect(tierOf('합성 칭호 A')).toBe('종결')
    expect(pendingDot('합성 칭호 A')).not.toBeNull()
  })

  it('지금 받기를 누르면 후보 가격 job을 수동 실행하고, 실행 중이면 받는 중과 잠긴 버튼을 보인다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [
      job({
        name: PRICE_JOB,
        lastFinishedRun: run({ id: 10, finishedAt: '2026-11-10T05:00:12.000Z' })
      })
    ]
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A' })]
    await openCandidates(api)

    const title = panel().querySelector('.section-title') as HTMLElement
    expect(title.textContent).toBe('실험실 후보마지막 실행 11-10 14:00:12지금 받기')

    await click(buttonIn(title, '지금 받기'))

    await waitFor(() => expect(title.textContent).toContain('받는 중'))
    expect(api.writes()).toEqual([
      {
        method: 'POST',
        path: `/api/jobs/${PRICE_JOB}/runs`,
        contentType: 'application/json',
        body: { args: {} }
      }
    ])
    expect(buttonIn(title, '지금 받기').disabled).toBe(true)
  })

  it('worker가 후보 가격 job을 올리지 않았으면 지금 받기 대신 그 문구를 보이고 표는 그대로 보인다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [job({ name: 'stats' })]
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A' })]
    await openCandidates(api)

    const title = panel().querySelector('.section-title') as HTMLElement
    await waitFor(() =>
      expect(title.textContent).toBe('실험실 후보worker가 후보 가격 job을 올리지 않았습니다.')
    )
    expect(rowNames()).toEqual(['합성 칭호 A'])
  })

  it('최저가 칸을 펼치면 가격 이력을 받아 시각 순서로 값을 보이고 추이 그림을 그리며, 다시 누르면 접는다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({ itemName: '합성 칭호 A', fame: 900 }),
      labCandidate({ itemName: '합성 칭호 B', fame: 800 })
    ]
    api.labCandidateHistory = {
      '합성 칭호 A': [
        {
          id: 3,
          itemName: '합성 칭호 A',
          itemId: 'synthetic-item',
          unitPrice: 1_240_000_000,
          checkedAt: '2026-11-10T05:00:00.000Z'
        },
        {
          id: 2,
          itemName: '합성 칭호 A',
          itemId: 'synthetic-item',
          unitPrice: null,
          checkedAt: '2026-11-09T20:00:00.000Z'
        },
        {
          id: 1,
          itemName: '합성 칭호 A',
          itemId: 'synthetic-item',
          unitPrice: 1_180_000_000,
          checkedAt: '2026-11-09T05:00:00.000Z'
        }
      ]
    }
    await openCandidates(api)

    const toggle = rowOf('합성 칭호 A').querySelector<HTMLButtonElement>('button[aria-expanded]')!
    await click(toggle)

    await waitFor(() => expect(panel().querySelector('dl')).not.toBeNull())
    const entries = [...panel().querySelectorAll('dl > div')].map((entry) =>
      [...entry.children].map((part) => part.textContent)
    )

    expect(entries).toEqual([
      ['11-09 14:00', '1,180,000,000'],
      ['11-10 05:00', '-'],
      ['11-10 14:00', '1,240,000,000']
    ])
    expect(panel().querySelector('svg[aria-label="최저가 추이"]')).not.toBeNull()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(rowOf('합성 칭호 A').nextElementSibling?.querySelector('dl')).not.toBeNull()
    expect(api.requests.filter(({ path }) => path === '/api/lab-candidates/history')).toHaveLength(
      1
    )

    await click(toggle)
    expect(panel().querySelector('dl')).toBeNull()
  })

  it('명성 내림차순이 기본이고 이름, 최저가 헤더로 정렬을 바꾸며 값이 없는 줄은 맨 뒤에 둔다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({ itemName: '나 칭호', fame: 700, unitPrice: 300 }),
      labCandidate({ itemName: '다 칭호', fame: 900, unitPrice: null }),
      labCandidate({ itemName: '가 칭호', fame: 800, unitPrice: 100 })
    ]
    await openCandidates(api)

    expect(rowNames()).toEqual(['다 칭호', '가 칭호', '나 칭호'])
    expect(panel().querySelector('th[aria-sort]')?.textContent).toBe('명성 ↓')

    await click(buttonIn(panel(), '이름'))
    expect(rowNames()).toEqual(['가 칭호', '나 칭호', '다 칭호'])
    expect(panel().querySelector('th[aria-sort]')?.getAttribute('aria-sort')).toBe('ascending')

    await click(buttonIn(panel(), '최저가'))
    expect(rowNames()).toEqual(['나 칭호', '가 칭호', '다 칭호'])

    await click(buttonIn(panel(), '최저가 ↓'))
    expect(rowNames()).toEqual(['가 칭호', '나 칭호', '다 칭호'])
  })

  it('후보가 없으면 빈 문구를, 후보를 읽지 못하면 오류 문구를 보인다', async () => {
    const empty = new FakeOpsApi()
    await renderPage(empty, '/lab-candidates')
    await waitFor(() =>
      expect(panel().textContent).toContain('후보가 없습니다. 데이터 묶음을 import하면 보입니다.')
    )
    act(() => root?.unmount())
    root = undefined

    const broken = new FakeOpsApi()
    const transport = failing(broken, ({ url }) => new URL(url).pathname === '/api/lab-candidates')
    await renderPage(broken, '/lab-candidates', transport)

    await waitFor(() =>
      expect(panel().querySelector('[role="alert"]')?.textContent).toBe(
        '실험실 후보를 읽지 못했습니다.'
      )
    )
  })
})
