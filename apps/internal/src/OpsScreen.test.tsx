// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOpsClient } from './api/ops-client'
import { OpsApp } from './OpsApp'
import { FakeOpsApi, job, run } from './testing/fake-ops-api'

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
  const row = [...section('job').querySelectorAll('tbody tr')].find((candidate) =>
    candidate.textContent?.includes(name)
  )
  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`${name} 행이 없습니다.`)
  }

  return row
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

function typeInto(input: HTMLInputElement, value: string): void {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setValue?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
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
    focusOn(buttonIn(rowOf('통계'), '통계'))

    await waitFor(() => expect(tooltip()).not.toBeNull())
    expect(tooltip()?.textContent).toBe('직업별 통계를 다시 계산한다')

    blurFrom(buttonIn(rowOf('통계'), '통계'))
    await waitFor(() => expect(tooltip()).toBeNull())
  })

  it('설명이 빈 job은 Tooltip을 열지 않는다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [statsJob()]

    await renderScreen(api)
    focusOn(buttonIn(rowOf('통계'), '통계'))
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await flush()
    }

    expect(tooltip()).toBeNull()
  })

  it('job 목록에 스케줄, 다음 실행, 마지막 실행과 걸린 시간, queue와 수집 대기열을 보인다', async () => {
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
    expect(section('타임라인 queue').textContent).toContain('옛 시즌 백필9,8701')
    expect(section('수집 대기열').textContent).toContain('18,402')
    expect(section('수집 대기열').textContent).toContain('11-10 09:14')
    expect(section('수집 대기열').textContent).toContain('neople-internal41')
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
    expect(section('통계').textContent).toContain('요청 11-10 14:32:00')
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

    await click(buttonIn(section('통계'), '실행'))

    await waitFor(() => expect(section('통계').textContent).toContain('이미 실행 중입니다.'))
    expect(section('통계').querySelector('[role="alert"]')?.textContent).toBe('이미 실행 중입니다.')
    expect(section('통계').textContent).toContain('경과 4초')
    expect(buttonIn(section('통계'), '실행').disabled).toBe(true)
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

  it('실행 이력에 계기, 실패 오류의 name과 code, 중단과 진행률을 보이고 더 보기로 다음 쪽을 읽는다', async () => {
    const api = new FakeOpsApi()
    api.jobs = [statsJob()]
    api.runPageSize = 2
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

    const history = section('통계')
    expect(history.textContent).toContain('보충')
    expect(history.textContent).toContain('PrismaClientKnownRequestErrorP2024')
    expect(history.textContent).toContain('중단')
    expect(history.textContent).toContain('21 / 132')
    expect(history.textContent).not.toContain('total 132')

    await click(buttonIn(history, '더 보기'))

    await waitFor(() => expect(section('통계').textContent).toContain('total 132'))
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
    expect(section('스킬 채택률').textContent).toContain('경과 12분 03초')
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
    expect(section('스킬 스타일 표본 채우기').textContent).toContain('limit, serverId')

    await click(buttonIn(section('스킬 스타일 표본 채우기'), '실행'))
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

    expect(section('batch key').querySelector('table')).toBeNull()
    expect(section('batch key').querySelector('p')?.textContent).toBe('batch key가 없습니다.')
    expect(section('batch key').querySelector('h2')?.textContent).toBe('batch key0')
  })

  it('삭제는 이름을 확인한 뒤 요청하고 그 key가 목록에서 빠진다', async () => {
    const api = new FakeOpsApi()
    const added = api.addBatchKey('batch3', 'synthetic-batch-key-0003-8e5d')
    await renderScreen(api)

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
