// @vitest-environment jsdom
import { delay, HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { searchedCharacterRow } from './api/character-search.fixture'
import { CHARACTER_SEARCH_URL } from './api/character-search.handlers'
import { CharacterSearchScreen } from './CharacterSearchScreen'

let container: HTMLDivElement
let root: Root
let queries: Record<string, string>[]

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  queries = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function respond(reply: () => Response | Promise<Response>): void {
  server.use(
    http.get(CHARACTER_SEARCH_URL, ({ request }) => {
      const { searchParams } = new URL(request.url)
      queries.push(Object.fromEntries(searchParams))

      return reply()
    })
  )
}

function render(): Promise<void> {
  return act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <CharacterSearchScreen query={{ characterName: '합성', serverId: 'prey' }} />
        </TestRouter>
      </TestQueryClient>
    )
  )
}

it('응답을 기다리는 동안 목록 상자를 받는 중으로 두고 고른 서버를 제목 상자에 보인다', async () => {
  respond(async () => {
    await delay('infinite')

    return HttpResponse.json({ rows: [] })
  })
  await render()

  await vi.waitFor(() =>
    expect(queries).toEqual([{ characterName: '합성', serverId: 'prey', limit: '200' }])
  )
  expect(container.querySelector('header')?.textContent).toBe('캐릭터 검색서버프레이')
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
})

it('검색이 실패하면 오류를 알린다', async () => {
  respond(() =>
    HttpResponse.json(
      { error: { code: 'INVALID_SEARCH_QUERY', message: 'API가 보낸 검색 조건 문구' } },
      { status: 400 }
    )
  )
  await render()

  await vi.waitFor(() =>
    expect(container.querySelector('section[aria-label="합성"] [role="alert"]')?.textContent).toBe(
      'API가 보낸 검색 조건 문구'
    )
  )
})

it('후보의 서버, 이름 오른쪽에 모험단명이 있으면 그 모험단 링크를 두고 없으면 아무것도 두지 않는다', async () => {
  respond(() =>
    HttpResponse.json({
      rows: [
        searchedCharacterRow({ characterId: 'with-adventure', adventureName: '합성 모험단' }),
        searchedCharacterRow({ characterId: 'no-adventure' })
      ]
    })
  )
  await render()

  await vi.waitFor(() => expect(container.querySelectorAll('tbody tr')).toHaveLength(2))
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
  expect(withoutAdventure.querySelector('span.flex-col')?.children[0]?.textContent).toBe(
    '프레이합성'
  )
  expect(withoutAdventure.querySelectorAll('a')).toHaveLength(1)
})
