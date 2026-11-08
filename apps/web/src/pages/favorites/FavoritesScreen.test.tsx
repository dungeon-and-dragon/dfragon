// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  type FavoriteCharacter,
  useFavoriteCharacterStore
} from '../../hooks/useFavoriteCharacterStore'
import { TestRouter } from '../../testing/test-support/test-router'
import { FavoritesScreen } from './FavoritesScreen'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function favorite(overrides: Partial<FavoriteCharacter>): FavoriteCharacter {
  return {
    serverId: 'cain',
    characterId: 'character-1',
    characterName: '합성1',
    adventureName: '모험단1',
    guildId: 'guild-1',
    guildName: '길드1',
    level: 115,
    jobName: '합성 직업',
    jobGrowName: '眞 합성 전직',
    fame: 100000,
    role: null,
    savedAt: 1,
    ...overrides
  }
}

async function render(favoriteCharacters: FavoriteCharacter[]): Promise<void> {
  useFavoriteCharacterStore.setState({ favoriteCharacters })
  await act(async () =>
    root.render(
      <TestRouter>
        <FavoritesScreen />
      </TestRouter>
    )
  )
}

function cells(): (string | null)[][] {
  return [...container.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => {
      const link = cell.querySelector('a')
      if (link == null) {
        return cell.textContent
      }

      return `${link.textContent} ${link.getAttribute('href')}`
    })
  )
}

it('열은 캐릭터, 명성, 모험단, 길드, 해제이고 모험단과 길드는 화면 링크, 없는 값은 -로 그린다', async () => {
  await render([
    favorite({}),
    favorite({
      characterId: 'character-2',
      characterName: '합성2',
      adventureName: null,
      guildId: null,
      guildName: null,
      fame: null
    })
  ])

  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '캐릭터',
    '명성',
    '모험단',
    '길드',
    '해제'
  ])
  expect(cells()).toEqual([
    [
      '합성1 /c/cain/character-1',
      '100,000',
      '모험단1 /adventures/%EB%AA%A8%ED%97%98%EB%8B%A81',
      '길드1 /guilds/guild-1',
      ''
    ],
    ['합성2 /c/cain/character-2', '-', '-', '-', '']
  ])
  expect(container.querySelector('header')?.textContent).toBe('즐겨찾기캐릭터2')
})

it('비었으면 캐릭터 수 없이 목록 상자에 빈 상태 한 줄만 둔다', async () => {
  await render([])

  expect(container.querySelector('header')?.textContent).toBe('즐겨찾기')
  expect(container.querySelector('table')).toBeNull()
  expect(container.querySelector('section')?.textContent).toBe(
    '즐겨찾기한 캐릭터즐겨찾기한 캐릭터가 없습니다.'
  )
})
