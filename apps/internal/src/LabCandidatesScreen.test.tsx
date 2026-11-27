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

function exclusionPanel(): HTMLElement {
  const found = container.querySelector<HTMLElement>('section[aria-label="제외한 후보"]')

  if (found === null) {
    throw new Error('제외한 후보 영역이 없습니다.')
  }

  return found
}

function exclusionRows(): string[][] {
  return [...exclusionPanel().querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
  )
}

function labeledButton(label: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)

  if (found === null) {
    throw new Error(`${label} 버튼이 없습니다.`)
  }

  return found
}

function exclusionWrites(api: FakeOpsApi): { method: string; body: unknown }[] {
  return api
    .writes()
    .filter(({ path }) => path === '/api/lab-candidates/exclusions')
    .map(({ method, body }) => ({ method, body }))
}

async function hoverName(name: string): Promise<HTMLElement> {
  const target = rowOf(name).querySelector('td:first-child [tabindex="0"]')

  if (target === null) {
    throw new Error(`${name} 이름 칸이 없습니다.`)
  }

  await act(async () => {
    target.dispatchEvent(new MouseEvent('mouseenter'))
  })
  await waitFor(() => expect(document.querySelector('.tooltip-item')).not.toBeNull())

  return document.querySelector<HTMLElement>('.tooltip-item')!
}

async function leaveName(name: string): Promise<void> {
  const target = rowOf(name).querySelector('td:first-child [tabindex="0"]')!

  await act(async () => {
    target.dispatchEvent(new MouseEvent('mouseleave'))
  })
  await waitFor(() => expect(document.querySelector('.tooltip-item')).toBeNull())
}

function textsOf(scope: ParentNode, selector: string): string[] {
  return [...scope.querySelectorAll(selector)].map((element) => element.textContent ?? '')
}

const TITLE = { category: 'TITLE', role: 'all' }

