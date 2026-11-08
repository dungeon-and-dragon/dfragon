// @vitest-environment jsdom
import * as stylex from '@stylexjs/stylex'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import type { GameTextLines, GameTextTone } from '#core/catalog/game-text'
import type { OathCatalog } from '#core/catalog/oath-catalog'
import { characterDetailFixture } from '#core/testing/character-detail'
import { type ClientHost, ClientHostContext } from '../../../host/client-host'
import { createTestClientHost } from '../../../testing/test-support/client-host'
import { TestQueryClient } from '../../../testing/test-support/test-query-client'
import { toneStyles } from './GameText.style'
import { OathTab } from './OathTab'

type Effects = OathCatalog['sets'][number]['options'][number]['effects']

function effects(primitive: GameTextLines): Effects {
  return { rare: null, unique: null, legendary: null, epic: null, primitive }
}

// 데이터 묶음(oath.v2.json)과 같은 모양의 합성 데이터다. 세트 번호와 고른 선택지 이름은 딜러 fixture의 용투 서약이다.
const OATH_CATALOG: OathCatalog = {
  version: 'synthetic',
  sets: [
    {
      setId: 16204,
      name: '야망의 용투 서약',
      icon: 'https://skilltab.test/oath-set/16204.png',
      options: [
        {
          name: '용투 : 세계를 태우는 불꽃',
          icon: 'https://skilltab.test/oath/9.png',
          effects: effects([
            [
              { text: '[투룡의 불꽃]', tone: 'increase' },
              { text: ' [장비 발동 옵션]', tone: 'default' }
            ],
            [{ text: '모든 속도 +20%', tone: 'rarity-primordial' }],
            [{ text: '[용투장의 난 세트] 장착 시', tone: 'disabled' }]
          ])
        },
        {
          name: '용투 : 용의 분노',
          icon: 'https://skilltab.test/oath/10.png',
          effects: effects([[{ text: '분노', tone: 'rarity-primordial' }]])
        },
        {
          name: '용투 : 승리의 함성',
          icon: 'https://skilltab.test/oath/11.png',
          effects: effects([[{ text: '[함성]', tone: 'increase' }]])
        }
      ]
    }
  ],
  items: [
    {
      name: '세계를 태우는 용투 서약',
      rarity: '에픽',
      icon: 'https://skilltab.test/oath-item/epic.webp'
    },
    {
      name: '세계를 태우는 용투 서약',
      rarity: '태초',
      icon: 'https://skilltab.test/oath-item/primordial.webp'
    }
  ]
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
  detail: CharacterDetailView,
  host: ClientHost = createTestClientHost()
): Promise<void> {
  await act(async () =>
    root.render(
      <ClientHostContext value={host}>
        <TestQueryClient>
          <OathTab detail={detail} />
        </TestQueryClient>
      </ClientHostContext>
    )
  )
}

function section(name: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)

  if (found === null) {
    throw new Error(`${name} 영역이 없다`)
  }

  return found
}

function strip(): Element {
  const found = container.firstElementChild?.firstElementChild
  if (found == null) {
    throw new Error('서약 한 줄 영역이 없다')
  }

  return found
}

function hasTone(segment: Element | null | undefined, tone: GameTextTone): boolean {
  const { className } = stylex.props(toneStyles[tone])
  if (segment == null || className === undefined) {
    return false
  }

  return className.split(' ').every((name) => segment.className.split(' ').includes(name))
}

function lines(name: string): string[][] {
  return [...section(name).querySelectorAll('dl > div')].map((line) =>
    [...line.children].map((cell) => cell.textContent ?? '')
  )
}

it('딜러의 서약, 세트, 결정, 세트 효과, 가호와 진의 단계를 그린다', async () => {
  await render(characterDetailFixture('dealer'))

  expect(container.textContent).toContain('서약세계를 태우는 용투 서약655pt')
  expect(container.textContent).toContain(
    '서약 세트야망의 용투 서약용투 : 세계를 태우는 불꽃태초2,780pt'
  )
  const crystals = [...section('서약 결정').querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
  )
  expect(crystals).toHaveLength(11)
  expect(crystals[0]).toEqual(['9', '용투 : 태초의 광휘 결정', '205pt'])
  expect(crystals.at(-1)).toEqual(['8', '용투 : 완전한 광휘 결정', '165pt'])
  expect(section('서약 결정').querySelector('h2')?.textContent).toBe('서약 결정 11')
  expect(lines('서약 세트 효과')).toEqual([
    ['최종 데미지 증가', '500%'],
    ['버프력', '35,500'],
    ['모험가 명성', '18,000']
  ])
  expect(lines('서약의 가호')[0]).toEqual(['최종 데미지 증가', '71%'])
  expect(section('묵언의 진의').querySelector('h2')?.textContent).toBe('묵언의 진의')
  expect(lines('묵언의 진의')[0]).toEqual(['<묵언의 진의> - 첫 번째 진의', '고요한 호흡'])
})

