// @vitest-environment jsdom
import type { RequestHandler } from 'msw'
import { act } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '#entities/character'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import {
  type GameTextTone,
  gameTextToneClasses,
  type OathCatalog,
  useOathCatalog
} from '#entities/catalog'
import { oathCatalogFixture } from '#entities/catalog/api/oath-catalog.fixture'
import { oathCatalogHandlers } from '#entities/catalog/api/oath-catalog.handlers'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { OathTab } from './OathTab'

// 세트 번호와 고른 선택지 이름은 딜러 fixture의 용투 서약이고, 서약 본체 아이콘은 딜러 서약의 태초 등급으로 고른다.
const OATH_CATALOG: OathCatalog = {
  ...oathCatalogFixture.characterDetail,
  items: [
    ...oathCatalogFixture.characterDetail.items,
    {
      name: '세계를 태우는 용투 서약',
      rarity: '태초',
      icon: 'https://skilltab.test/oath-item/primordial.webp'
    }
  ]
}

let container: HTMLDivElement
let root: Root
let probe: HTMLOutputElement

beforeEach(() => {
  container = document.createElement('div')
  probe = document.createElement('output')
  document.body.append(container, probe)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  probe.remove()
})

// 서약 데이터가 없을 때와 받는 중일 때 화면이 같아, 같은 캐시를 읽는 이 컴포넌트로 응답을 받았는지 본다.
function CatalogStatusProbe(): React.JSX.Element {
  return createPortal(useOathCatalog().status, probe)
}

