// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { ClientHostContext, type ClientHost } from '../../host/client-host'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { TestQueryClient } from '../../testing/test-support/test-query-client'
import { toneClassesOf } from '../../testing/test-support/score-tone-class'
import type { CharacterTab } from './character-tabs'
import { CharacterDetailScreen } from './CharacterDetailScreen'
import { TestRouter } from '../../testing/test-support/test-router'
import { useRecentCharacterStore } from '../../hooks/useRecentCharacterStore'

type Card = NonNullable<CharacterDetailView['card']>
type Score = NonNullable<Card['score']>

const versions = { package: 'test', rulesRev: 'test', bundleId: 'test' }

function scoreOf(score: Partial<Score>): Score {
  return {
    calculator: 'equipment',
    value: null,
    skipped: null,
    approximate: null,
    versions,
    ...score
  }
}

const NOW = Date.parse('2026-11-09T05:38:00.000Z')

function detailOf({
  character,
  card = null,
  fetchedAt = '2026-11-09T05:08:00.000Z'
}: {
  character?: Partial<CharacterDetailView['character']>
  card?: Card | null
  fetchedAt?: string
} = {}): CharacterDetailView {
  return {
    character: {
      serverId: 'bakal',
      characterId: 'dealer-1',
      characterName: '커피',
      serverName: '바칼',
      level: 115,
      jobId: null,
      jobGrowId: null,
      jobName: '귀검사(남)',
      jobGrowName: '眞 버서커',
      fame: 125689,
      adventureName: '동네커피',
      guildId: 'guild-1',
      guildName: '필로시스',
      ...character
    },
    freshness: { lastSuccessfulFetchAt: fetchedAt },
    card,
    equipment: { equipment: [], setItemInfo: [] },
    creature: null,
    avatar: [],
    mistAssimilation: null,
    oath: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    status: { status: [], buff: [] }
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function render(
  getCharacterDetail: ClientHost['getCharacterDetail'],
  {
    tab = 'equipment',
    onTabChange = vi.fn(),
    refreshCharacterDetail
  }: {
    tab?: CharacterTab
    onTabChange?: (tab: CharacterTab) => void
    refreshCharacterDetail?: ClientHost['refreshCharacterDetail']
  } = {}
): Promise<ClientHost> {
  const host = createTestClientHost({
    getCharacterDetail: vi.fn(getCharacterDetail),
    refreshCharacterDetail
  })
  await act(async () =>
    root.render(
      <TestRouter>
        <ClientHostContext value={host}>
          <TestQueryClient>
            <CharacterDetailScreen
              serverId="bakal"
              characterId="dealer-1"
              tab={tab}
              onTabChange={onTabChange}
            />
          </TestQueryClient>
        </ClientHostContext>
      </TestRouter>
    )
  )

  return host
}

function summary(): HTMLElement {
  return container.querySelector<HTMLElement>('section[aria-label="캐릭터 요약"]')!
}

function identityLines(): Element[] {
  return [...(summary().querySelector('h1')?.parentElement?.parentElement?.children ?? [])]
}

function textLines(): string[] {
  return identityLines().map((line) => line.textContent ?? '')
}

function statValue(label: string): HTMLElement {
  const labelElement = [...summary().querySelectorAll('span')].find(
    (span) => span.textContent === label
  )

  return labelElement!.nextElementSibling as HTMLElement
}

function refreshButton(): HTMLButtonElement {
  return [...summary().querySelectorAll('button')].find((button) =>
    ['갱신', '받는 중'].includes(button.textContent ?? '')
  )!
}

function fetchedAt(): HTMLTimeElement {
  return summary().querySelector('time')!
}

function tabs(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="tab"]')]
}

it('받는 동안에는 요약과 탭 줄 대신 뼈대와 받는 중 안내만 둔다', async () => {
  await render(() => new Promise<never>(() => {}))

  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    '캐릭터 정보를 받는 중입니다.'
  )
  expect(container.querySelectorAll('[aria-busy="true"] > [aria-hidden="true"]')).toHaveLength(2)
  expect(container.querySelector('h1')).toBeNull()
  expect(container.querySelector('[role="tablist"]')).toBeNull()
})

