// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOpsClient } from '#ops-api/ops-client'
import { OpsApp } from './OpsApp'
import { FakeOpsApi, job, run } from '#ops-testing/fake-ops-api'

// 화면이 읽는 시각(14:32:05 KST)을 고정한다. 1초 다시 읽기 timer는 진짜 timer라 테스트 안에서 돌지 않는다.
const NOW = new Date('2026-11-10T05:32:05.000Z')

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

async function renderScreen(api: FakeOpsApi): Promise<void> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const client = createOpsClient('http://ops.test/api/', api.fetch)
  root = createRoot(container)
  act(() => root?.render(<OpsApp client={client} queryClient={queryClient} />))
  await waitFor(() => expect(container.querySelector('main section')).not.toBeNull())
  await flush()
}

function text(): string {
  const content = document.body.textContent
  if (content === null) {
    return ''
  }

  return content
}

function section(label: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`section[aria-label="${label}"]`)
  if (found === null) {
    throw new Error(`${label} 영역이 없습니다.`)
  }

  return found
}

function rowOf(name: string): HTMLTableRowElement {
  const row = [...section('job').querySelectorAll('tbody tr')].find(
    (candidate) => candidate.querySelector('td') !== null && candidate.textContent?.includes(name)
  )
  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`${name} 행이 없습니다.`)
  }

  return row
}

