// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SkillStats } from '#entities/ranking/model/skill-stats'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { SKILL_STATS_URL } from './skill-stats.handlers'
import { useSkillStats } from './useSkillStats'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function Harness(): React.JSX.Element {
  const result = useSkillStats({ jobId: 'job-1', jobGrowId: 'grow-1', role: null })

  return <output>{JSON.stringify(result)}</output>
}

async function render(): Promise<LoadedResult<SkillStats>> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness />
      </TestQueryClient>
    )
  )

  return vi.waitFor(() => {
    const result: LoadedResult<SkillStats> = JSON.parse(
      container.querySelector('output')?.textContent ?? ''
    )
    expect(result.status).not.toBe('loading')

    return result
  })
}

function respondSkillStats(body: object): void {
  server.use(http.get(SKILL_STATS_URL, () => HttpResponse.json(body)))
}

const SKILL_STATS: SkillStats = {
  computedAt: '2026-11-06T15:00:00.000Z',
  minFame: null,
  sampleSize: 0,
  skills: [],
  evolutions: [],
  enhancements: [],
  chainSampleSize: 0,
  chains: []
}

it('스킬 채택률 응답을 schema로 읽어 계약에 없는 필드는 버린다', async () => {
  respondSkillStats({ ...SKILL_STATS, topCount: 5000 })

  expect(await render()).toEqual({ status: 'success', value: SKILL_STATS })
})

it('표본 수가 없는 스킬 채택률 응답은 실패로 본다', async () => {
  respondSkillStats({ ...SKILL_STATS, sampleSize: undefined })

  expect((await render()).status).toBe('error')
})

it('집계 시각이 null인 빈 스킬 채택률 응답을 읽는다', async () => {
  const empty = { ...SKILL_STATS, computedAt: null }
  respondSkillStats(empty)

  expect(await render()).toEqual({ status: 'success', value: empty })
})