async function render(
  detail: CharacterDetailView,
  catalog: RequestHandler = oathCatalogHandlers.notUploaded
): Promise<void> {
  server.use(catalog)
  await act(async () =>
    root.render(
      <TestQueryClient>
        <CatalogStatusProbe />
        <OathTab detail={detail} />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(probe.textContent).toBe('success'))
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
  const className = gameTextToneClasses[tone]
  if (segment == null || className === '') {
    return false
  }

  return className.split(' ').every((name) => segment.className.split(' ').includes(name))
}

function lines(name: string): string[][] {
  return [...section(name).querySelectorAll('dl > div')].map((line) =>
    [...line.children].map((cell) => cell.textContent ?? '')
  )
}

it('딜러의 서약, 세트, 결정과 진의 단계마다 고른 효과를 그리고, 쿨타임 감소는 파랑, 최종 데미지는 빨강으로 칠한다', async () => {
  await render(characterDetailFixture('dealer'))

  expect(container.textContent).toContain('서약세계를 태우는 용투 서약서약 세트')
  expect(container.textContent).not.toContain('655pt')
  expect(container.textContent).toContain(
    '서약 세트야망의 용투 서약용투 : 세계를 태우는 불꽃태초2,780pt최종 데미지 +9%'
  )
  const crystals = [...section('서약 결정').querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
  )
  expect(crystals).toHaveLength(11)
  expect(crystals[0]).toEqual(['용투 : 태초의 광휘 결정'])
  expect(crystals.at(-1)).toEqual(['용투 : 완전한 광휘 결정'])
  expect(section('서약 결정').querySelector('h2')).toBeNull()
  expect(container.querySelector('section[aria-label="서약 세트 효과"]')).toBeNull()
  expect(container.querySelector('section[aria-label="서약의 가호"]')).toBeNull()
  expect(section('묵언의 진의').querySelector('h2')?.textContent).toBe('묵언의 진의')
  expect(lines('묵언의 진의')).toEqual([
    ['첫 번째 진의', '쿨타임 감소'],
    ['두 번째 진의', '쿨타임 감소'],
    ['세 번째 진의', '쿨타임 감소'],
    ['네 번째 진의', '최종 데미지'],
    ['다섯 번째 진의', '이동속도'],
    ['여섯 번째 진의', '이동속도'],
    ['일곱 번째 진의', '이동속도'],
    ['여덟 번째 진의', '이동속도'],
    ['아홉 번째 진의', '이동속도']
  ])
  const tones = [...section('묵언의 진의').querySelectorAll('dd')]
    .slice(2, 5)
    .map((value) => [
      value.textContent,
      value.classList.contains('text-game-enhance'),
      value.classList.contains('text-game-decrease')
    ])
  expect(tones).toEqual([
    ['쿨타임 감소', true, false],
    ['최종 데미지', false, true],
    ['이동속도', false, false]
  ])
})

it('진의를 배우지 않은 버퍼 서약도 아홉 번째 진의까지 효과 칸을 비워 그린다', async () => {
  await render(characterDetailFixture('buffer'))

  expect(container.textContent).toContain('레어 Ⅱ')
  expect(lines('묵언의 진의')).toEqual([
    ['첫 번째 진의', ''],
    ['두 번째 진의', ''],
    ['세 번째 진의', ''],
    ['네 번째 진의', ''],
    ['다섯 번째 진의', ''],
    ['여섯 번째 진의', ''],
    ['일곱 번째 진의', ''],
    ['여덟 번째 진의', ''],
    ['아홉 번째 진의', '']
  ])
})

it('결정을 일부만 착용하면 남은 칸을 빈 아이콘 줄로 채워 11줄을 둔다', async () => {
  const dealer = characterDetailFixture('dealer')
  const oath = dealer.oath

  if (oath === null) {
    throw new Error('dealer fixture에 서약이 없다')
  }

  const crystal = oath.crystal.slice(0, 7)

  await render({ ...dealer, oath: { ...oath, crystal } })

  const rows = [...section('서약 결정').querySelectorAll('tbody tr')]

  expect(rows).toHaveLength(11)
  expect(rows.slice(7).map((row) => row.textContent)).toEqual(['', '', '', ''])
})

it('서약이 없는 캐릭터는 아무것도 그리지 않는다', async () => {
  await render({ ...characterDetailFixture('dealer'), oath: null })

  expect(container.innerHTML).toBe('')
})

it('서약 데이터가 있으면 세트 카드와 선택지 효과 카드 3장을 두고 고른 선택지만 표시한다', async () => {
  await render(characterDetailFixture('dealer'), oathCatalogHandlers.catalog(OATH_CATALOG))

  expect(
    container.querySelector('img[src="https://skilltab.test/oath-set/16204.png"]')
  ).not.toBeNull()
  expect(container.textContent).toContain('야망의 용투 서약태초2,780pt최종 데미지 +9%')
  expect(container.textContent).not.toContain('용투 : 세계를 태우는 불꽃')
  const cards = [...container.querySelectorAll('article')]
  expect(cards.map((card) => card.getAttribute('aria-current'))).toEqual(['true', null, null])
  expect(
    [...(cards[0]?.querySelectorAll('p > span') ?? [])].map((line) => line.textContent)
  ).toEqual(['[투룡의 불꽃] [장비 발동 옵션]', '모든 속도 +20%', '[용투장의 난 세트] 장착 시'])
  expect(cards.map((card) => card.textContent?.includes('선택'))).toEqual([true, false, false])
  expect(section('서약 본체').textContent).toBe('세계를 태우는 용투 서약')
  expect(section('서약 본체').querySelector('img')?.getAttribute('src')).toBe(
    'https://skilltab.test/oath-item/primordial.webp'
  )
  expect(section('서약 결정').querySelectorAll('tbody tr')).toHaveLength(11)
})

it('고르지 않은 선택지 카드도 문구를 조각의 tone 색으로 그린다', async () => {
  await render(characterDetailFixture('dealer'), oathCatalogHandlers.catalog(OATH_CATALOG))

  const [, rage, shout] = [...container.querySelectorAll('article')]
  expect(hasTone(rage?.querySelector('p span span'), 'rarity-primordial')).toBe(true)
  expect(hasTone(shout?.querySelector('p span span'), 'increase')).toBe(true)
})

it('서약 데이터에 없는 세트는 지금 화면대로 그린다', async () => {
  await render(
    characterDetailFixture('dealer'),
    oathCatalogHandlers.catalog({ ...OATH_CATALOG, sets: [] })
  )

  expect(container.textContent).toContain(
    '서약 세트야망의 용투 서약용투 : 세계를 태우는 불꽃태초2,780pt최종 데미지 +9%'
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

  await render(withoutSet, oathCatalogHandlers.catalog(catalog))

  expect(container.textContent).toContain('서약영겁의 안개 서약결정')
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

  expect(container.textContent).toContain('서약영겁의 안개 서약결정')
  expect(strip().querySelector('img')).toBeNull()
})