function jobNameIn(row: HTMLTableRowElement): HTMLElement {
  const name = row.querySelector<HTMLElement>('td > span > span')
  if (name === null) {
    throw new Error('job 이름이 없습니다.')
  }

  return name
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

async function click(element: HTMLElement): Promise<void> {
  act(() => element.click())
  await flush()
}

async function openTab(label: string): Promise<void> {
  const tab = [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (candidate) => candidate.textContent === label
  )

  if (tab === undefined) {
    throw new Error(`${label} 탭이 없습니다.`)
  }

  await click(tab)
}

function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const setValue = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  act(() => {
    setValue?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function selectOption(select: HTMLSelectElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  act(() => {
    setValue?.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function statsJob() {
  return job({
    name: 'stats',
    displayName: '통계',
    delayMinutes: 10,
    lastFinishedRun: run({ id: 10 })
  })
}

function tooltip(): Element | null {
  return document.querySelector('[data-base-ui-portal] [data-open]')
}

function focusOn(element: HTMLElement): void {
  act(() => element.focus())
}

function blurFrom(element: HTMLElement): void {
  act(() => element.blur())
}

describe('운영 화면', () => {
  it('job 이름에 focus를 주면 설명을 Tooltip으로 보이고 벗어나면 닫는다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [{ ...statsJob(), description: '직업별 통계를 다시 계산한다' }]

    await renderScreen(api)
    focusOn(jobNameIn(rowOf('통계')))

    await waitFor(() => expect(tooltip()).not.toBeNull())
    expect(tooltip()?.textContent).toBe('직업별 통계를 다시 계산한다')

    blurFrom(jobNameIn(rowOf('통계')))
    await waitFor(() => expect(tooltip()).toBeNull())
  })

  it('설명이 빈 job은 Tooltip을 열지 않는다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [statsJob()]

    await renderScreen(api)
    focusOn(jobNameIn(rowOf('통계')))
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await flush()
    }

    expect(tooltip()).toBeNull()
  })

  it('수집 대기열은 탭 위에 늘 보이고, Job 탭에 스케줄, 다음 실행, 마지막 실행과 걸린 시간을, queue 탭에 queue를 보인다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [
      statsJob(),
      job({ name: 'skill-style-sample', displayName: '스킬 스타일 표본 채우기', schedule: null })
    ]
    api.collection = {
      waiting: 18402,
      oldestQueuedAt: '2026-11-10T00:14:00.000Z',
      failures: [
        { failure: 'neople-internal', count: 41, lastAttemptedAt: '2026-11-10T05:28:00.000Z' }
      ]
    }

    await renderScreen(api)

    const stats = rowOf('통계')
    expect(stats.textContent).toContain('매일 00:00')
    expect(stats.textContent).toContain('0 0 * * *')
    expect(stats.textContent).toContain('11-11 00:00')
    expect(stats.textContent).toContain('성공')
    expect(stats.textContent).toContain('11-10 00:02:41')
    expect(stats.textContent).toContain('2분 41초')
    const manual = rowOf('스킬 스타일 표본 채우기')
    expect(manual.textContent).toContain('수동')
    expect(manual.querySelector('[role="switch"]')).toBeNull()
    expect(container.querySelector('header')?.textContent).toContain('worker14:311분 전')
    expect(container.querySelector('header')?.textContent).toContain('14:32:05')
    expect(section('수집 대기열').textContent).toContain('18,402')
    expect(section('수집 대기열').textContent).toContain('11-10 09:14')
    expect(section('수집 대기열').textContent).toContain('neople-internal41')
    expect(container.querySelector('section[aria-label="타임라인 queue"]')).toBeNull()

    await openTab('타임라인 queue')

    expect(section('타임라인 queue').textContent).toContain('옛 시즌 백필9,8701')
    expect(section('수집 대기열').textContent).toContain('18,402')
    expect(container.querySelector('section[aria-label="job"]')).toBeNull()
  })

  it('job을 Neople API 종류별로 묶어 머리줄에 endpoint를 보이고, Neople을 부르지 않는 job은 맨 뒤에 묶는다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [
      job({ name: 'cleanup', displayName: '실행 기록 정리', neopleApi: null }),
      job({
        name: 'clears',
        displayName: '클리어 기록 수집',
        neopleApi: { group: '캐릭터 타임라인', endpoints: ['/timeline'] }
      }),
      job({
        name: 'items',
        displayName: '아이템 사전 채우기',
        neopleApi: { group: '캐릭터 상세, 아이템', endpoints: ['/multi/items'] }
      }),
      job({
        name: 'score',
        displayName: '점수 계산',
        neopleApi: { group: '캐릭터 상세, 아이템', endpoints: ['/equip/*', '/multi/items'] }
      })
    ]

    await renderScreen(api)

    const groups = [...section('job').querySelectorAll('tbody')].map((body) => ({
      header: body.querySelector('th[scope="colgroup"]')?.textContent,
      jobs: [...body.querySelectorAll('tr')]
        .filter((row) => row.querySelector('td') !== null)
        .map((row) => jobNameIn(row).textContent)
    }))
    expect(groups).toEqual([
      {
        header: '캐릭터 상세, 아이템/multi/items/equip/*',
        jobs: ['아이템 사전 채우기', '점수 계산']
      },
      { header: '캐릭터 타임라인/timeline', jobs: ['클리어 기록 수집'] },
      { header: 'Neople 안 부름', jobs: ['실행 기록 정리'] }
    ])
  })

  it('job이 없으면 빈 목록 한 줄과 worker 시각 자리 표시만 보인다', async () => {
    const api = new FakeOpsApi()
    api.workerSeenAt = null

    await renderScreen(api)

    expect(section('job').textContent).toBe('Job등록된 job이 없습니다.')
    expect(container.querySelector('header')?.textContent).toContain('worker —')
  })

  it('실행을 요청하면 요청됨으로 바뀌고 실행 버튼이 잠긴다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [statsJob()]
    await renderScreen(api)

    await click(buttonIn(rowOf('통계'), '실행'))

    await waitFor(() => expect(rowOf('통계').textContent).toContain('요청됨'))
    expect(api.writes()).toMatchObject([
      { method: 'POST', path: '/api/jobs/stats/runs', body: { args: {} } }
    ])
    expect(buttonIn(rowOf('통계'), '실행').disabled).toBe(true)
    await waitFor(() => expect(section('실행 이력').textContent).toContain('통계stats수동요청됨'))
  })

  it('이미 실행 중이라 거절되면 거절 문구를 보이고 실행 중인 상태로 다시 읽는다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [statsJob()]
    await renderScreen(api)
    const target = api.jobs[0]
    if (target === undefined) {
      throw new Error('job이 없습니다.')
    }
    target.activeRun = run({
      id: 11,
      trigger: 'manual',
      status: 'running',
      startedAt: '2026-11-10T05:32:01.000Z',
      finishedAt: null
    })

    await click(buttonIn(rowOf('통계'), '실행'))

    await waitFor(() => expect(rowOf('통계').textContent).toContain('이미 실행 중입니다.'))
    expect(rowOf('통계').querySelector('[role="alert"]')?.textContent).toBe('이미 실행 중입니다.')
    expect(rowOf('통계').querySelectorAll('td')[3]?.textContent).toBe('실행 중')
    expect(buttonIn(rowOf('통계'), '실행').disabled).toBe(true)
  })

  it('정기 실행 스위치를 끄면 다음 실행 자리에 정지가 보이고 다시 켜면 시각이 돌아온다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [statsJob()]
    await renderScreen(api)
    const toggle = () => rowOf('통계').querySelector<HTMLElement>('[role="switch"]')

    await click(toggle() as HTMLElement)
    await waitFor(() => expect(rowOf('통계').textContent).toContain('정지'))
    expect(toggle()?.getAttribute('aria-checked')).toBe('false')
    expect(rowOf('통계').textContent).not.toContain('11-11 00:00')

    await click(toggle() as HTMLElement)
    await waitFor(() => expect(rowOf('통계').textContent).toContain('11-11 00:00'))
    expect(api.writes().map(({ path }) => path)).toEqual([
      '/api/jobs/stats/pause',
      '/api/jobs/stats/resume'
    ])
  })

  it('실행 이력은 job을 고르지 않아도 모든 job의 실행을 최신순으로 job 이름과 함께 보이고 더 보기로 다음 쪽을 읽는다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [statsJob(), job({ name: 'cleanup', displayName: '실행 기록 정리' })]
    api.runPageSize = 2
    api.runs.cleanup = [run({ id: 13, summary: { deleted: 4 } })]
    api.runs.stats = [
      run({
        id: 12,
        trigger: 'catchup',
        status: 'failed',
        progress: { done: 21, total: 132 },
        error: [{ name: 'PrismaClientKnownRequestError', code: 'P2024' }]
      }),
      run({ id: 11, status: 'interrupted', progress: { done: 64, total: 132 } }),
      run({ id: 10, summary: { total: 132 } })
    ]
    await renderScreen(api)

    const historyJobs = () =>
      [...section('실행 이력').querySelectorAll('tbody tr')].map(
        (row) => row.querySelector('td')?.textContent
      )
    expect(historyJobs()).toEqual(['실행 기록 정리cleanup', '통계stats'])
    expect(section('실행 이력').textContent).toContain('보충')
    expect(section('실행 이력').textContent).toContain('PrismaClientKnownRequestErrorP2024')
    expect(section('실행 이력').textContent).toContain('21 / 132')

    await click(buttonIn(section('실행 이력'), '더 보기'))

    await waitFor(() => expect(historyJobs()).toHaveLength(4))
    expect(section('실행 이력').textContent).toContain('중단')
    expect(section('실행 이력').textContent).toContain('64 / 132')
  })

  it('실행 중인 job은 진행률과 처리 수를 보이고 실행 버튼이 잠긴다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [
      job({
        name: 'skill-adoption',
        displayName: '스킬 채택률',
        activeRun: run({
          id: 20,
          trigger: 'manual',
          status: 'running',
          startedAt: '2026-11-10T05:20:02.000Z',
          finishedAt: null,
          progress: { done: 87, total: 132 }
        })
      })
    ]

    await renderScreen(api)

    expect(rowOf('스킬 채택률').textContent).toContain('실행 중87 / 132')
    expect(buttonIn(rowOf('스킬 채택률'), '실행').disabled).toBe(true)
  })

  it('worker를 마지막으로 본 시각과 경과 시간을 분 단위로 보인다', async () => {
    const api = new FakeOpsApi()
    api.workerSeenAt = '2026-11-10T04:05:00.000Z'
    api.jobs = [statsJob()]

    await renderScreen(api)

    expect(container.querySelector('header')?.textContent).toContain('worker13:0587분 전')
  })

  it('실패 종류를 되돌리면 확인한 뒤 요청하고 그 종류가 목록에서 빠진다', async () => {
    const api = new FakeOpsApi()
    api.collection = {
      waiting: 100,
      oldestQueuedAt: null,
      failures: [
        { failure: 'neople-api', count: 7, lastAttemptedAt: null },
        { failure: 'neople-internal', count: 41, lastAttemptedAt: null }
      ]
    }
    await renderScreen(api)
    const internalRow = [...section('수집 대기열').querySelectorAll('tbody tr')].find((row) =>
      row.textContent?.includes('neople-internal')
    ) as HTMLElement

    await click(buttonIn(internalRow, '되돌리기'))
    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]')
    expect(dialog?.textContent).toContain('neople-internal 41건 되돌리기')
    expect(api.writes()).toEqual([])

    await click(buttonIn(dialog as HTMLElement, '되돌리기'))

    await waitFor(() => expect(section('수집 대기열').textContent).not.toContain('neople-internal'))
    expect(api.writes()).toMatchObject([
      { path: '/api/collection/requeue', body: { failure: 'neople-internal' } }
    ])
    expect(section('수집 대기열').textContent).toContain('141')
  })

  it('인자 schema가 있는 job은 입력 팝오버에서 넣은 값만 타입에 맞춰 보낸다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [
      job({
        name: 'skill-style-sample',
        displayName: '스킬 스타일 표본 채우기',
        schedule: null,
        argsSchema: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            serverId: { type: 'string', enum: ['cain', 'siroco'] }
          },
          required: ['limit']
        }
      })
    ]
    await renderScreen(api)

    await click(buttonIn(rowOf('스킬 스타일 표본 채우기'), '실행'))
    const limit = document.body.querySelector<HTMLInputElement>('input[type="number"]')
    expect(text()).toContain('limitinteger')
    expect(text()).toContain('serverId선택')
    typeInto(limit as HTMLInputElement, '5000')
    const form = limit?.closest('form') as HTMLFormElement
    await click(buttonIn(form, '실행'))

    await waitFor(() => expect(api.writes()).toHaveLength(1))
    expect(api.writes()[0]).toMatchObject({
      path: '/api/jobs/skill-style-sample/runs',
      body: { args: { limit: 5000 } }
    })
  })
})