describe('실험실 후보 페이지', () => {
  it('상단 바의 실험실 후보 주소를 열면 후보 패널과 제외한 후보만 보이고 메뉴가 현재 페이지로 굵게 표시된다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A' })]
    await openCandidates(api)

    const sections = [...container.querySelectorAll('main section')].map((section) =>
      section.getAttribute('aria-label')
    )

    expect(sections).toEqual(['실험실 후보', '제외한 후보'])
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

  it('착용 수를 센 후보는 0명도 수로 보이고 착용 집계 시각을 보이며, 마법부여 탭에는 집계 시각이 없다', async () => {
    const api = new FakeOpsApi()
    const wearCountedAt = '2026-11-09T15:30:00.000Z'
    api.labCandidates = [
      labCandidate({ itemName: '합성 칭호 A', fame: 300, wearCount: 6902, wearCountedAt }),
      labCandidate({ itemName: '합성 칭호 B', fame: 200, wearCount: 0, wearCountedAt }),
      labCandidate({
        itemName: '합성 상의 카드',
        kind: 'ENCHANT',
        categories: ['WEAPON'],
        roles: ['dealer']
      })
    ]
    await openCandidates(api)

    expect(cellsOf('합성 칭호 A')[5]).toBe('6,902')
    expect(cellsOf('합성 칭호 B')[5]).toBe('0')
    expect(container.textContent).toContain('착용 집계 11-10 00:30:00')

    await openTab('마법부여')
    await waitFor(() => expect(rowNames()).toEqual(['합성 상의 카드']))
    expect(cellsOf('합성 상의 카드')[5]).toBe('-')
    expect(container.textContent).not.toContain('착용 집계')
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

  it('칭호 이름에 마우스를 올리면 등급 색 이름, 등급, 레벨제한, 종류, 명성, 옵션 줄, 구분선 아래 버프 줄, 설명을 tooltip으로 보인다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({
        itemName: '합성 칭호 A',
        fame: 1123,
        availableLevel: 1,
        itemTypeDetail: '칭호',
        options: [
          { name: '공격력 증폭', value: '20%' },
          { name: '힘', value: '100' }
        ],
        buffLines: ['1~95레벨 스킬 / Lv +1', '[버프 강화] 50레벨 액티브 스킬 / Lv +2'],
        description: '<합성 왕국>'
      })
    ]
    await openCandidates(api)

    const box = await hoverName('합성 칭호 A')
    const name = box.querySelector<HTMLElement>('b')!
    const blocks = [...box.querySelector('.item-card')!.children].map(
      (block) => block.textContent ?? ''
    )

    expect(name.textContent).toBe('합성 칭호 A')
    expect(name.dataset.rarity).toBe('rare')
    expect(blocks).toEqual([
      '합성 칭호 A',
      '레어레벨제한 1칭호',
      '모험가 명성 1,123',
      '공격력 증폭 20%힘 100',
      '1~95레벨 스킬 / Lv +1[버프 강화] 50레벨 액티브 스킬 / Lv +2',
      '<합성 왕국>'
    ])
    expect(box.querySelector('[data-buff-lines]')?.classList).toContain('item-card-section')
    expect(textsOf(box, '[data-buff-lines] li')).toEqual([
      '1~95레벨 스킬 / Lv +1',
      '[버프 강화] 50레벨 액티브 스킬 / Lv +2'
    ])
  })

  it('설명, 레벨제한, 아이템 종류가 없고 버프 줄이 빈 후보는 그 줄과 버프 블록 없이 tooltip을 보인다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({ itemName: '합성 칭호 B', options: [{ name: '힘', value: '10' }] })
    ]
    await openCandidates(api)

    const box = await hoverName('합성 칭호 B')
    const blocks = [...box.querySelector('.item-card')!.children].map(
      (block) => block.textContent ?? ''
    )

    expect(blocks).toEqual(['합성 칭호 B', '레어', '모험가 명성 100', '힘 10'])
    expect(box.querySelector('[data-buff-lines]')).toBeNull()
  })

  it('마법부여 카드 이름에 마우스를 올리면 옵션 줄 대신 부위와 카드 단계별 옵션을 보이고, 딜러와 버퍼 역할에서 강조하는 줄이 다르다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({
        itemName: '합성 양용 카드',
        kind: 'ENCHANT',
        itemRarity: '레전더리',
        categories: ['WEAPON'],
        roles: ['dealer', 'buffer'],
        options: [{ name: '무시', value: '0' }],
        card: {
          slots: ['무기'],
          enchants: [
            {
              upgrade: 0,
              status: [
                { name: '힘', value: '90' },
                { name: '최종 데미지 증가', value: '2%' }
              ]
            },
            {
              upgrade: 1,
              status: [
                { name: '지능', value: '100' },
                { name: '최종 데미지 증가', value: '3%' }
              ]
            }
          ]
        }
      })
    ]
    await renderPage(api, '/lab-candidates')
    await openTab('마법부여')
    await waitFor(() => expect(rowNames()).toEqual(['합성 양용 카드']))

    const emphasizedCells = async (): Promise<string[]> => {
      const box = await hoverName('합성 양용 카드')
      const cells = textsOf(box, '[data-card-option] > [data-emphasized]')

      await leaveName('합성 양용 카드')

      return cells
    }

    const box = await hoverName('합성 양용 카드')
    const lines = [...box.querySelectorAll('[data-card-option]')].map((row) =>
      [...row.children].map((cell) => cell.textContent).join(' ')
    )

    expect(box.querySelector('[data-card-slots]')?.textContent).toBe('무기')
    expect(lines).toEqual(['최종 데미지 증가 2% | 3%', '올스탯 90 | 100'])
    expect(box.textContent).not.toContain('무시')
    await leaveName('합성 양용 카드')

    expect(await emphasizedCells()).toEqual(['최종 데미지 증가', '2%', '3%'])

    await choose('역할', '버퍼')
    await waitFor(() => expect(rowNames()).toEqual(['합성 양용 카드']))

    expect(await emphasizedCells()).toEqual(['올스탯', '90', '100'])
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

  it('실험실 아이템 묶음을 읽는 중이거나 다시 읽지 못하면 바꾼 등급이 있어도 추천 적용과 저장을 막는다', async () => {
    const loading = new FakeOpsApi()
    loading.labCandidates = [labCandidate({ itemName: '합성 칭호 A', recommendedTier: '종결' })]
    const neverAnswers: typeof fetch = (input, init) => {
      const request = new Request(input, init)

      if (new URL(request.url).pathname === '/api/lab-items') {
        return new Promise<Response>(() => undefined)
      }

      return loading.fetch(request)
    }
    await renderPage(loading, '/lab-candidates', neverAnswers)
    await waitFor(() => expect(loading.labCandidateQueries).toHaveLength(1))
    await flush()

    expect(panel().querySelector('[role="status"].state-pending')).not.toBeNull()
    expect(buttonIn(panel(), '추천 적용').disabled).toBe(true)
    expect(buttonIn(panel(), '저장').disabled).toBe(true)
    act(() => root?.unmount())
    root = undefined

    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A', recommendedTier: '종결' })]
    let labItemsFail = false
    const transport = failing(
      api,
      ({ url }) => labItemsFail && new URL(url).pathname === '/api/lab-items'
    )
    await openCandidates(api, transport)
    await choose('합성 칭호 A 등급', '배럭')
    expect(buttonIn(panel(), '저장').disabled).toBe(false)

    labItemsFail = true
    await click(container.querySelector<HTMLButtonElement>('button[aria-label="다시 읽기"]')!)

    await waitFor(() =>
      expect(panel().querySelector('[role="alert"]')?.textContent).toBe(
        '실험실 아이템을 읽지 못했습니다.'
      )
    )
    expect(buttonIn(panel(), '추천 적용').disabled).toBe(true)
    expect(buttonIn(panel(), '저장').disabled).toBe(true)
  })

  it('등급을 옮기는 저장에서 새 묶음 PUT만 실패한 뒤 다시 저장해도 옮긴 아이템의 재화 비용을 그대로 보낸다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A' })]
    api.labItems = [
      {
        ...TITLE,
        tier: '종결',
        items: [{ itemName: '합성 칭호 A', cost: { currencyId: 1, count: 3 } }]
      }
    ]
    let failNextSemiFinal = true
    const transport: typeof fetch = async (input, init) => {
      const request = new Request(input, init)
      const body: unknown = request.method === 'PUT' ? await request.clone().json() : undefined

      if (failNextSemiFinal && (body as { tier?: string } | undefined)?.tier === '준종결') {
        failNextSemiFinal = false

        return new Response(JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return api.fetch(request)
    }
    await openCandidates(api, transport)

    await choose('합성 칭호 A 등급', '준종결')
    await click(buttonIn(panel(), '저장'))
    await waitFor(() => expect(panel().textContent).toContain('저장하지 못했습니다.'))
    await waitFor(() => expect(api.labItems).toEqual([]))

    await click(buttonIn(panel(), '저장'))

    await waitFor(() =>
      expect(api.labItems).toEqual([
        {
          ...TITLE,
          tier: '준종결',
          items: [{ itemName: '합성 칭호 A', cost: { currencyId: 1, count: 3 } }]
        }
      ])
    )
  })

  it('저장하는 동안에는 등급 선택과 추천 적용을 막는다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A', recommendedTier: '종결' })]
    let finishPut: () => void = () => undefined
    const transport: typeof fetch = async (input, init) => {
      const request = new Request(input, init)

      if (request.method === 'PUT') {
        await new Promise<void>((resolve) => {
          finishPut = resolve
        })
      }

      return api.fetch(request)
    }
    await openCandidates(api, transport)

    await choose('합성 칭호 A 등급', '종결')
    await click(buttonIn(panel(), '저장'))

    expect(trigger('합성 칭호 A 등급').hasAttribute('data-disabled')).toBe(true)
    expect(buttonIn(panel(), '추천 적용').disabled).toBe(true)

    await act(async () => finishPut())
    await waitFor(() =>
      expect(trigger('합성 칭호 A 등급').hasAttribute('data-disabled')).toBe(false)
    )
    expect(tierOf('합성 칭호 A')).toBe('종결')
    expect(pendingDot('합성 칭호 A')).toBeNull()
  })

  it('가격 이력은 값이 이어지는 구간마다 가장 오래된 줄만 보인다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A' })]
    const entry = (id: number, unitPrice: number, checkedAt: string) => ({
      id,
      itemName: '합성 칭호 A',
      itemId: 'synthetic-item',
      unitPrice,
      checkedAt
    })
    api.labCandidateHistory = {
      '합성 칭호 A': [
        entry(4, 100, '2026-11-10T05:00:00.000Z'),
        entry(3, 120, '2026-11-09T05:00:00.000Z'),
        entry(2, 100, '2026-11-08T05:00:00.000Z'),
        entry(1, 100, '2026-11-07T05:00:00.000Z')
      ]
    }
    await openCandidates(api)

    await click(rowOf('합성 칭호 A').querySelector<HTMLButtonElement>('button[aria-expanded]')!)
    await waitFor(() => expect(panel().querySelector('dl')).not.toBeNull())

    const entries = [...panel().querySelectorAll('dl > div')].map((item) =>
      [...item.children].map((part) => part.textContent)
    )
    expect(entries).toEqual([
      ['11-07 14:00', '100'],
      ['11-09 14:00', '120'],
      ['11-10 14:00', '100']
    ])
  })

  it('후보 가격 job의 새 실행이 끝나면 후보를 다시 읽어 바뀐 최저가를 보인다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [job({ name: PRICE_JOB, lastFinishedRun: run({ id: 10 }) })]
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A', unitPrice: 1_000 })]
    const transport: typeof fetch = async (input, init) => {
      const request = new Request(input, init)
      const response = await api.fetch(request)

      if (request.method === 'POST') {
        api.jobs = [job({ name: PRICE_JOB, lastFinishedRun: run({ id: 11 }) })]
        api.labCandidates = [labCandidate({ itemName: '합성 칭호 A', unitPrice: 2_000 })]
      }

      return response
    }
    await openCandidates(api, transport)
    expect(cellsOf('합성 칭호 A')[4]).toBe('1,000')

    await click(buttonIn(panel(), '지금 받기'))

    await waitFor(() => expect(cellsOf('합성 칭호 A')[4]).toBe('2,000'))
    expect(api.labCandidateQueries).toHaveLength(2)
  })

  it('제외를 누르면 확인 창 없이 제외하고, 후보 표에서 빼고 제외한 후보에 이름과 제외 시각을 보인다', async () => {
    const api = new FakeOpsApi()
    api.now = () => '2026-11-10T05:30:00.000Z'
    api.labCandidates = [
      labCandidate({ itemName: '합성 칭호 A' }),
      labCandidate({ itemName: '합성 칭호 B' })
    ]
    const confirm = vi.spyOn(window, 'confirm')
    await openCandidates(api)
    await waitFor(() => expect(exclusionPanel().textContent).toContain('제외한 후보가 없습니다.'))

    await click(labeledButton('합성 칭호 A 제외'))

    await waitFor(() => expect(rowNames()).toEqual(['합성 칭호 B']))
    await waitFor(() =>
      expect(exclusionRows()).toEqual([['합성 칭호 A', '11-10 14:30:00', '해제']])
    )
    expect(exclusionWrites(api)).toEqual([{ method: 'POST', body: { itemName: '합성 칭호 A' } }])
    expect(confirm).not.toHaveBeenCalled()
  })

  it('실험실 아이템 묶음에 든 후보는 다른 부위 묶음에 있어도 제외 버튼을 막는다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({ itemName: '합성 칭호 A' }),
      labCandidate({ itemName: '합성 칭호 B' }),
      labCandidate({ itemName: '합성 칭호 C' })
    ]
    api.labItems = [
      { ...TITLE, tier: '종결', items: [{ itemName: '합성 칭호 A', cost: null }] },
      {
        category: 'WEAPON',
        role: 'dealer',
        tier: '배럭',
        items: [{ itemName: '합성 칭호 B', cost: null }]
      }
    ]
    await openCandidates(api)

    expect(labeledButton('합성 칭호 A 제외').disabled).toBe(true)
    expect(labeledButton('합성 칭호 B 제외').disabled).toBe(true)
    expect(labeledButton('합성 칭호 C 제외').disabled).toBe(false)
  })

  it('해제를 누르면 해제를 요청하고 제외한 후보에서 뺀다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 B' })]
    api.labCandidateExclusions = [
      { itemName: '합성 칭호 A', excludedAt: '2026-11-10T05:00:00.000Z' }
    ]
    await openCandidates(api)
    await waitFor(() => expect(exclusionRows()).toHaveLength(1))

    await click(labeledButton('합성 칭호 A 해제'))

    await waitFor(() => expect(exclusionPanel().textContent).toContain('제외한 후보가 없습니다.'))
    expect(exclusionWrites(api)).toEqual([{ method: 'DELETE', body: { itemName: '합성 칭호 A' } }])
  })

  it('저장하지 않은 등급 변경이 있는 후보를 제외하면 그 변경도 버려 저장할 변경이 남지 않는다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [
      labCandidate({ itemName: '합성 칭호 A' }),
      labCandidate({ itemName: '합성 칭호 B' })
    ]
    await openCandidates(api)
    await choose('합성 칭호 A 등급', '종결')
    expect(panel().textContent).toContain('변경 1')

    await click(labeledButton('합성 칭호 A 제외'))

    await waitFor(() => expect(rowNames()).toEqual(['합성 칭호 B']))
    expect(panel().textContent).not.toContain('변경 1')
    expect(buttonIn(panel(), '저장').disabled).toBe(true)
  })

  it('제외나 해제가 실패하면 실패 문구를 보이고 후보와 제외한 후보를 그대로 둔다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A' })]
    api.labCandidateExclusions = [
      { itemName: '합성 칭호 B', excludedAt: '2026-11-10T05:00:00.000Z' }
    ]
    await openCandidates(
      api,
      failing(api, ({ method }) => method === 'POST' || method === 'DELETE')
    )
    await waitFor(() => expect(exclusionRows()).toHaveLength(1))

    await click(labeledButton('합성 칭호 A 제외'))
    await click(labeledButton('합성 칭호 B 해제'))

    await waitFor(() => expect(panel().textContent).toContain('제외하지 못했습니다.'))
    await waitFor(() => expect(exclusionPanel().textContent).toContain('해제하지 못했습니다.'))
    expect(rowNames()).toEqual(['합성 칭호 A'])
    expect(exclusionRows().map(([name]) => name)).toEqual(['합성 칭호 B'])
  })

  it('제외한 후보를 읽지 못하면 그 구획에만 오류 문구를 보이고 후보 표는 그대로 보인다', async () => {
    const api = new FakeOpsApi()
    api.labCandidates = [labCandidate({ itemName: '합성 칭호 A' })]
    const transport = failing(
      api,
      ({ url }) => new URL(url).pathname === '/api/lab-candidates/exclusions'
    )
    await openCandidates(api, transport)

    await waitFor(() =>
      expect(exclusionPanel().querySelector('[role="alert"]')?.textContent).toBe(
        '제외한 후보를 읽지 못했습니다.'
      )
    )
    expect(rowNames()).toEqual(['합성 칭호 A'])
  })
})
