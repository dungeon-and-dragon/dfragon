// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Guild } from '#core/adventure-guild'
import type { StoredCharacter } from '#core/ranking'
import { ClientHostContext, type ClientHost } from '#host/client-host'
import { createTestClientHost } from '#testing/test-support/client-host'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { GuildScreen } from './GuildScreen'

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

function member(index: number): StoredCharacter {
  return {
    serverId: 'cain',
    characterId: `character-${index}`,
    characterName: `합성${index}`,
    adventureName: `모험단${index}`,
    level: 115,
    jobId: 'job-1',
    jobGrowId: 'grow-1',
    jobName: '합성 직업',
    jobGrowName: '眞 합성 전직',
    fame: 90000 - index,
    guildId: 'guild-1',
    guildName: '합성 길드',
    role: null
  }
}

function guildOf(count: number, overrides: Partial<Guild> = {}): Guild {
  return {
    guildId: 'guild-1',
    guildName: '합성 길드',
    memberCount: count,
    members: Array.from({ length: count }, (_, index) => member(index + 1)),
    ...overrides
  }
}

function render(getGuild: ClientHost['getGuild']): Promise<void> {
  return act(async () =>
    root.render(
      <ClientHostContext value={createTestClientHost({ getGuild })}>
        <TestQueryClient>
          <TestRouter>
            <GuildScreen guildId="guild-1" />
          </TestRouter>
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function bodyRows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tbody tr:not([aria-hidden])')]
}

function moreButton(): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent === '불러오기'
  )
}

function clickMore(): Promise<void> {
  return act(async () => moreButton()?.click())
}

it('제목 상자에 길드 이름과 길드원 수만 두고 열은 순번, 캐릭터, 명성, 모험단이다', async () => {
  const getGuild = vi.fn<ClientHost['getGuild']>(async () => guildOf(2))
  await render(getGuild)

  expect(getGuild).toHaveBeenCalledWith('guild-1')
  expect(container.querySelector('h1')?.textContent).toBe('합성 길드')
  const stats = [...container.querySelectorAll('header .stat')].map((stat) => stat.textContent)
  expect(stats).toEqual(['길드원2'])
  expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('길드원')
  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '#',
    '캐릭터',
    '명성',
    '모험단'
  ])
  expect([...bodyRows()[0].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual([
    '1',
    '카인합성1합성 전직 합성 직업',
    '89,999',
    '모험단1'
  ])
  expect(
    container.querySelector('tbody a[href="/adventures/%EB%AA%A8%ED%97%98%EB%8B%A81"]')
  ).not.toBeNull()
})

it('길드원 120명 가운데 처음 50명을 그리고 불러오기를 누를 때마다 50명씩 더 그린다', async () => {
  await render(async () => guildOf(120))

  expect(bodyRows()).toHaveLength(50)
  await clickMore()
  expect(bodyRows()).toHaveLength(100)
  await clickMore()
  expect(bodyRows()).toHaveLength(120)
  expect(moreButton()).toBeUndefined()
})

it('길드원이 50명 이하면 모두 그리고 불러오기 버튼을 두지 않는다', async () => {
  await render(async () => guildOf(50))

  expect(bodyRows()).toHaveLength(50)
  expect(moreButton()).toBeUndefined()
})

it('길드원이 없으면 목록 상자에 빈 문구만 두고 길드원 수는 0이다', async () => {
  await render(async () => guildOf(0, { guildName: null }))

  expect(container.querySelector('section p')?.textContent).toBe('저장된 캐릭터가 없습니다.')
  expect(container.querySelector('section table')).toBeNull()
  expect(container.querySelector('h1')?.textContent).toBe('길드')
  expect([...container.querySelectorAll('header .stat')].map((stat) => stat.textContent)).toEqual([
    '길드원0'
  ])
})
