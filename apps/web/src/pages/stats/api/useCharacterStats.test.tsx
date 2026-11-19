// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterStats } from '#core/ranking'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { CHARACTER_STATS_URL } from './stats.handlers'
import { useCharacterStats } from './useCharacterStats'

let container: HTMLDivElement
let root: Root
let result: LoadedResult<CharacterStats>

function Harness(): null {
  const value = useCharacterStats()
  useEffect(() => {
    result = value
  })

  return null
}

beforeEach(() => {
  result = { status: 'loading' }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

it('집계 시각이 없는 통계 응답은 응답 확인 오류로 끝낸다', async () => {
  server.use(
    http.get(CHARACTER_STATS_URL, () =>
      HttpResponse.json({ total: 0, servers: [], jobs: [], fameDistribution: [] })
    )
  )

  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(result.status).not.toBe('loading'))

  expect(result).toEqual({
    status: 'error',
    message: '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
  })
})
