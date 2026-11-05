// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { StoredCharacter } from '@dfragon/client-core/shared/ranking/ranking-stats'
import { ClientHostContext, type ClientHost } from '../../hooks/useClientHost'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestRouter } from '../../testing/test-support/test-router'
import { AdventureScreen } from './AdventureScreen'

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

function storedCharacter(index: number, overrides: Partial<StoredCharacter> = {}): StoredCharacter {
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
    ...overrides
  }
}

function render(getAdventureCharacters: ClientHost['getAdventureCharacters']): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost({ getAdventureCharacters })}>
        <TestRouter>
          <AdventureScreen adventureName="합성 모험단" />
        </TestRouter>
      </ClientHostContext>
    )
  )
}

function stats(): string[] {
  return [...container.querySelectorAll('header div')].map((stat) => stat.textContent ?? '')
}

it('제목 상자에 모험단 이름, 캐릭터 수, 목록의 최고 명성을 두고 열은 순번, 캐릭터, 명성, 길드다', async () => {
  const getAdventureCharacters = vi.fn<ClientHost['getAdventureCharacters']>(async () => ({
    adventureName: '합성 모험단',
    characters: [
      storedCharacter(1, { guildId: 'guild-1', guildName: '합성 길드' }),
      storedCharacter(2, { fame: null })
    ]
  }))
  await render(getAdventureCharacters)

  expect(getAdventureCharacters).toHaveBeenCalledWith('합성 모험단')
  expect(container.querySelector('h1')?.textContent).toBe('합성 모험단')
  expect(stats()).toContain('캐릭터2')
  expect(stats()).toContain('최고 명성89,999')
  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '#',
    '캐릭터',
    '명성',
    '길드'
  ])
  const rows = [...container.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent)
  )
  expect(rows).toEqual([
    ['1', '카인합성1Lv.115 | 眞 합성 전직', '89,999', '합성 길드'],
    ['2', '카인합성2Lv.115 | 眞 합성 전직', '-', '-']
  ])
  expect(container.querySelector('tbody a[href="/guilds/guild-1"]')?.textContent).toBe('합성 길드')
  expect(container.querySelector('tbody a')?.getAttribute('href')).toBe('/c/cain/character-1')
})

it('저장된 캐릭터가 없으면 목록 상자에 한 줄만 두고 수는 0, 최고 명성은 -다', async () => {
  await render(async () => ({ adventureName: '합성 모험단', characters: [] }))

  expect(container.querySelector('section')?.textContent).toBe('저장된 캐릭터가 없습니다.')
  expect(container.querySelector('table')).toBeNull()
  expect(stats()).toEqual(expect.arrayContaining(['캐릭터0', '최고 명성-']))
})

it('조회가 실패하면 오류를 알린다', async () => {
  await render(async () => {
    throw new Error('모험단을 받지 못했습니다.')
  })

  expect(container.querySelector('[role="alert"]')?.textContent).toBe('모험단을 받지 못했습니다.')
})
