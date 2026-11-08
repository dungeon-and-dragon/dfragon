// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdventureWeekly, WeeklyCharacter } from '#core/adventure-guild/adventure-weekly'
import { ClientHostContext, type ClientHost } from '../../host/client-host'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { TestRouter } from '../../testing/test-support/test-router'
import { AdventureEntryScreen, WeeklyScreen } from './WeeklyScreen'

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

function weeklyCharacter(
  index: number,
  weeklyClears: WeeklyCharacter['weeklyClears']
): WeeklyCharacter {
  return {
    serverId: 'cain',
    characterId: `character-${index}`,
    characterName: `합성${index}`,
    adventureName: '합성 모험단',
    level: 115,
    jobId: 'job-1',
    jobGrowId: 'grow-1',
    jobName: '합성 직업',
    jobGrowName: '眞 합성 전직',
    fame: 90000 - index,
    guildId: null,
    guildName: null,
    role: null,
    weeklyClears
  }
}

const weekly: AdventureWeekly = {
  adventureName: '합성 모험단',
  clearNames: [
    { kind: 'raid', name: '가 레이드' },
    { kind: 'raid', name: '나 레이드' },
    { kind: 'legion', name: '다 레기온' }
  ],
  characters: [
    weeklyCharacter(1, [
      { kind: 'raid', name: '나 레이드' },
      { kind: 'legion', name: '다 레기온' }
    ]),
    weeklyCharacter(2, [])
  ]
}

function render(
  screen: React.JSX.Element,
  getAdventureWeekly: ClientHost['getAdventureWeekly'] = vi.fn()
): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost({ getAdventureWeekly })}>
        <TestQueryClient>
          <TestRouter>{screen}</TestRouter>
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function renderWeekly(
  adventureName: string,
  getAdventureWeekly: ClientHost['getAdventureWeekly'],
  onAdventureOpen: (adventureName: string) => void = vi.fn()
): Promise<void> {
  return render(
    <WeeklyScreen
      adventureName={adventureName}
      season={undefined}
      onSeasonChange={vi.fn()}
      onAdventureOpen={onAdventureOpen}
    />,
    getAdventureWeekly
  )
}

function listName(): string | null | undefined {
  return container.querySelector('section h2')?.textContent
}

function headerRows(): string[][] {
  return [...container.querySelectorAll('thead tr')].map((row) =>
    [...row.querySelectorAll('th')].map((cell) => cell.textContent ?? '')
  )
}

function bodyRows(): string[][] {
  return [...container.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
  )
}

function button(name: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((item) => item.textContent === name)
}

async function submitName(name: string): Promise<void> {
  const form = container.querySelector<HTMLFormElement>('form')!
  const input = form.querySelector<HTMLInputElement>('input[aria-label="모험단"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => form.requestSubmit())
}

it('모험단 이름 입력 화면은 제목 한 줄과 빈 입력, 보기 버튼만 두고 조회하지 않는다', async () => {
  const getAdventureWeekly = vi.fn<ClientHost['getAdventureWeekly']>()
  await render(<AdventureEntryScreen onAdventureOpen={vi.fn()} />, getAdventureWeekly)

  expect(container.querySelector('h1')?.textContent).toBe('모험단')
  expect(container.querySelector<HTMLInputElement>('input[aria-label="모험단"]')?.value).toBe('')
  expect(container.querySelector('nav[aria-label="시즌"]')).toBeNull()
  expect(container.querySelector('section')).toBeNull()
  expect(container.querySelector('p')).toBeNull()
  expect(button('보기')).toBeDefined()
  expect(button('새로고침')).toBeUndefined()
  expect(getAdventureWeekly).not.toHaveBeenCalled()
})

it('모험단 화면의 입력은 지금 모험단 이름으로 시작하고, 보기를 누르면 앞뒤 공백을 뺀 이름을 열며 빈 이름은 열지 않는다', async () => {
  const onAdventureOpen = vi.fn()
  await renderWeekly('합성 모험단', async () => weekly, onAdventureOpen)
  expect(container.querySelector<HTMLInputElement>('input[aria-label="모험단"]')?.value).toBe(
    '합성 모험단'
  )

  await submitName('  ')
  expect(onAdventureOpen).not.toHaveBeenCalled()
  await submitName(' 다른 모험단 ')

  expect(onAdventureOpen.mock.calls).toEqual([['다른 모험단']])
})

it('표 위에 제목 없이 클리어 이름 열을 응답 순서로 레이드, 레기온 묶음 아래 두고, 응답 순서의 캐릭터마다 클리어한 칸에만 체크를 둔다', async () => {
  await renderWeekly('합성 모험단', async () => weekly)

  expect(listName()).toBeUndefined()
  expect(headerRows()).toEqual([
    ['#', '캐릭터', '명성', '레이드', '레기온'],
    ['가 레이드', '나 레이드', '다 레기온']
  ])
  expect(
    [...container.querySelectorAll('thead th[scope="colgroup"]')].map((cell) =>
      cell.getAttribute('colspan')
    )
  ).toEqual(['2', '1'])
  const [first, second] = bodyRows()
  expect(first.slice(2)).toEqual(['89,999', '클리어 안 함', '클리어', '클리어'])
  expect(second.slice(2)).toEqual(['89,998', '클리어 안 함', '클리어 안 함', '클리어 안 함'])
  expect(container.querySelectorAll('tbody tr:first-child td svg')).toHaveLength(2)
  const link = container.querySelector<HTMLAnchorElement>('tbody a')!
  expect(link.textContent).toBe('합성1')
  expect(link.getAttribute('href')).toBe('/c/cain/character-1')
})

it('클리어 이름이 없는 응답은 묶음 헤더 없이 #, 캐릭터, 명성 열만 그린다', async () => {
  await renderWeekly('합성 모험단', async () => ({
    ...weekly,
    clearNames: [],
    characters: weekly.characters.map((character) => ({ ...character, weeklyClears: [] }))
  }))

  expect(headerRows()).toEqual([['#', '캐릭터', '명성']])
  expect(bodyRows()).toHaveLength(2)
})

it('캐릭터가 없는 응답은 모험단 이름 한 줄만 둔다', async () => {
  await renderWeekly('없는 모험단', async () => ({
    adventureName: '없는 모험단',
    clearNames: [],
    characters: []
  }))

  expect(listName()).toBe('없는 모험단')
  expect(container.querySelector('section table')).toBeNull()
  expect(container.querySelector('section p')).toBeNull()
})

it('새로고침을 누르면 받아 둔 표를 버리고 받는 중을 보인 뒤 같은 모험단을 다시 조회해 새 응답으로 그린다', async () => {
  const refreshed = Promise.withResolvers<AdventureWeekly>()
  const getAdventureWeekly = vi
    .fn<ClientHost['getAdventureWeekly']>()
    .mockResolvedValueOnce({ ...weekly, characters: [weekly.characters[1]] })
    .mockReturnValueOnce(refreshed.promise)
  await renderWeekly('합성 모험단', getAdventureWeekly)
  expect(bodyRows()).toHaveLength(1)

  await act(async () => button('새로고침')!.click())
  expect(container.querySelector('section [aria-busy="true"]')).not.toBeNull()

  await act(async () => refreshed.resolve(weekly))
  expect(getAdventureWeekly.mock.calls).toEqual([['합성 모험단'], ['합성 모험단']])
  expect(container.querySelector('section [aria-busy="true"]')).toBeNull()
  expect(bodyRows()).toHaveLength(2)
})