// batch key 원문은 모두 합성 값이며 실제 Neople key가 아니다.
const NEW_KEY = 'synthetic-batch-key-0000-9d4e'

function batchKeyRowOf(label: string): HTMLTableRowElement {
  const row = [...section('batch key').querySelectorAll('tbody tr')].find(
    (candidate) => candidate.querySelector('td')?.textContent === label
  )

  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`${label} 행이 없습니다.`)
  }

  return row
}

function batchKeyInput(id: 'batch-key-label' | 'batch-key-value'): HTMLInputElement {
  const input = section('batch key').querySelector<HTMLInputElement>(`#${id}`)

  if (input === null) {
    throw new Error(`${id} 입력란이 없습니다.`)
  }

  return input
}

async function submitBatchKey(label: string, key: string): Promise<void> {
  typeInto(batchKeyInput('batch-key-label'), label)
  typeInto(batchKeyInput('batch-key-value'), key)
  const form = batchKeyInput('batch-key-value').form as HTMLFormElement
  act(() => form.requestSubmit())
  await flush()
}

describe('batch key 패널', () => {
  it('key를 추가하면 끝 4자로 목록에 나타나고 입력란을 비우며 원문은 화면 어디에도 없다', async () => {
    const api = new FakeOpsApi()
    await renderScreen(api)
    await openTab('batch key')
    expect(batchKeyInput('batch-key-value').type).toBe('password')

    await submitBatchKey('batch5', NEW_KEY)

    await waitFor(() => expect(batchKeyRowOf('batch5').textContent).toContain('••••9d4e'))
    expect(api.writes()).toMatchObject([
      {
        method: 'POST',
        path: '/api/batch-neople-keys',
        contentType: 'application/json',
        body: { label: 'batch5', key: NEW_KEY }
      }
    ])
    expect(batchKeyRowOf('batch5').textContent).toContain('사용')
    expect(section('batch key').querySelector('h2')?.textContent).toBe('batch key1')
    expect(batchKeyInput('batch-key-label').value).toBe('')
    expect(batchKeyInput('batch-key-value').value).toBe('')
    expect(document.body.innerHTML).not.toContain(NEW_KEY)
  })

  it('사용 스위치를 끄면 꺼짐으로 바뀌고 다시 켜면 사용으로 돌아온다', async () => {
    const api = new FakeOpsApi()
    const added = api.addBatchKey('batch1', 'synthetic-batch-key-0001-3f9a')
    await renderScreen(api)
    await openTab('batch key')
    const toggle = () => batchKeyRowOf('batch1').querySelector<HTMLElement>('[role="switch"]')

    await click(toggle() as HTMLElement)
    await waitFor(() => expect(batchKeyRowOf('batch1').textContent).toContain('꺼짐'))
    expect(toggle()?.getAttribute('aria-checked')).toBe('false')

    await click(toggle() as HTMLElement)
    await waitFor(() => expect(batchKeyRowOf('batch1').textContent).toContain('사용'))
    expect(api.writes().map(({ method, path }) => `${method} ${path}`)).toEqual([
      `POST /api/batch-neople-keys/${added.id}/disable`,
      `POST /api/batch-neople-keys/${added.id}/enable`
    ])
  })

  it('Neople이 거절한 key는 거절됨과 거절 시각을 보이고 다시 켜면 사용으로 바뀐다', async () => {
    const api = new FakeOpsApi()
    api.addBatchKey('batch4', 'synthetic-batch-key-0004-41b2', {
      enabled: false,
      rejectedAt: '2026-11-10T06:04:00.000Z'
    })
    await renderScreen(api)
    await openTab('batch key')

    expect(batchKeyRowOf('batch4').textContent).toContain('거절됨11-10 15:04')

    await click(batchKeyRowOf('batch4').querySelector('[role="switch"]') as HTMLElement)

    await waitFor(() => expect(batchKeyRowOf('batch4').textContent).not.toContain('거절됨'))
    expect(batchKeyRowOf('batch4').textContent).toContain('사용')
    expect(batchKeyRowOf('batch4').textContent).not.toContain('15:04')
  })

  it('같은 key를 다시 넣으면 key 입력란 아래에 오류를 보이고 목록은 그대로다', async () => {
    const api = new FakeOpsApi()
    api.addBatchKey('batch1', NEW_KEY)
    await renderScreen(api)
    await openTab('batch key')

    await submitBatchKey('batch5', NEW_KEY)

    await waitFor(() =>
      expect(section('batch key').querySelector('[role="alert"]')?.textContent).toBe(
        '이미 있는 key입니다.'
      )
    )
    expect(batchKeyInput('batch-key-value').getAttribute('aria-invalid')).toBe('true')
    expect(section('batch key').querySelectorAll('tbody tr')).toHaveLength(1)
    expect(api.batchKeys.map(({ label }) => label)).toEqual(['batch1'])
  })

  it('이름이 비면 오류를 보이고 key를 추가하지 않는다', async () => {
    const api = new FakeOpsApi()
    await renderScreen(api)
    await openTab('batch key')

    await submitBatchKey('  ', NEW_KEY)

    await waitFor(() =>
      expect(section('batch key').querySelector('[role="alert"]')?.textContent).toBe(
        '이름과 key를 넣어야 합니다.'
      )
    )
    expect(api.batchKeys).toEqual([])
  })

  it('key가 없으면 추가 줄 아래에 빈 목록 한 줄만 보인다', async () => {
    const api = new FakeOpsApi()

    await renderScreen(api)
    await openTab('batch key')

    expect(section('batch key').querySelector('table')).toBeNull()
    expect(section('batch key').querySelector('p')?.textContent).toBe('batch key가 없습니다.')
    expect(section('batch key').querySelector('h2')?.textContent).toBe('batch key0')
  })

  it('삭제는 이름을 확인한 뒤 요청하고 그 key가 목록에서 빠진다', async () => {
    const api = new FakeOpsApi()
    const added = api.addBatchKey('batch3', 'synthetic-batch-key-0003-8e5d')
    await renderScreen(api)
    await openTab('batch key')

    await click(buttonIn(batchKeyRowOf('batch3'), '삭제'))
    const dialog = document.body.querySelector<HTMLElement>('[role="alertdialog"]')
    expect(dialog?.textContent).toContain('batch3 삭제')
    expect(api.writes()).toEqual([])

    await click(buttonIn(dialog as HTMLElement, '삭제'))

    await waitFor(() =>
      expect(section('batch key').querySelector('p')?.textContent).toBe('batch key가 없습니다.')
    )
    expect(api.writes()).toMatchObject([
      {
        method: 'DELETE',
        path: `/api/batch-neople-keys/${added.id}`,
        contentType: 'application/json'
      }
    ])
  })
})