it('딜러 요약은 이름, 서버 칩과 전직과 레벨, 모험단과 길드, 명성 색의 명성, 역할 색의 장비 점수를 보인다', async () => {
  const card: Card = { role: 'dealer', score: scoreOf({ value: 392332 }) }
  await render(async () => detailOf({ card }))

  expect(textLines()).toEqual(['커피갱신30분 전', '바칼버서커Lv.115', '동네커피필로시스'])
  expect(summary().querySelector('img')?.getAttribute('src')).toBe(
    'https://img-api.neople.co.kr/df/servers/bakal/characters/dealer-1?zoom=1'
  )
  expect(statValue('명성').textContent).toBe('125,689')
  expect(toneClassesOf(statValue('명성'))).toEqual(['fame'])
  expect(statValue('장비 점수').firstChild?.textContent).toBe('392,332')
  expect(toneClassesOf(statValue('장비 점수'))).toEqual(['dealer'])
})

it('남성 크루세이더는 카드 역할을 전직에 붙여 보이고, 최근 본 캐릭터에도 역할을 남긴다', async () => {
  const maleCrusader = { jobName: '프리스트(남)', jobGrowName: '眞 크루세이더' }
  await render(async () =>
    detailOf({ character: maleCrusader, card: { role: 'buffer', score: null } })
  )

  expect(textLines()[1]).toBe('바칼크루세이더(버퍼)Lv.115')
  expect(useRecentCharacterStore.getState().recentCharacters[0]).toMatchObject({
    characterId: 'dealer-1',
    role: 'buffer'
  })
})

it('모험단과 길드 이름은 그 페이지로 가는 링크다', async () => {
  await render(async () => detailOf())

  const links = [...summary().querySelectorAll('a')].map((link) => [
    link.textContent,
    link.getAttribute('href')
  ])
  expect(links).toEqual([
    ['동네커피', '/adventures/%EB%8F%99%EB%84%A4%EC%BB%A4%ED%94%BC'],
    ['필로시스', '/guilds/guild-1']
  ])
})

it('버퍼 요약은 점수 라벨이 버프 점수이고 버퍼 색이며, 근사값은 표처럼 ≈를 붙인다', async () => {
  const card: Card = {
    role: 'buffer',
    score: scoreOf({
      calculator: 'buff',
      skipped: { kind: 'input_gate', message: '입력값 차이' },
      approximate: { value: 151199, source: 'input_gate_diagnostic', warning: '근사값' }
    })
  }
  await render(async () => detailOf({ card }))

  expect(statValue('버프 점수').firstChild?.textContent).toBe('≈151,199')
  expect(toneClassesOf(statValue('버프 점수'))).toEqual(['buffer'])
  expect(summary().textContent).not.toContain('장비 점수')
})

it('명성과 점수가 없으면 -를 두고, 길드가 없으면 모험단만 구분선 없이 둔다', async () => {
  await render(async () =>
    detailOf({ character: { fame: null, guildName: null }, card: { role: 'dealer', score: null } })
  )

  expect(statValue('명성').textContent).toBe('-')
  expect(statValue('장비 점수').textContent).toBe('-')
  expect(textLines()[2]).toBe('동네커피')
  expect(identityLines()[2].querySelectorAll('[aria-hidden="true"]')).toHaveLength(0)
})

it('탭 줄은 일곱 탭을 순서대로 두고 받은 tab을 고르며, 다른 탭을 누르면 다시 조회하지 않고 그 탭을 알린다', async () => {
  const onTabChange = vi.fn()
  const host = await render(async () => detailOf(), { tab: 'oath', onTabChange })

  expect(tabs().map((tab) => tab.textContent)).toEqual([
    '장비',
    '서약',
    '스킬',
    '아바타',
    '버프 강화',
    '스탯',
    '타임라인'
  ])
  expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual([
    'false',
    'true',
    'false',
    'false',
    'false',
    'false',
    'false'
  ])
  expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1)

  await act(async () => tabs()[5].click())

  expect(onTabChange).toHaveBeenCalledExactlyOnceWith('status')
  expect(host.getCharacterDetail).toHaveBeenCalledOnce()
})

it('조회에 실패하면 요약과 탭 없이 받은 오류 문구를 그대로 보인다', async () => {
  await render(async () => {
    throw new Error('캐릭터 정보 조회 중 오류가 발생했습니다.')
  })

  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    '캐릭터 정보 조회 중 오류가 발생했습니다.'
  )
  expect(container.querySelector('section[aria-label="캐릭터 요약"]')).toBeNull()
  expect(container.querySelector('[role="tablist"]')).toBeNull()
})

