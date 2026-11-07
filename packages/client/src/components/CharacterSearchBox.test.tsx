// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useRecentCharacterStore } from '../hooks/useRecentCharacterStore'
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
  localStorage.clear()
  vi.unstubAllGlobals()
})

async function renderSearchBox(): Promise<void> {
  await act(async () =>
    root.render(
      <TestRouter>
        <CharacterSearchBox />
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
