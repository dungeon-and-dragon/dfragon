// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  type FavoriteCharacter,
  useFavoriteCharacterStore
} from '../hooks/useFavoriteCharacterStore'
import { type RecentCharacter, useRecentCharacterStore } from '../hooks/useRecentCharacterStore'
import { TestRouter } from '../testing/test-support/test-router'
import { CharacterSearchBox } from './CharacterSearchBox'

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
  useRecentCharacterStore.setState({ recentCharacters: [] })
  useFavoriteCharacterStore.setState({ favoriteCharacters: [] })
  localStorage.clear()
  vi.unstubAllGlobals()
})

async function renderSearchBox(size?: 'medium' | 'large'): Promise<void> {
  await act(async () =>
    root.render(
      <TestRouter>
        <CharacterSearchBox size={size} />
      </TestRouter>
    )
  )
}

function nameInput(): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[type="search"]')!
}

function clearButton(): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('button[aria-label="검색어 지우기"]')
}

async function typeName(name: string): Promise<void> {
  const input = nameInput()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function chooseScope(label: string): Promise<void> {
  await act(async () =>
    container.querySelector<HTMLButtonElement>('button[aria-label="검색 대상"]')!.click()
  )
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (item) => item.textContent === label
  )!
  await act(async () => option.click())
}

it('이름 칸이 비어 있으면 지우기 버튼이 없고, 글자를 넣으면 이름 칸과 검색 버튼 사이에 보인다', async () => {
  await renderSearchBox()
  expect(clearButton()).toBeNull()

  await typeName('하늘')

  expect(
    [...container.querySelectorAll('button, input[type="search"]')].map((control) =>
      control.getAttribute('aria-label')
    )
  ).toEqual(['검색 대상', '캐릭터 이름', '검색어 지우기', '검색'])
  expect(clearButton()!.type).toBe('button')
})

it('지우기 버튼을 누르면 이름만 비우고 초점을 이름 칸에 돌려주며, 고른 검색 대상은 그대로다', async () => {
  await renderSearchBox()
  await chooseScope('카인')
  await typeName('하늘')

  await act(async () => clearButton()!.click())

  expect(nameInput().value).toBe('')
  expect(document.activeElement).toBe(nameInput())
  expect(clearButton()).toBeNull()
  expect(container.querySelector('button[aria-label="검색 대상"]')?.textContent).toBe('카인')
})

it('최근 본 캐릭터가 있으면 지우기 버튼으로 비운 뒤 빈 이름 칸처럼 최근 목록을 연다', async () => {
  useRecentCharacterStore.setState({
    recentCharacters: [
      {
        serverId: 'prey',
        characterId: 'recent-1',
        characterName: '하늘',
        adventureName: null,
        guildId: null,
        guildName: null,
        level: 115,
        jobName: null,
        jobGrowName: null,
        fame: 126965,
        role: null,
        viewedAt: 0
      }
    ]
  })
  await renderSearchBox()
  await typeName('하')
  expect(document.querySelector('[aria-label="최근 본 캐릭터"]')).toBeNull()

  await act(async () => clearButton()!.click())

  await vi.waitFor(() =>
    expect(document.querySelector('[aria-label="최근 본 캐릭터"]')).not.toBeNull()
  )
})

function recentCharacter(
  characterId: string,
  characterName: string,
  level: number
): RecentCharacter {
  return {
    serverId: 'prey',
    characterId,
    characterName,
    adventureName: null,
    guildId: null,
    guildName: null,
    level,
    jobName: '합성 직업',
    jobGrowName: null,
    fame: null,
    role: null,
    viewedAt: 0
  }
}

it('최근 본 캐릭터는 서버, 이름, 직업명을 한 줄로 두고 만렙이 아니면 그 아래 줄에 레벨만 둔다', async () => {
  useRecentCharacterStore.setState({
    recentCharacters: [
      recentCharacter('recent-1', '만렙', 115),
      recentCharacter('recent-2', '육성', 110)
    ]
  })
  await renderSearchBox()

  await act(async () => nameInput().focus())

  const popup = await vi.waitFor(() => {
    const element = document.querySelector('[aria-label="최근 본 캐릭터"]')
    expect(element).not.toBeNull()

    return element!
  })
  const lines = [...popup.querySelectorAll('li a')].map((item) =>
    [...(item.children[1]?.children ?? [])].map((line) => line.textContent)
  )
  expect(lines).toEqual([['프레이만렙합성 직업'], ['프레이육성합성 직업', 'Lv.110']])
})

function savedCharacter(characterId: string, characterName: string): FavoriteCharacter {
  return { ...recentCharacter(characterId, characterName, 115), savedAt: 0 }
}

function savedDropdown(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[aria-label="최근 본 캐릭터와 즐겨찾기"]')
}

async function openSavedDropdown(): Promise<HTMLElement> {
  await act(async () => nameInput().focus())

  return vi.waitFor(() => {
    const dropdown = savedDropdown()
    expect(dropdown).not.toBeNull()

    return dropdown!
  })
}

function section(dropdown: HTMLElement, title: string): HTMLElement {
  return [...dropdown.querySelectorAll<HTMLElement>('section')].find(
    (element) => element.querySelector('h3')?.textContent === title
  )!
}

function rowTexts(element: HTMLElement): (string | null)[] {
  return [...element.querySelectorAll('li a')].map((link) => link.textContent)
}

