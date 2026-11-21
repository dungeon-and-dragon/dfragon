// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SkillWindowCatalog } from '#entities/catalog/model/skill-window'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { SKILL_WINDOW_INDEX_URL } from './skill-window.handlers'
import { useSkillWindowCatalog } from './useSkillWindowCatalog'

const SKILLTAB_URL = `${window.location.origin}/skilltab`
const PRIEST_FILE_URL = `${SKILLTAB_URL}/1d9658f7/jobs/priest.521c797c.json`
const MAGE_FILE_URL = `${SKILLTAB_URL}/1d9658f7/jobs/mage.0f3e2d1c.json`

const INDEX_JSON = {
  version: 'synthetic',
  marks: {
    evolution: [
      '1d9658f7/marks/evolution-1.8df0e8da.png',
      '1d9658f7/marks/evolution-2.b314323a.png'
    ],
    enhancement: [
      '1d9658f7/marks/enhancement-1.77cf8f9d.png',
      '1d9658f7/marks/enhancement-2.5be2681f.png'
    ]
  },
  jobs: [
    { jobId: 'priest', jobName: '프리스트(남)', file: '1d9658f7/jobs/priest.521c797c.json' },
    { jobId: 'mage', jobName: '마법사(여)', file: '1d9658f7/jobs/mage.0f3e2d1c.json' }
  ]
}

function jobJson(jobId: string, jobName: string) {
  return {
    jobId,
    jobName,
    sprite: `1d9658f7/sprites/${jobId}.521c797c.png`,
    advancements: [],
    skills: {
      1: {
        name: '공참타',
        kind: 'active',
        requiredLevel: 1,
        maxLevel: 20,
        icon: { x: 0, y: 0 },
        stage: false
      }
    }
  }
}

const RESPONSES: Readonly<Record<string, () => Response>> = {
  [SKILL_WINDOW_INDEX_URL]: () => HttpResponse.json(INDEX_JSON),
  [PRIEST_FILE_URL]: () => HttpResponse.json(jobJson('priest', '프리스트(남)')),
  [MAGE_FILE_URL]: () => HttpResponse.json(jobJson('mage', '마법사(여)'))
}

let container: HTMLDivElement
let root: Root
let requested: string[]

beforeEach(() => {
  requested = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function respondSkillTab(overrides: Readonly<Record<string, () => Response>> = {}): void {
  const responses = { ...RESPONSES, ...overrides }
  server.use(
    ...Object.entries(responses).map(([url, respond]) =>
      http.get(url, () => {
        requested.push(url)

        return respond()
      })
    )
  )
}

type CatalogResult = LoadedResult<SkillWindowCatalog | null>

function Harness({ jobName }: { jobName: string }): React.JSX.Element {
  return <output>{JSON.stringify(useSkillWindowCatalog(jobName))}</output>
}

// 같은 root에 다시 그리면 TestQueryClient가 남아 있어, hook만 다시 mount해도 같은 캐시를 쓴다.
async function render(...jobNames: string[]): Promise<CatalogResult[]> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        {jobNames.map((jobName, index) => (
          <Harness key={`${jobName}-${index}`} jobName={jobName} />
        ))}
      </TestQueryClient>
    )
  )

  return vi.waitFor(() => {
    const results = [...container.querySelectorAll('output')].map(
      (output): CatalogResult => JSON.parse(output.textContent ?? '')
    )
    expect(results.every(({ status }) => status !== 'loading')).toBe(true)

    return results
  })
}

it('직업 파일, sprite, 개화와 강화 표식 경로를 skilltab.v3.json 주소 기준의 절대 주소로 바꾼다', async () => {
  respondSkillTab()

  const [result] = await render('프리스트(남)')

  expect(requested).toEqual([SKILL_WINDOW_INDEX_URL, PRIEST_FILE_URL])
  expect(result).toMatchObject({
    status: 'success',
    value: {
      job: { sprite: `${SKILLTAB_URL}/1d9658f7/sprites/priest.521c797c.png` },
      marks: {
        evolution: [
          `${SKILLTAB_URL}/1d9658f7/marks/evolution-1.8df0e8da.png`,
          `${SKILLTAB_URL}/1d9658f7/marks/evolution-2.b314323a.png`
        ],
        enhancement: [
          `${SKILLTAB_URL}/1d9658f7/marks/enhancement-1.77cf8f9d.png`,
          `${SKILLTAB_URL}/1d9658f7/marks/enhancement-2.5be2681f.png`
        ]
      }
    }
  })
})