// 실험실 아이템 이름은 모두 지어낸 이름이다.
const WEAPON_DEALER_FINAL = { category: 'WEAPON', role: 'dealer', tier: '종결' }
const TITLE_FINAL = { category: 'TITLE', role: 'all', tier: '종결' }
const NO_TOOLTIP = { itemTypeDetail: null, availableLevel: null, fame: null, card: null }
// 운영 화면은 아이템 종류를 입력 칸의 글자 그대로 보낸다.
const EMPTY_TOOLTIP_DRAFT = { ...NO_TOOLTIP, itemTypeDetail: '' }

function unpriced(itemName: string) {
  return { itemName, cost: null }
}

function labGroup(title: string): HTMLFieldSetElement {
  const group = [...section('실험실 아이템').querySelectorAll('fieldset')].find(
    (candidate) => candidate.querySelector('legend')?.textContent === title
  )
  if (group === undefined) {
    throw new Error(`${title} 묶음이 없습니다.`)
  }

  return group
}

function labGroupTitles(): string[] {
  return [...section('실험실 아이템').querySelectorAll('legend')].map(
    (legend) => legend.textContent ?? ''
  )
}

function labCheckbox(title: string, name: string): HTMLElement {
  const checkbox = labGroup(title).querySelector<HTMLElement>(
    `[role="checkbox"][aria-label="${name}"]`
  )
  if (checkbox === null) {
    throw new Error(`${title}에 ${name} 줄이 없습니다.`)
  }

  return checkbox
}

function checkedNames(title: string): [string | null, boolean][] {
  const boxes = labGroup(title).querySelectorAll<HTMLElement>('[role="checkbox"]')

  return [...boxes].map((box) => [
    box.getAttribute('aria-label'),
    box.getAttribute('aria-checked') === 'true'
  ])
}

