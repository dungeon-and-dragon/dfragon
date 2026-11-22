// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterIdentity } from '#entities/character'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { storyCharacterDetail } from './character.fixture'
import { characterUrl } from '#entities/character-detail/api/character-detail.handlers'
import { useCharacterHistory, useHistorySnapshot } from './useCharacterHistory'

const INVALID_RESPONSE = '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
const AT = '2026-11-17T13:09:00.000Z'

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

function Shown({ result }: { result: LoadedResult<unknown> }): React.JSX.Element {
  return <output>{result.status === 'error' ? result.message : result.status}</output>
}

function HistoryHarness({ identity }: { identity: CharacterIdentity }): React.JSX.Element {
  return <Shown result={useCharacterHistory(identity)} />
}

function SnapshotHarness({ identity }: { identity: CharacterIdentity }): React.JSX.Element {
  return <Shown result={useHistorySnapshot(identity, AT)} />
}

function render(element: React.JSX.Element): Promise<void> {
  return act(async () => root.render(<TestQueryClient>{element}</TestQueryClient>))
}

function shown(): string | null {
  return container.querySelector('output')!.textContent
}

it('변경점 changes가 없는 이력 응답은 응답 확인 실패 문구로 끝난다', async () => {
  const identity = { serverId: 'cain', characterId: 'character-1' }
  const historyUrl = characterUrl(identity, '/history')
  server.use(
    http.get(historyUrl, () =>
      HttpResponse.json({ basics: [], scores: [], sectionChanges: {}, nameChanges: [] })
    )
  )

  await render(<HistoryHarness identity={identity} />)

  await vi.waitFor(() => expect(shown()).toBe(INVALID_RESPONSE))
})

it('시점 상세 응답의 캐릭터가 요청한 캐릭터가 아니면 응답 확인 실패 문구로 끝난다', async () => {
  const other = storyCharacterDetail('dealer')
  const identity = { serverId: other.character.serverId, characterId: 'requested-character' }
  const snapshotUrl = characterUrl(identity, '/history/snapshot')
  server.use(http.get(snapshotUrl, () => HttpResponse.json(other)))

  await render(<SnapshotHarness identity={identity} />)

  await vi.waitFor(() => expect(shown()).toBe(INVALID_RESPONSE))
})
