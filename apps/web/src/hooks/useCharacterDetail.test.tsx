// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDfragonClient } from '#core/shared/api/dfragon-client'
import type { CharacterDetailView } from '#core/shared/search/character-detail-view'
import { createTestClientHost } from '../testing/test-support/client-host'
import { TestQueryClient } from '../testing/test-support/test-query-client'
import { useCharacterDetail } from './useCharacterDetail'
import { ClientHostContext, type ClientHost } from '../host/client-host'

function Harness({ characterId }: { characterId: string }): React.JSX.Element {
  const result = useCharacterDetail('cain', characterId)
  switch (result.status) {
    case 'loading':
      return <output>loading</output>
    case 'success':
      return <output>{result.detail.character.characterName}</output>
    case 'error':
      return <output>{result.message}</output>
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function detailOf(characterId: string): CharacterDetailView {
  return {
    character: {
      serverId: 'cain',
      characterId,
      characterName: `이름-${characterId}`,
      serverName: '카인',
      level: 115,
      jobId: null,
      jobGrowId: null,
      jobName: null,
      jobGrowName: null,
      fame: null,
      adventureName: null,
      guildId: null,
      guildName: null
    },
    card: null,
    equipment: { equipment: [], setItemInfo: [] },
    creature: null,
    avatar: [],
    mistAssimilation: null,
    oath: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    status: { status: [], buff: [] }
  }
}

function render(host: ClientHost, characterId: string | null): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={host}>
        <TestQueryClient>
          {characterId !== null && <Harness characterId={characterId} />}
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function shown(): string | null {
  return container.querySelector('output')!.textContent
}

it('받는 동안 받는 중을 보이고, 같은 캐릭터를 다시 그려도 한 번만 조회한다', async () => {
  const { promise, resolve } = Promise.withResolvers<CharacterDetailView>()
  const getCharacterDetail = vi.fn<ClientHost['getCharacterDetail']>(() => promise)
  const host = createTestClientHost({ getCharacterDetail })

  await render(host, 'character-1')
  expect(shown()).toBe('loading')

  await act(async () => resolve(detailOf('character-1')))
  expect(shown()).toBe('이름-character-1')

  await render(host, 'character-1')
  expect(shown()).toBe('이름-character-1')
  expect(getCharacterDetail).toHaveBeenCalledExactlyOnceWith({
    serverId: 'cain',
    characterId: 'character-1'
  })
})

it('없는 캐릭터의 404 CHARACTER_NOT_FOUND 응답이면 error.message를 그대로 준다', async () => {
  const message = 'API가 보낸 없는 캐릭터 문구'
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () =>
      new Response(JSON.stringify({ error: { code: 'CHARACTER_NOT_FOUND', message } }), {
        status: 404
      })
  )
  const getCharacterDetail = createDfragonClient({
    apiOrigin: 'https://api.example.test',
    fetch
  }).characters.detailView

  await render(createTestClientHost({ getCharacterDetail }), 'missing-character')
  await vi.waitFor(() => expect(shown()).toBe(message))
})

it('다른 캐릭터로 바뀌면 다시 받는 중이 되고, 이전 캐릭터의 늦은 응답은 무시한다', async () => {
  const pending = new Map<string, PromiseWithResolvers<CharacterDetailView>>()
  const getCharacterDetail = vi.fn<ClientHost['getCharacterDetail']>(({ characterId }) => {
    const request = Promise.withResolvers<CharacterDetailView>()
    pending.set(characterId, request)

    return request.promise
  })
  const host = createTestClientHost({ getCharacterDetail })

  await render(host, 'character-1')
  await render(host, 'character-2')
  expect(shown()).toBe('loading')

  await act(async () => pending.get('character-2')!.resolve(detailOf('character-2')))
  expect(shown()).toBe('이름-character-2')

  await act(async () => pending.get('character-1')!.resolve(detailOf('character-1')))
  expect(shown()).toBe('이름-character-2')
})

it('화면을 떠났다 돌아와도 5분 동안은 다시 조회하지 않고, 5분이 지나면 다시 조회한다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const startedAt = Date.now()
  const getCharacterDetail = vi.fn<ClientHost['getCharacterDetail']>(async ({ characterId }) =>
    detailOf(characterId)
  )
  const host = createTestClientHost({ getCharacterDetail })

  await render(host, 'character-1')
  await render(host, null)
  vi.setSystemTime(startedAt + 4 * 60_000)
  await render(host, 'character-1')
  expect(shown()).toBe('이름-character-1')
  expect(getCharacterDetail).toHaveBeenCalledOnce()

  await render(host, null)
  vi.setSystemTime(startedAt + 6 * 60_000)
  await render(host, 'character-1')
  expect(shown()).toBe('이름-character-1')
  expect(getCharacterDetail).toHaveBeenCalledTimes(2)
})