async function uploadCandidateFile(content: unknown): Promise<void> {
  const input = section('실험실 아이템').querySelector<HTMLInputElement>('input[type="file"]')
  if (input === null) {
    throw new Error('후보 파일 입력이 없습니다.')
  }
  const text = typeof content === 'string' ? content : JSON.stringify(content)
  await chooseFile(input, new File([text], 'candidates.json', { type: 'application/json' }))
}

async function chooseFile(input: HTMLInputElement, file: File): Promise<void> {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  act(() => input.dispatchEvent(new Event('change', { bubbles: true })))
  await flush()
}

function labelled<Element extends HTMLElement>(scope: ParentNode, label: string): Element {
  const element = scope.querySelector<Element>(`[aria-label="${label}"]`)

  if (element === null) {
    throw new Error(`${label} 입력이 없습니다.`)
  }

  return element
}

async function openLabItems(api: FakeOpsApi): Promise<void> {
  await renderScreen(api)
  await openTab('실험실 아이템')
  await waitFor(() => expect(labGroupTitles()).toContain('칭호 종결'))
}

describe('실험실 아이템 패널', () => {
  it('후보 파일을 올리면 묶음별 후보가 보이고 DB에 있는 이름만 체크되며 쓰기 요청은 가지 않는다', async () => {
    const api = new FakeOpsApi()
    api.labItems = [
      { ...WEAPON_DEALER_FINAL, items: [unpriced('합성 카드 A'), unpriced('합성 카드 DB')] }
    ]
    await openLabItems(api)

    await uploadCandidateFile({
      version: 1,
      groups: [
        { ...WEAPON_DEALER_FINAL, itemNames: ['합성 카드 A', '합성 카드 B', '합성 카드 B'] },
        { ...TITLE_FINAL, itemNames: ['합성 칭호 A'] },
        { category: 'WAIST', role: 'buffer', tier: '준종결', itemNames: ['합성 카드 C'] }
      ]
    })

    await waitFor(() =>
      expect(checkedNames('무기 딜러 종결')).toEqual([
        ['합성 카드 A', true],
        ['합성 카드 DB', true],
        ['합성 카드 B', false]
      ])
    )
    expect(checkedNames('칭호 종결')).toEqual([['합성 칭호 A', false]])
    expect(labGroupTitles()).toContain('벨트 딜러 준종결')
    expect(checkedNames('벨트 버퍼 준종결')).toEqual([['합성 카드 C', false]])
    expect(buttonIn(section('실험실 아이템'), '저장').disabled).toBe(true)
    expect(api.writes()).toEqual([])
  })

  it('칭호 종결 묶음에 이름을 직접 넣어 저장하면 그 묶음만 PUT으로 보내 DB에 들어간다', async () => {
    const api = new FakeOpsApi()
    await openLabItems(api)

    const input = labGroup('칭호 종결').querySelector<HTMLInputElement>('input[type="text"]')
    typeInto(input as HTMLInputElement, ' 합성 칭호 새 이름 ')
    await click(buttonIn(labGroup('칭호 종결'), '추가'))

    expect(checkedNames('칭호 종결')).toEqual([['합성 칭호 새 이름', true]])
    expect(api.writes()).toEqual([])

    await click(buttonIn(section('실험실 아이템'), '저장'))

    await waitFor(() =>
      expect(api.labItems).toEqual([{ ...TITLE_FINAL, items: [unpriced('합성 칭호 새 이름')] }])
    )
    expect(api.writes()).toMatchObject([
      {
        method: 'PUT',
        path: '/api/lab-items',
        contentType: 'application/json',
        body: { ...TITLE_FINAL, items: [unpriced('합성 칭호 새 이름')] }
      }
    ])
    await waitFor(() => expect(buttonIn(section('실험실 아이템'), '저장').disabled).toBe(true))
    expect(checkedNames('칭호 종결')).toEqual([['합성 칭호 새 이름', true]])
  })

  it('등급표에 없는 벨트 버퍼 준종결 묶음에도 이름을 넣어 저장할 수 있다', async () => {
    const api = new FakeOpsApi()
    await openLabItems(api)

    const input = labGroup('벨트 버퍼 준종결').querySelector<HTMLInputElement>('input[type="text"]')
    typeInto(input as HTMLInputElement, '합성 벨트 카드')
    await click(buttonIn(labGroup('벨트 버퍼 준종결'), '추가'))
    await click(buttonIn(section('실험실 아이템'), '저장'))

    const waistBuffer = { category: 'WAIST', role: 'buffer', tier: '준종결' }
    await waitFor(() =>
      expect(api.labItems).toEqual([{ ...waistBuffer, items: [unpriced('합성 벨트 카드')] }])
    )
  })

  it('마법부여 부위와 역할마다, 칭호, 크리쳐, 오라마다 배럭 묶음이 준종결 뒤에 있고, 후보 파일의 배럭 묶음도 읽는다', async () => {
    const api = new FakeOpsApi()
    await openLabItems(api)

    const titles = labGroupTitles()
    expect(titles.slice(0, 6)).toEqual([
      '무기 딜러 종결',
      '무기 딜러 준종결',
      '무기 딜러 배럭',
      '무기 버퍼 종결',
      '무기 버퍼 준종결',
      '무기 버퍼 배럭'
    ])
    expect(titles).toEqual(expect.arrayContaining(['칭호 배럭', '크리쳐 배럭', '오라 배럭']))

    await uploadCandidateFile({
      version: 1,
      groups: [{ category: 'AURA', role: 'all', tier: '배럭', itemNames: ['합성 오라'] }]
    })

    await waitFor(() => expect(checkedNames('오라 배럭')).toEqual([['합성 오라', false]]))
  })

  it('두 묶음 가운데 한 묶음만 체크가 바뀌면 그 묶음의 PUT 한 번만 보낸다', async () => {
    const api = new FakeOpsApi()
    api.labItems = [
      { ...WEAPON_DEALER_FINAL, items: [unpriced('합성 카드 A'), unpriced('합성 카드 B')] },
      { ...TITLE_FINAL, items: [unpriced('합성 칭호 A')] }
    ]
    await openLabItems(api)

    await click(labCheckbox('칭호 종결', '합성 칭호 A'))
    await click(labCheckbox('칭호 종결', '합성 칭호 A'))
    await click(labCheckbox('무기 딜러 종결', '합성 카드 A'))
    await click(buttonIn(section('실험실 아이템'), '저장'))

    await waitFor(() => expect(buttonIn(section('실험실 아이템'), '저장').disabled).toBe(true))
    expect(api.writes()).toHaveLength(1)
    expect(api.writes()[0]?.body).toEqual({
      ...WEAPON_DEALER_FINAL,
      items: [unpriced('합성 카드 B')]
    })
    expect(api.labItems).toEqual([
      { ...TITLE_FINAL, items: [unpriced('합성 칭호 A')] },
      { ...WEAPON_DEALER_FINAL, items: [unpriced('합성 카드 B')] }
    ])
  })

  it('형식이 틀린 후보 파일은 오류 문구만 보이고 먼저 올린 후보를 그대로 둔다', async () => {
    const api = new FakeOpsApi()
    await openLabItems(api)
    await uploadCandidateFile({
      version: 1,
      groups: [{ ...TITLE_FINAL, itemNames: ['합성 칭호 A'] }]
    })
    await waitFor(() => expect(checkedNames('칭호 종결')).toEqual([['합성 칭호 A', false]]))

    const invalidFiles = [
      '{',
      { version: 2, groups: [] },
      { version: 1, groups: [{ ...TITLE_FINAL, role: 'dealer', itemNames: ['합성 칭호 B'] }] },
      { version: 1, groups: [{ ...TITLE_FINAL, itemNames: ['  '] }] }
    ]

    for (const invalid of invalidFiles) {
      await uploadCandidateFile(invalid)

      await waitFor(() =>
        expect(section('실험실 아이템').querySelector('[role="alert"]')?.textContent).toBe(
          '후보 파일 형식이 맞지 않습니다.'
        )
      )
      expect(checkedNames('칭호 종결')).toEqual([['합성 칭호 A', false]])
    }

    expect(api.writes()).toEqual([])
  })
})