it('세트 효과와 진의가 없는 버퍼 서약은 그 영역을 생략한다', async () => {
  await render(characterDetailFixture('buffer'))

  expect(container.textContent).toContain('레어 Ⅱ')
  expect(container.querySelector('section[aria-label="서약 세트 효과"]')).toBeNull()
  expect(container.querySelector('section[aria-label="묵언의 진의"]')).toBeNull()
  expect(lines('서약의 가호')).toHaveLength(3)
})

it('서약이 없는 캐릭터는 아무것도 그리지 않는다', async () => {
  await render({ ...characterDetailFixture('dealer'), oath: null })

  expect(container.innerHTML).toBe('')
})

it('서약 데이터가 있으면 세트 카드와 선택지 효과 카드 3장을 두고 고른 선택지만 표시한다', async () => {
  await render(
    characterDetailFixture('dealer'),
    createTestClientHost({ getOathCatalog: async () => OATH_CATALOG })
  )

  expect(
    container.querySelector('img[src="https://skilltab.test/oath-set/16204.png"]')
  ).not.toBeNull()
  expect(container.textContent).toContain('야망의 용투 서약태초2,780pt')
  expect(container.textContent).not.toContain('용투 : 세계를 태우는 불꽃')
  const cards = [...container.querySelectorAll('article')]
  expect(cards.map((card) => card.getAttribute('aria-current'))).toEqual(['true', null, null])
  expect(
    [...(cards[0]?.querySelectorAll('p > span') ?? [])].map((line) => line.textContent)
  ).toEqual(['[투룡의 불꽃] [장비 발동 옵션]', '모든 속도 +20%', '[용투장의 난 세트] 장착 시'])
  expect(cards.map((card) => card.textContent?.includes('선택'))).toEqual([true, false, false])
  expect(section('서약 본체').textContent).toContain('세계를 태우는 용투 서약655pt')
  expect(section('서약 본체').querySelector('img')?.getAttribute('src')).toBe(
    'https://skilltab.test/oath-item/primordial.webp'
  )
  expect(section('서약 결정').querySelectorAll('tbody tr')).toHaveLength(11)
})

it('고르지 않은 선택지 카드도 문구를 조각의 tone 색으로 그린다', async () => {
  await render(
    characterDetailFixture('dealer'),
    createTestClientHost({ getOathCatalog: async () => OATH_CATALOG })
  )

  const [, rage, shout] = [...container.querySelectorAll('article')]
  expect(hasTone(rage?.querySelector('p span span'), 'rarity-primordial')).toBe(true)
  expect(hasTone(shout?.querySelector('p span span'), 'increase')).toBe(true)
})

it('서약 데이터에 없는 세트는 지금 화면대로 그린다', async () => {
  await render(
    characterDetailFixture('dealer'),
    createTestClientHost({ getOathCatalog: async () => ({ ...OATH_CATALOG, sets: [] }) })
  )

  expect(container.textContent).toContain(
    '서약 세트야망의 용투 서약용투 : 세계를 태우는 불꽃태초2,780pt'
  )
  expect(container.querySelector('article')).toBeNull()
  expect(container.querySelector('section[aria-label="서약 본체"]')).toBeNull()
})

it('세트가 없는 서약도 한 줄 화면에 서약 데이터의 아이콘을 둔다', async () => {
  const buffer = characterDetailFixture('buffer')
  const oath = buffer.oath
  if (oath === null) {
    throw new Error('buffer fixture에 서약이 없다')
  }
  const withoutSet = { ...buffer, oath: { ...oath, setInfo: null } }
  const catalog: OathCatalog = {
    ...OATH_CATALOG,
    items: [
      {
        name: '영겁의 안개 서약',
        rarity: '에픽',
        icon: 'https://skilltab.test/oath-item/mist-epic.webp'
      }
    ]
  }

  await render(withoutSet, createTestClientHost({ getOathCatalog: async () => catalog }))

  expect(container.textContent).toContain('서약영겁의 안개 서약455pt')
  expect(strip().querySelector('img')?.getAttribute('src')).toBe(
    'https://skilltab.test/oath-item/mist-epic.webp'
  )
})

it('서약 데이터가 없으면 한 줄 화면에 아이콘을 두지 않는다', async () => {
  const buffer = characterDetailFixture('buffer')
  const oath = buffer.oath
  if (oath === null) {
    throw new Error('buffer fixture에 서약이 없다')
  }

  await render({ ...buffer, oath: { ...oath, setInfo: null } })

  expect(container.textContent).toContain('서약영겁의 안개 서약455pt')
  expect(strip().querySelector('img')).toBeNull()
})
