// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Guild } from '#core/adventure-guild/adventure-guild'
import type { StoredCharacter } from '#core/ranking/ranking-stats'
import { ClientHostContext, type ClientHost } from '../../host/client-host'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { TestRouter } from '../../testing/test-support/test-router'
import { GuildScreen } from './GuildScreen'

let container: HTMLDivElement
let root: Root
let observed: { callback: IntersectionObserverCallback; target: Element }[]

class FakeIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element): void {
    observed.push({ callback: this.callback, target })
  }
  disconnect(): void {
    observed = observed.filter((entry) => entry.callback !== this.callback)
  }
}

beforeEach(() => {
  observed = []
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
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
    averageFame: 81234,
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

function reachEnd(): Promise<void> {
  return act(async () => {
    for (const { callback, target } of observed) {
      callback([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as never)
    }
  })
}

it('제목 상자에 길드 이름, 길드원 수, 평균 명성을 두고 열은 순번, 캐릭터, 명성, 모험단이다', async () => {
  const getGuild = vi.fn<ClientHost['getGuild']>(async () => guildOf(2))
  await render(getGuild)

  expect(getGuild).toHaveBeenCalledWith('guild-1')
  expect(container.querySelector('h1')?.textContent).toBe('합성 길드')
  const stats = [...container.querySelectorAll('header div')].map((stat) => stat.textContent)
  expect(stats).toEqual(expect.arrayContaining(['길드원2', '평균 명성81,234']))
  expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('길드원')
  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '#',
    '캐릭터',
    '명성',
    '모험단'
  ])
  expect([...bodyRows()[0].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual([
    '1',
    '카인합성1합성 전직',
    '89,999',
    '모험단1'
  ])
  expect(
    container.querySelector('tbody a[href="/adventures/%EB%AA%A8%ED%97%98%EB%8B%A81"]')
  ).not.toBeNull()
})

it('길드원 45명 가운데 처음 20명을 그리고 끝에 닿을 때마다 20명씩 더 그린다', async () => {
  await render(async () => guildOf(45))

  expect(bodyRows()).toHaveLength(20)
  expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(1)
  await reachEnd()
  expect(bodyRows()).toHaveLength(40)
  await reachEnd()
  expect(bodyRows()).toHaveLength(45)
  expect(container.querySelectorAll('tr[aria-hidden]')).toHaveLength(0)
})

it('길드원이 없으면 목록 상자에 한 줄만 두고 평균 명성은 -다', async () => {
  await render(async () => guildOf(0, { guildName: null, averageFame: null }))

  expect(container.querySelector('section')?.textContent).toBe('저장된 캐릭터가 없습니다.')
  expect(container.querySelector('h1')?.textContent).toBe('길드')
  expect([...container.querySelectorAll('header div')].map((stat) => stat.textContent)).toEqual(
    expect.arrayContaining(['길드원0', '평균 명성-'])
  )
})