// 합성 그림이다. 화면은 파일을 base64로 바꿔 보내기만 하고, 형식 판정은 운영 app 테스트가 맡는다.
const ICON_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff])
const ICON_BASE64 = 'iVBORwD/'

describe('실험실 재화와 아이템 비용', () => {
  it('재화 이름, 설명과 아이콘 파일을 넣어 추가하면 base64 아이콘과 함께 POST하고 목록에 보인다', async () => {
    const api = new FakeOpsApi()
    await openLabItems(api)
    const currencies = section('실험실 재화')

    typeInto(labelled(currencies, '새 재화 이름'), ' 합성 재화 ')
    typeInto(labelled(currencies, '새 재화 설명'), '합성 설명')
    await chooseFile(
      labelled(currencies, '새 재화 아이콘'),
      new File([ICON_BYTES], 'coin.png', { type: 'image/png' })
    )
    await click(buttonIn(currencies, '추가'))

    await waitFor(() => expect(api.labCurrencies.map(({ name }) => name)).toEqual(['합성 재화']))
    expect(api.writes()).toMatchObject([
      {
        method: 'POST',
        path: '/api/lab-currencies',
        contentType: 'application/json',
        body: { name: '합성 재화', description: '합성 설명', icon: ICON_BASE64 }
      }
    ])
    await waitFor(() =>
      expect(labelled<HTMLInputElement>(section('실험실 재화'), '합성 재화 이름').value).toBe(
        '합성 재화'
      )
    )
    expect(section('실험실 재화').querySelector('img')?.getAttribute('src')).toMatch(
      /^http:\/\/ops\.test\/api\/lab-currencies\/1\/icon\?v=\d+$/
    )
  })

  it('재화 설명만 고쳐도 저장할 수 있고, 비운 설명도 그대로 보낸다', async () => {
    const api = new FakeOpsApi()
    api.labCurrencies = [
      { id: 1, name: '합성 재화', description: '합성 설명', updatedAt: NOW.toISOString() }
    ]
    await openLabItems(api)
    const row = labelled(section('실험실 재화'), '합성 재화 재화')
    const description = labelled<HTMLTextAreaElement>(row, '합성 재화 설명')
    expect(description.value).toBe('합성 설명')
    expect(buttonIn(row, '저장').disabled).toBe(true)

    typeInto(description, '바뀐 합성 설명')
    await click(buttonIn(row, '저장'))
    await waitFor(() => expect(api.labCurrencies[0]?.description).toBe('바뀐 합성 설명'))

    // 저장하면 아이콘 파일 입력을 비우려고 form을 다시 그리므로 다시 찾는다.
    const savedRow = labelled(section('실험실 재화'), '합성 재화 재화')
    typeInto(labelled(savedRow, '합성 재화 설명'), '  ')
    await click(buttonIn(savedRow, '저장'))
    await waitFor(() => expect(api.writes()).toHaveLength(2))
    expect(api.writes().map(({ body }) => body)).toEqual([
      { name: '합성 재화', description: '바뀐 합성 설명' },
      { name: '합성 재화', description: '  ' }
    ])
  })

  it('이미 있는 이름으로 재화를 고치면 겹친다는 문구를 보이고 바꾸지 않는다', async () => {
    const api = new FakeOpsApi()
    api.labCurrencies = [
      { id: 1, name: '합성 재화 A', description: null, updatedAt: NOW.toISOString() },
      { id: 2, name: '합성 재화 B', description: null, updatedAt: NOW.toISOString() }
    ]
    await openLabItems(api)
    const row = labelled(section('실험실 재화'), '합성 재화 B 재화')

    typeInto(labelled(row, '합성 재화 B 이름'), '합성 재화 A')
    await click(buttonIn(row, '저장'))

    await waitFor(() =>
      expect(row.querySelector('[role="alert"]')?.textContent).toBe('같은 이름의 재화가 있습니다.')
    )
    expect(api.labCurrencies.map(({ name }) => name)).toEqual(['합성 재화 A', '합성 재화 B'])
  })

  it('아이템 줄에서 재화와 개수를 고르면 그 묶음을 비용과 함께 PUT하고, 경매장으로 되돌리면 비용을 지운다', async () => {
    const api = new FakeOpsApi()
    api.labCurrencies = [
      { id: 1, name: '합성 재화', description: null, updatedAt: NOW.toISOString() }
    ]
    api.labItems = [
      { ...WEAPON_DEALER_FINAL, items: [unpriced('합성 보주'), unpriced('합성 카드 A')] }
    ]
    await openLabItems(api)
    const group = labGroup('무기 딜러 종결')
    await waitFor(() =>
      expect(labelled(group, '합성 보주 재화').textContent).toContain('합성 재화')
    )

    selectOption(labelled(group, '합성 보주 재화'), '1')
    typeInto(labelled(group, '합성 보주 개수'), '5')
    await click(buttonIn(section('실험실 아이템'), '저장'))

    const exchanged = { itemName: '합성 보주', cost: { currencyId: 1, count: 5 } }
    await waitFor(() =>
      expect(api.labItems).toEqual([
        { ...WEAPON_DEALER_FINAL, items: [exchanged, unpriced('합성 카드 A')] }
      ])
    )
    await waitFor(() => expect(buttonIn(section('실험실 아이템'), '저장').disabled).toBe(true))
    expect(labelled<HTMLInputElement>(group, '합성 보주 개수').value).toBe('5')

    selectOption(labelled(group, '합성 보주 재화'), '')
    expect(group.querySelector('[aria-label="합성 보주 개수"]')).toBeNull()
    await click(buttonIn(section('실험실 아이템'), '저장'))

    await waitFor(() =>
      expect(api.labItems).toEqual([
        { ...WEAPON_DEALER_FINAL, items: [unpriced('합성 보주'), unpriced('합성 카드 A')] }
      ])
    )
    expect(api.writes().filter(({ path }) => path === '/api/lab-items')).toHaveLength(2)
  })

  it('재화 개수가 1 이상의 정수가 아니면 저장 버튼을 막는다', async () => {
    const api = new FakeOpsApi()
    api.labCurrencies = [
      { id: 1, name: '합성 재화', description: null, updatedAt: NOW.toISOString() }
    ]
    api.labItems = [{ ...TITLE_FINAL, items: [unpriced('합성 칭호 A')] }]
    await openLabItems(api)
    const group = labGroup('칭호 종결')
    await waitFor(() =>
      expect(labelled(group, '합성 칭호 A 재화').textContent).toContain('합성 재화')
    )

    selectOption(labelled(group, '합성 칭호 A 재화'), '1')

    for (const count of ['0', '', '1.5']) {
      typeInto(labelled(group, '합성 칭호 A 개수'), count)
      expect(buttonIn(section('실험실 아이템'), '저장').disabled, count).toBe(true)
    }

    typeInto(labelled(group, '합성 칭호 A 개수'), '2')
    expect(buttonIn(section('실험실 아이템'), '저장').disabled).toBe(false)
    expect(api.writes()).toEqual([])
  })
})