it('index는 한 번만 받고, 같은 직업은 직업 파일을 다시 받지 않으며 다른 직업은 그 직업 파일만 받는다', async () => {
  respondSkillTab()

  const [first, second] = await render('프리스트(남)', '프리스트(남)')
  const [, , mage] = await render('프리스트(남)', '프리스트(남)', '마법사(여)')

  expect(second).toEqual(first)
  expect(mage).toMatchObject({ status: 'success', value: { job: { jobId: 'mage' } } })
  expect(requested).toEqual([SKILL_WINDOW_INDEX_URL, PRIEST_FILE_URL, MAGE_FILE_URL])
})

it('index를 아직 올리지 않아 404면 직업 파일을 요청하지 않고 데이터 없음으로 돌려준다', async () => {
  respondSkillTab({ [SKILL_WINDOW_INDEX_URL]: () => new HttpResponse(null, { status: 404 }) })

  expect(await render('프리스트(남)')).toEqual([{ status: 'success', value: null }])
  expect(requested).toEqual([SKILL_WINDOW_INDEX_URL])
})

it('index에 그 직업이 없으면 직업 파일을 요청하지 않고 데이터 없음으로 돌려준다', async () => {
  respondSkillTab()

  expect(await render('총검사')).toEqual([{ status: 'success', value: null }])
  expect(requested).toEqual([SKILL_WINDOW_INDEX_URL])
})

it('index를 받지 못하면 실패를 알리고 다시 mount하면 다시 받는다', async () => {
  let failed = false
  respondSkillTab({
    [SKILL_WINDOW_INDEX_URL]: () => {
      if (!failed) {
        failed = true

        return new HttpResponse(null, { status: 503 })
      }

      return HttpResponse.json(INDEX_JSON)
    }
  })

  const [failure] = await render('프리스트(남)')
  await render()
  const [retried] = await render('프리스트(남)')

  expect(failure).toEqual({ status: 'error', message: expect.stringContaining('HTTP 503') })
  expect(retried).toMatchObject({ status: 'success', value: { job: { jobId: 'priest' } } })
  expect(requested).toEqual([SKILL_WINDOW_INDEX_URL, SKILL_WINDOW_INDEX_URL, PRIEST_FILE_URL])
})

it('직업 파일을 받지 못하면 실패를 알리고 다시 mount하면 그 직업 파일만 다시 받는다', async () => {
  let failed = false
  respondSkillTab({
    [PRIEST_FILE_URL]: () => {
      if (!failed) {
        failed = true

        return new HttpResponse(null, { status: 503 })
      }

      return HttpResponse.json(jobJson('priest', '프리스트(남)'))
    }
  })

  const [failure] = await render('프리스트(남)')
  await render()
  const [retried] = await render('프리스트(남)')

  expect(failure).toEqual({ status: 'error', message: expect.stringContaining('HTTP 503') })
  expect(retried).toMatchObject({ status: 'success', value: { job: { jobId: 'priest' } } })
  expect(requested).toEqual([SKILL_WINDOW_INDEX_URL, PRIEST_FILE_URL, PRIEST_FILE_URL])
})

it('단계 스킬 여부가 없는 직업 파일은 받지 않는다', async () => {
  const { skills, ...job } = jobJson('priest', '프리스트(남)')
  const { stage: _stage, ...skill } = skills[1]
  respondSkillTab({ [PRIEST_FILE_URL]: () => HttpResponse.json({ ...job, skills: { 1: skill } }) })

  const [result] = await render('프리스트(남)')

  expect(result).toEqual({ status: 'error', message: expect.stringContaining('stage') })
})
