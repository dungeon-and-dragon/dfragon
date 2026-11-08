// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ClientHostContext, type ClientHost } from '../../host/client-host'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { TestRouter } from '../../testing/test-support/test-router'
import { CharacterSearchScreen } from './CharacterSearchScreen'

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
})

function render(searchCharacters: ClientHost['searchCharacters']): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost({ searchCharacters })}>
        <TestQueryClient>
          <TestRouter>
            <CharacterSearchScreen query={{ characterName: '합성', serverId: 'prey' }} />
          </TestRouter>
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

it('응답을 기다리는 동안 목록 상자에 받는 중임을 알리고 고른 서버를 제목 상자에 보인다', async () => {
  const searchCharacters = vi.fn<ClientHost['searchCharacters']>(() => new Promise(() => {}))
  await render(searchCharacters)

  expect(searchCharacters).toHaveBeenCalledExactlyOnceWith({
    characterName: '합성',
    serverId: 'prey'
  })
  expect(container.querySelector('header')?.textContent).toBe('캐릭터 검색서버프레이')
  expect(container.querySelector('[aria-busy="true"] [role="status"]')?.textContent).toBe(
    '캐릭터를 찾는 중입니다.'
  )
})

it('검색이 실패하면 오류를 알린다', async () => {
  await render(async () => {
    throw new Error('검색 조건을 확인해 주세요.')
  })

  expect(container.querySelector('section[aria-label="합성"] [role="alert"]')?.textContent).toBe(
    '검색 조건을 확인해 주세요.'
  )
})

function candidate(
  characterId: string,
  adventureName: string | null
): Awaited<ReturnType<ClientHost['searchCharacters']>>[number] {
  return {
    serverId: 'prey',
    characterId,
    characterName: '합성',
    serverName: '프레이',
    fame: 1000,
    imageUrl: `https://img-api.neople.co.kr/df/servers/prey/characters/${characterId}?zoom=1`,
    adventureName,
    jobName: null,
    jobGrowName: null
  }
}

it('후보의 서버, 이름 오른쪽에 모험단명이 있으면 그 모험단 링크를 두고 없으면 아무것도 두지 않는다', async () => {
  await render(async () => [
    candidate('with-adventure', '합성 모험단'),
    candidate('no-adventure', null)
  ])

  const [withAdventure, withoutAdventure] = [...container.querySelectorAll('tbody tr')].map(
    (row) => row.querySelector('td')!
  )
  expect(
    [...withAdventure.querySelectorAll('a')].map((link) => [
      link.textContent,
      link.getAttribute('href')
    ])
  ).toEqual([
    ['합성', '/c/prey/with-adventure'],
    ['합성 모험단', `/adventures/${encodeURIComponent('합성 모험단')}`]
  ])
  expect(withoutAdventure.textContent).toBe('프레이합성')
  expect(withoutAdventure.querySelectorAll('a')).toHaveLength(1)
})