it('받은 지 1분이 지났으면 갱신 버튼이 켜져 있고 옆에 받은 시각을 상대 시각으로, title에 절대 시각으로 보인다', async () => {
  await render(async () => detailOf())

  expect(refreshButton().disabled).toBe(false)
  expect(refreshButton().textContent).toBe('갱신')
  expect(fetchedAt().textContent).toBe('30분 전')
  expect(fetchedAt().getAttribute('title')).toBe('11-09 14:08')
  expect(fetchedAt().getAttribute('datetime')).toBe('2026-11-09T05:08:00.000Z')
})

it('갱신을 누르면 강제 갱신을 한 번 요청하고, 성공하면 상세를 다시 조회하지 않고 새 값과 새 받은 시각으로 다시 그린다', async () => {
  const refreshed = detailOf({
    character: { characterName: '라떼', fame: 130000 },
    fetchedAt: new Date(NOW).toISOString()
  })
  const refreshCharacterDetail = vi.fn<ClientHost['refreshCharacterDetail']>(async () => refreshed)
  const host = await render(async () => detailOf(), { refreshCharacterDetail })

  await act(async () => refreshButton().click())

  expect(refreshCharacterDetail).toHaveBeenCalledExactlyOnceWith({
    serverId: 'bakal',
    characterId: 'dealer-1'
  })
  expect(host.getCharacterDetail).toHaveBeenCalledOnce()
  expect(summary().querySelector('h1')?.textContent).toBe('라떼')
  expect(statValue('명성').textContent).toBe('130,000')
  expect(fetchedAt().textContent).toBe('방금 전')
  expect(refreshButton().disabled).toBe(true)
  expect(useRecentCharacterStore.getState().recentCharacters[0]).toMatchObject({
    characterId: 'dealer-1',
    characterName: '라떼'
  })
})

it('받는 중에는 버튼이 꺼지고 받는 중으로 바뀌며, 뼈대 없이 기존 요약과 탭을 그대로 보인다', async () => {
  const refreshCharacterDetail = vi.fn<ClientHost['refreshCharacterDetail']>(
    () => new Promise<never>(() => {})
  )
  await render(async () => detailOf(), { refreshCharacterDetail })

  await act(async () => refreshButton().click())

  expect(refreshButton().disabled).toBe(true)
  expect(refreshButton().textContent).toBe('받는 중')
  expect(summary().getAttribute('aria-busy')).toBe('true')
  expect(summary().querySelector('h1')?.textContent).toBe('커피')
  expect(statValue('명성').textContent).toBe('125,689')
  expect(fetchedAt().textContent).toBe('30분 전')
  expect(container.querySelector('[role="tablist"]')).not.toBeNull()
  expect(container.querySelector('[role="status"]')).toBeNull()
})

it('강제 갱신이 실패하면 오류 문구 없이 기존 값을 그대로 두고 버튼을 다시 켠다', async () => {
  const refreshCharacterDetail = vi.fn<ClientHost['refreshCharacterDetail']>(async () => {
    throw new Error('캐릭터 정보 조회 중 오류가 발생했습니다.')
  })
  await render(async () => detailOf(), { refreshCharacterDetail })

  await act(async () => refreshButton().click())

  expect(refreshCharacterDetail).toHaveBeenCalledOnce()
  expect(refreshButton().disabled).toBe(false)
  expect(refreshButton().textContent).toBe('갱신')
  expect(summary().getAttribute('aria-busy')).toBeNull()
  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(summary().querySelector('h1')?.textContent).toBe('커피')
  expect(fetchedAt().textContent).toBe('30분 전')
})

it('받은 지 1분 안이면 버튼이 꺼져 있고 방금 전으로 보이며, 1분이 지나면 다시 그리지 않아도 켜진다', async () => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  await render(async () => detailOf({ fetchedAt: new Date(NOW - 30_000).toISOString() }))
  await act(async () => vi.advanceTimersByTimeAsync(0))

  expect(refreshButton().disabled).toBe(true)
  expect(fetchedAt().textContent).toBe('방금 전')

  for (let second = 0; second < 30; second += 1) {
    await act(async () => vi.advanceTimersByTimeAsync(1000))
  }

  expect(refreshButton().disabled).toBe(false)
  expect(fetchedAt().textContent).toBe('1분 전')
})