function rowsNamed(...names: string[]): unknown[] {
  return names.map((name) => expect.stringContaining(name))
}

function star(element: HTMLElement, characterName: string): HTMLButtonElement {
  const row = [...element.querySelectorAll('li')].find((item) =>
    item.textContent?.includes(characterName)
  )!

  return row.querySelector<HTMLButtonElement>('button[aria-label^="즐겨찾기"]')!
}

it('큰 검색창은 저장된 캐릭터가 없어도 초점을 주면 두 절에 빈 줄 하나씩을 연다', async () => {
  await renderSearchBox('large')

  const dropdown = await openSavedDropdown()

  expect(
    [...dropdown.querySelectorAll('section')].map((element) => [
      element.querySelector('h3')?.textContent,
      element.querySelector('p')?.textContent
    ])
  ).toEqual([
    ['최근 본 캐릭터', '최근 본 캐릭터가 없습니다.'],
    ['즐겨찾기', '즐겨찾기한 캐릭터가 없습니다.']
  ])
  expect(document.querySelector('[aria-label="최근 본 캐릭터"]')).toBeNull()
})

it('큰 검색창 드롭다운은 두 절을 저장된 순서대로 최대 5줄씩 그리고 항목은 캐릭터 상세로 가며 네트워크 요청을 내지 않는다', async () => {
  const fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  useRecentCharacterStore.setState({
    recentCharacters: ['1', '2', '3', '4', '5', '6'].map((id) =>
      recentCharacter(`recent-${id}`, `최근${id}`, 115)
    )
  })
  useFavoriteCharacterStore.setState({
    favoriteCharacters: ['1', '2', '3', '4', '5', '6'].map((id) =>
      savedCharacter(`favorite-${id}`, `즐찾${id}`)
    )
  })
  await renderSearchBox('large')

  const dropdown = await openSavedDropdown()

  expect(rowTexts(section(dropdown, '최근 본 캐릭터'))).toEqual(
    rowsNamed('최근1', '최근2', '최근3', '최근4', '최근5')
  )
  expect(rowTexts(section(dropdown, '즐겨찾기'))).toEqual(
    rowsNamed('즐찾1', '즐찾2', '즐찾3', '즐찾4', '즐찾5')
  )
  expect(dropdown.querySelector('li a')?.getAttribute('href')).toBe('/c/prey/recent-1')
  expect(fetchSpy).not.toHaveBeenCalled()
})

it('최근 절의 선 별을 누르면 즐겨찾기 절에 생기고, 즐겨찾기 절의 별을 누르면 빠지며 드롭다운은 열려 있다', async () => {
  useRecentCharacterStore.setState({ recentCharacters: [recentCharacter('recent-1', '하늘', 115)] })
  await renderSearchBox('large')
  const dropdown = await openSavedDropdown()
  const recentStar = star(section(dropdown, '최근 본 캐릭터'), '하늘')
  expect(recentStar.getAttribute('aria-label')).toBe('즐겨찾기에 더하기')

  await act(async () => recentStar.focus())
  await act(async () => recentStar.click())

  expect(rowTexts(section(dropdown, '즐겨찾기'))).toEqual(rowsNamed('하늘'))
  expect(star(section(dropdown, '즐겨찾기'), '하늘').getAttribute('aria-label')).toBe(
    '즐겨찾기 해제'
  )
  expect(star(section(dropdown, '최근 본 캐릭터'), '하늘').getAttribute('aria-label')).toBe(
    '즐겨찾기 해제'
  )

  const favoriteStar = star(section(dropdown, '즐겨찾기'), '하늘')
  await act(async () => favoriteStar.focus())
  await act(async () => favoriteStar.click())

  expect(savedDropdown()).toBe(dropdown)
  expect(section(dropdown, '즐겨찾기').querySelector('p')?.textContent).toBe(
    '즐겨찾기한 캐릭터가 없습니다.'
  )
  expect(star(section(dropdown, '최근 본 캐릭터'), '하늘').getAttribute('aria-label')).toBe(
    '즐겨찾기에 더하기'
  )
  expect(document.activeElement).toBe(nameInput())
  expect(useFavoriteCharacterStore.getState().favoriteCharacters).toEqual([])
})

it('큰 검색창에서 아래 방향키를 누르면 첫 항목으로 가고, 다시 누르면 즐겨찾기 절로 넘어간다', async () => {
  useRecentCharacterStore.setState({ recentCharacters: [recentCharacter('recent-1', '하늘', 115)] })
  useFavoriteCharacterStore.setState({ favoriteCharacters: [savedCharacter('favorite-1', '바다')] })
  await renderSearchBox('large')
  const dropdown = await openSavedDropdown()
  const [recentLink, favoriteLink] = dropdown.querySelectorAll<HTMLAnchorElement>('li a')

  await act(async () =>
    nameInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  )
  expect(document.activeElement).toBe(recentLink)

  await act(async () =>
    recentLink.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  )
  expect(document.activeElement).toBe(favoriteLink)
})

it('큰 검색창에 한 글자를 쓰면 드롭다운이 닫히고 지우면 다시 열린다', async () => {
  await renderSearchBox('large')
  await openSavedDropdown()

  await typeName('하')
  await vi.waitFor(() => expect(savedDropdown()).toBeNull())

  await typeName('')
  await vi.waitFor(() => expect(savedDropdown()).not.toBeNull())
})