describe('실험실 아이템 상세', () => {
  function detailRow(itemName: string): HTMLElement {
    return labelled(section('실험실 아이템 상세'), `${itemName} 상세`)
  }

  it('고른 아이템 이름마다 한 줄을 두고, 등급, 설명, 아이콘을 넣어 저장하면 이름과 함께 PUT한다', async () => {
    const api = new FakeOpsApi()
    api.labItems = [
      { ...WEAPON_DEALER_FINAL, items: [unpriced('합성 상자'), unpriced('합성 카드 A')] },
      { ...TITLE_FINAL, items: [unpriced('합성 상자')] }
    ]
    await openLabItems(api)
    await waitFor(() => expect(detailRow('합성 카드 A')).toBeDefined())
    const items = section('실험실 아이템 상세').querySelectorAll('form')
    expect([...items].map((form) => form.getAttribute('aria-label'))).toEqual([
      '합성 상자 상세',
      '합성 카드 A 상세'
    ])

    const row = detailRow('합성 상자')
    expect(buttonIn(row, '저장').disabled).toBe(true)
    selectOption(labelled(row, '합성 상자 등급'), '태초')
    typeInto(labelled(row, '합성 상자 설명'), '합성 설명')
    await chooseFile(
      labelled(row, '합성 상자 아이콘'),
      new File([ICON_BYTES], 'box.png', { type: 'image/png' })
    )
    await click(buttonIn(row, '저장'))

    await waitFor(() => expect(api.labItemDetails).toHaveLength(1))
    expect(api.writes()).toMatchObject([
      {
        method: 'PUT',
        path: '/api/lab-item-details',
        body: {
          itemName: '합성 상자',
          description: '합성 설명',
          itemRarity: '태초',
          icon: ICON_BASE64
        }
      }
    ])
  })

  it('아이콘을 고르지 않고 저장하면 icon 없이 보내고, 아이콘 지우기를 고르면 icon을 null로 보내며, Neople을 고르면 등급을 비운다', async () => {
    const api = new FakeOpsApi()
    api.labItems = [{ ...TITLE_FINAL, items: [unpriced('합성 상자')] }]
    api.labItemDetails = [
      {
        itemName: '합성 상자',
        description: '합성 설명',
        itemRarity: '유니크',
        ...NO_TOOLTIP,
        hasIcon: true,
        updatedAt: NOW.toISOString()
      }
    ]
    await openLabItems(api)
    await waitFor(() => expect(detailRow('합성 상자')).toBeDefined())
    expect(detailRow('합성 상자').querySelector('img')?.getAttribute('src')).toBe(
      `http://ops.test/api/lab-item-details/icon?itemName=%ED%95%A9%EC%84%B1+%EC%83%81%EC%9E%90&v=${NOW.getTime()}`
    )

    selectOption(labelled(detailRow('합성 상자'), '합성 상자 등급'), '')
    await click(buttonIn(detailRow('합성 상자'), '저장'))
    await waitFor(() => expect(api.writes()).toHaveLength(1))

    await click(labelled(detailRow('합성 상자'), '합성 상자 아이콘 지우기'))
    await click(buttonIn(detailRow('합성 상자'), '저장'))
    await waitFor(() => expect(api.labItemDetails[0]?.hasIcon).toBe(false))

    expect(api.writes().map(({ body }) => body)).toEqual([
      { itemName: '합성 상자', description: '합성 설명', itemRarity: null, ...EMPTY_TOOLTIP_DRAFT },
      {
        itemName: '합성 상자',
        description: '합성 설명',
        itemRarity: null,
        ...EMPTY_TOOLTIP_DRAFT,
        icon: null
      }
    ])
  })

  it('저장한 아이템 종류, 레벨제한, 명성, 부위, 옵션을 칸에 보이고, 고친 옵션 줄을 단계별 카드로 바꿔 보낸다', async () => {
    const api = new FakeOpsApi()
    api.labItems = [{ ...TITLE_FINAL, items: [unpriced('합성 상자')] }]
    api.labItemDetails = [
      {
        itemName: '합성 상자',
        description: null,
        itemRarity: null,
        itemTypeDetail: '합성 재료',
        availableLevel: 115,
        fame: 232,
        card: {
          slots: ['상의', '하의'],
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
        updatedAt: NOW.toISOString()
      }
    ]
    await openLabItems(api)
    await waitFor(() => expect(detailRow('합성 상자')).toBeDefined())
    // 저장하면 form을 새로 그리므로 칸은 그때마다 찾는다.
    const field = (name: string) =>
      labelled<HTMLInputElement>(detailRow('합성 상자'), `합성 상자 ${name}`)

    expect(
      ['아이템 종류', '레벨제한', '모험가 명성', '부위', '옵션'].map((name) => field(name).value)
    ).toEqual(['합성 재료', '115', '232', '상의, 하의', '힘 | 90 | 100\n지능 | - | 20'])
    expect(buttonIn(detailRow('합성 상자'), '저장').disabled).toBe(true)

    typeInto(field('레벨제한'), '')
    typeInto(field('부위'), ' 상의 ,, 벨트 ')
    typeInto(field('옵션'), '힘|90|100|110\n\n지능 | - | - | 20')
    await click(buttonIn(detailRow('합성 상자'), '저장'))
    await waitFor(() => expect(api.writes()).toHaveLength(1))

    expect(api.writes()[0]?.body).toEqual({
      itemName: '합성 상자',
      description: '',
      itemRarity: null,
      itemTypeDetail: '합성 재료',
      availableLevel: null,
      fame: 232,
      card: {
        slots: ['상의', '벨트'],
        enchants: [
          { upgrade: 0, status: [{ name: '힘', value: '90' }] },
          { upgrade: 1, status: [{ name: '힘', value: '100' }] },
          {
            upgrade: 2,
            status: [
              { name: '힘', value: '110' },
              { name: '지능', value: '20' }
            ]
          }
        ]
      }
    })
    await waitFor(() => expect(field('옵션').value).toBe('힘 | 90 | 100 | 110\n지능 | - | - | 20'))
    expect(buttonIn(detailRow('합성 상자'), '저장').disabled).toBe(true)
  })

  it('양의 정수가 아닌 레벨제한, 부위나 옵션 한쪽만, 값 개수가 다르거나 빈 옵션 칸, 운영 app 상한을 넘는 옵션은 저장하지 않는다', async () => {
    const api = new FakeOpsApi()
    api.labItems = [{ ...TITLE_FINAL, items: [unpriced('합성 상자')] }]
    await openLabItems(api)
    await waitFor(() => expect(detailRow('합성 상자')).toBeDefined())
    const row = detailRow('합성 상자')
    const field = (name: string) => labelled<HTMLInputElement>(row, `합성 상자 ${name}`)
    const expectUnsaved = (label: string) => {
      expect(buttonIn(row, '저장').disabled, label).toBe(true)
      expect(row.querySelector('[role="alert"]'), label).not.toBeNull()
    }
    const singleCases: [string, string][] = [
      ['레벨제한', '0'],
      ['레벨제한', '1.5'],
      ['모험가 명성', '많음'],
      ['옵션', '힘 | 90'],
      ['부위', '상의']
    ]

    for (const [name, value] of singleCases) {
      typeInto(field(name), value)
      expectUnsaved(`${name} ${value}`)
      typeInto(field(name), '')
    }

    typeInto(field('부위'), '상의')
    const optionCases = [
      '힘 | 90 | 100\n지능 | 20',
      '힘',
      '힘 | 90 | ',
      `힘${' | 90'.repeat(6)}`,
      `${'가'.repeat(41)} | 90`
    ]

    for (const options of optionCases) {
      typeInto(field('옵션'), options)
      expectUnsaved(options)
    }

    typeInto(field('옵션'), '힘 | 90')
    expect(buttonIn(row, '저장').disabled).toBe(false)
    expect(api.writes()).toEqual([])
  })
})
