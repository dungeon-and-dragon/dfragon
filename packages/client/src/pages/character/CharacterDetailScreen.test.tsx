// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import { ClientHostContext, type ClientHost } from '../../hooks/useClientHost'
import { createTestClientHost } from '../../testing/test-support/client-host'
import { toneClassesOf } from '../../testing/test-support/score-tone-class'
import type { CharacterTab } from './character-tabs'
import { CharacterDetailScreen } from './CharacterDetailScreen'
import { TestRouter } from '../../testing/test-support/test-router'

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

function detailOf({
  character,
  card = null
}: {
  character?: Partial<CharacterDetailView['character']>
  card?: Card | null
} = {}): CharacterDetailView {
  return {
    character: {
      serverId: 'bakal',
      characterId: 'dealer-1',
      characterName: '커피',
      serverName: '바칼',
      level: 115,
      jobName: '귀검사(남)',
      jobGrowName: '眞 버서커',
      fame: 125689,
      adventureName: '동네커피',
      guildId: 'guild-1',
      guildName: '필로시스',
      ...character
    },
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

async function render(
  getCharacterDetail: ClientHost['getCharacterDetail'],
  {
    tab = 'equipment',
    onTabChange = vi.fn()
  }: { tab?: CharacterTab; onTabChange?: (tab: CharacterTab) => void } = {}
): Promise<ClientHost> {
  const host = createTestClientHost({ getCharacterDetail: vi.fn(getCharacterDetail) })
  await act(async () =>
    root.render(
      <TestRouter>
        <ClientHostContext value={host}>
          <CharacterDetailScreen
            serverId="bakal"
            characterId="dealer-1"
            tab={tab}
            onTabChange={onTabChange}
          />
        </ClientHostContext>
      </TestRouter>
    )
  )

  return host
}

function summary(): HTMLElement {
  return container.querySelector<HTMLElement>('section[aria-label="캐릭터 요약"]')!
}

function textLines(): string[] {
  return [...summary().querySelectorAll('h1 ~ div, h1')].map((line) => line.textContent ?? '')
}

function statValue(label: string): HTMLElement {
  const labelElement = [...summary().querySelectorAll('span')].find(
    (span) => span.textContent === label
  )

  return labelElement!.nextElementSibling as HTMLElement
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

  expect(textLines()).toEqual(['커피', '바칼眞 버서커Lv.115', '동네커피필로시스'])
  expect(summary().querySelector('img')?.getAttribute('src')).toBe(
    'https://img-api.neople.co.kr/df/servers/bakal/characters/dealer-1?zoom=1'
  )
  expect(statValue('명성').textContent).toBe('125,689')
  expect(toneClassesOf(statValue('명성'))).toEqual(['fame'])
  expect(statValue('장비 점수').firstChild?.textContent).toBe('392,332')
  expect(toneClassesOf(statValue('장비 점수'))).toEqual(['dealer'])
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
  expect(summary().querySelectorAll('[aria-hidden="true"]')).toHaveLength(0)
})

it('탭 줄은 일곱 탭을 순서대로 두고 받은 tab을 고르며, 다른 탭을 누르면 다시 조회하지 않고 그 탭을 알린다', async () => {
  const onTabChange = vi.fn()
  const host = await render(async () => detailOf(), { tab: 'oath', onTabChange })

  expect(tabs().map((tab) => tab.textContent)).toEqual([
    '장비',
    '서약',
    '스킬',
    '아바타와 크리쳐',
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
