// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Guild } from '#entities/adventure-guild'
import type { StoredCharacter } from '#entities/ranking'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { TestRouter } from '#testing/test-support/test-router'
import { GUILD_URL } from './api/guild.handlers'
import { GuildScreen } from './GuildScreen'

let container: HTMLDivElement
let root: Root
let requestedGuildIds: string[]

beforeEach(() => {
  requestedGuildIds = []
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
  const score: StoredCharacter['score'] =
    index === 1 ? { calculator: 'equipment', value: 1_234_567, approximate: null } : null

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
    role: null,
    score
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

async function render(guild: Guild): Promise<void> {
  server.use(
    http.get(GUILD_URL, ({ params }) => {
      requestedGuildIds.push(String(params.guildId))

      return HttpResponse.json(guild)
    })
  )

  await act(async () =>
    root.render(
      <TestQueryClient>
        <TestRouter>
          <GuildScreen guildId="guild-1" />
        </TestRouter>
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull())
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

it('제목 상자에 길드 이름과 길드원 수만 두고 열은 순번, 캐릭터, 명성, 점수, 모험단이다', async () => {
  await render(guildOf(2))

  expect(requestedGuildIds).toEqual(['guild-1'])
  expect(container.querySelector('h1')?.textContent).toBe('합성 길드')
  const stats = [...container.querySelectorAll('header .stat')].map((stat) => stat.textContent)
  expect(stats).toEqual(['길드원2'])
  expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('길드원')
  expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
    '#',
    '캐릭터',
    '명성',
    '점수',
    '모험단'
  ])
  expect(container.querySelector('thead th[aria-sort]')).toBeNull()
  expect([...bodyRows()[0].querySelectorAll('td')].map((cell) => cell.textContent)).toEqual([
    '1',
    '카인합성1합성 전직89,9991,234,567모험단1',
    '89,999',
    '장비1,234,567',
    '모험단1'
  ])
  expect(
    container.querySelector('tbody a[href="/adventures/%EB%AA%A8%ED%97%98%EB%8B%A81"]')
  ).not.toBeNull()
})

it('근사값으로 저장한 점수는 ≈를 붙여 보이고 근사 방법을 title로 전한다', async () => {
  const score = {
    calculator: 'buff' as const,
    value: 4_120_000,
    approximate: { source: 'missing_switching_item' }
  }
  await render(guildOf(1, { members: [{ ...member(1), score }] }))

  const cells = [...bodyRows()[0].querySelectorAll('td')]
  expect(cells[3]?.textContent).toBe('버프≈4,120,000')
  expect(cells[3]?.querySelector('[title]')?.getAttribute('title')).toBe(
    '근사값. 판별하지 못한 버프 강화 아이템을 빼고 계산한 값이라 게임 버프 점수와 1% 넘게 다를 수 있습니다.'
  )
})

it('길드원 120명 가운데 처음 50명을 그리고 불러오기를 누를 때마다 50명씩 더 그린다', async () => {
  await render(guildOf(120))

  expect(bodyRows()).toHaveLength(50)
  await clickMore()
  expect(bodyRows()).toHaveLength(100)
  await clickMore()
  expect(bodyRows()).toHaveLength(120)
  expect(moreButton()).toBeUndefined()
})

it('길드원이 50명 이하면 모두 그리고 불러오기 버튼을 두지 않는다', async () => {
  await render(guildOf(50))

  expect(bodyRows()).toHaveLength(50)
  expect(moreButton()).toBeUndefined()
})

it('길드원이 없으면 목록 상자에 빈 문구만 두고 길드원 수는 0이다', async () => {
  await render(guildOf(0, { guildName: null }))

  expect(container.querySelector('section p')?.textContent).toBe('저장된 캐릭터가 없습니다.')
  expect(container.querySelector('section table')).toBeNull()
  expect(container.querySelector('h1')?.textContent).toBe('길드')
  expect([...container.querySelectorAll('header .stat')].map((stat) => stat.textContent)).toEqual([
    '길드원0'
  ])
})
