// @vitest-environment jsdom
import * as stylex from '@stylexjs/stylex'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { itemIconUrl } from '@dfragon/client-core/lib/character-item'
import { characterDetailFixture } from '@dfragon/client-core/testing/fixtures/character-detail'
import { styles as dotTones } from './avatar/CreatureTable.style'
import { styles as rarityTones } from './avatar/ItemName.style'
import { styles as avatarStyles } from './avatar/AvatarTable.style'
import { AvatarCreatureTab } from './AvatarCreatureTab'
import { styles as partStyles, raritySolid } from './equipment/item-parts.style'

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

async function render(detail: Parameters<typeof AvatarCreatureTab>[0]['detail']): Promise<void> {
  await act(async () => root.render(<AvatarCreatureTab detail={detail} />))
}

function hasTone(element: Element | null | undefined, tone: stylex.StyleXStyles): boolean {
  const { className } = stylex.props(tone)
  if (element == null || className === undefined) {
    return false
  }

  return element.className.split(' ').includes(className)
}

// 이름 칸은 등급 색 이름 오른쪽에 클론 이름을 붙이므로 둘을 |로 나눠 읽는다.
function cellTexts(row: Element): string[] {
  return [...row.querySelectorAll('td')].map((cell) => {
    const lines = [...cell.querySelectorAll('b, span[title]')].map((line) => line.textContent)
    if (lines.length === 0) {
      return cell.textContent
    }

    return lines.join('|')
  })
}

type Detail = Parameters<typeof AvatarCreatureTab>[0]['detail']

// 실제 응답처럼 오라와 같은 형태의 AURA_SKIN 항목을 만든다.
function auraWithSkin(detail: Detail) {
  const aura = detail.avatar.find((avatar) => avatar.slotId === 'AURORA')!
  const auraSkin = {
    ...aura,
    slotId: 'AURA_SKIN',
    slotName: '오라 스킨 아바타',
    itemId: '751204b5eecbe4926acd2996ed3a0ea0',
    itemName: '되찾은 성자의 빛',
    clone: { itemId: null, itemName: null },
    emblems: []
  }

  return { aura, auraSkin }
}

it('딜러 아바타 표는 응답 순서대로 부위, 등급 색 이름과 클론 이름, 옵션, 엠블렘 이름을 보인다', async () => {
  await render(characterDetailFixture('dealer'))

  const rows = [...container.querySelectorAll('section[aria-label="아바타"] tbody tr')]
  expect(rows.map((row) => row.querySelector('td')?.textContent)).toEqual([
    '모자',
    '머리',
    '얼굴',
    '상의',
    '하의',
    '신발',
    '목가슴',
    '허리',
    '스킨',
    '오라',
    '무기'
  ])
  expect(cellTexts(rows[0]!)).toEqual([
    '모자',
    '레어 모자 클론 아바타|인페르노의 장식핀[B타입]',
    '정신력 55 증가',
    '찬란한 붉은빛 엠블렘[힘]|찬란한 붉은빛 엠블렘[힘]'
  ])
  const [, avatarCell, , emblemCell] = rows[0]!.querySelectorAll('td')
  expect(hasTone(avatarCell?.querySelector('b'), rarityTones.rare)).toBe(true)
  expect(avatarCell?.querySelector('span[title]')?.getAttribute('title')).toBe(
    '인페르노의 장식핀[B타입]'
  )
  expect(hasTone(emblemCell?.querySelector('b'), rarityTones.unique)).toBe(true)
})

it('아바타 아이콘 오른쪽에 클론 아이콘을 보이고, 클론이 없으면 같은 크기의 빈 칸을 남긴다', async () => {
  await render(characterDetailFixture('dealer'))

  const rows = [...container.querySelectorAll('section[aria-label="아바타"] tbody tr')]
  const avatarCell = (row: Element) => row.querySelectorAll('td')[1]!
  const headgearIcons = [...avatarCell(rows[0]!).querySelectorAll('img')]
  expect(headgearIcons.map((icon) => icon.getAttribute('src'))).toEqual([
    itemIconUrl(characterDetailFixture('dealer').avatar[0]!.itemId!),
    itemIconUrl('9d2ba5dfe1f49c5a5e31dd0d6665d1de')
  ])
  expect(hasTone(headgearIcons[1], raritySolid.unknown)).toBe(true)

  const topCell = avatarCell(rows[3]!)
  expect(topCell.querySelectorAll('img')).toHaveLength(1)
  const space = topCell.querySelector('img + span[aria-hidden="true"]')
  const spaceClasses = stylex.props(partStyles.iconSpace).className?.split(' ') ?? []
  expect(spaceClasses.length).toBeGreaterThan(0)
  expect(spaceClasses.every((name) => space?.classList.contains(name))).toBe(true)

  const auraCell = avatarCell(rows[9]!)
  expect(auraCell.querySelectorAll('img')).toHaveLength(1)
  expect(auraCell.querySelector('img + span[aria-hidden="true"]')).not.toBeNull()
})

it('오라 스킨을 별도 행 대신 오라 이름과 아이콘 오른쪽에 보인다', async () => {
  const detail = characterDetailFixture('dealer')
  const { aura, auraSkin } = auraWithSkin(detail)
  await render({ ...detail, avatar: [...detail.avatar, auraSkin] })

  const rows = [...container.querySelectorAll('section[aria-label="아바타"] tbody tr')]
  expect(rows.map((row) => row.querySelector('td')?.textContent)).toEqual([
    '모자',
    '머리',
    '얼굴',
    '상의',
    '하의',
    '신발',
    '목가슴',
    '허리',
    '스킨',
    '오라',
    '무기'
  ])
  const auraCell = rows[9]!.querySelectorAll('td')[1]!
  const icons = [...auraCell.querySelectorAll('img')]
  expect(icons.map((icon) => icon.getAttribute('src'))).toEqual([
    itemIconUrl(aura.itemId!),
    itemIconUrl(auraSkin.itemId)
  ])
  expect(hasTone(icons[1], raritySolid.unknown)).toBe(true)
  const skinName = auraCell.querySelector('span[title]')
  expect(skinName?.textContent).toBe(auraSkin.itemName)
  expect(skinName?.getAttribute('title')).toBe(auraSkin.itemName)
  const cloneClasses = stylex.props(avatarStyles.clone).className?.split(' ') ?? []
  expect(cloneClasses.length).toBeGreaterThan(0)
  expect(cloneClasses.every((name) => skinName?.classList.contains(name))).toBe(true)
})

it('오라가 없으면 오라 스킨을 별도 행으로 보인다', async () => {
  const detail = characterDetailFixture('dealer')
  const { auraSkin } = auraWithSkin(detail)
  await render({
    ...detail,
    avatar: [...detail.avatar.filter((avatar) => avatar.slotId !== 'AURORA'), auraSkin]
  })

  const rows = [...container.querySelectorAll('section[aria-label="아바타"] tbody tr')]
  expect(rows.at(-1)?.querySelector('td')?.textContent).toBe('오라 스킨')
  expect(rows.at(-1)?.querySelector('b')?.textContent).toBe(auraSkin.itemName)
  expect(rows.at(-1)?.querySelector('img')?.getAttribute('src')).toBe(itemIconUrl(auraSkin.itemId))
})

it('오라에 클론이 있으면 오라 스킨 대신 클론을 보인다', async () => {
  const detail = characterDetailFixture('dealer')
  const { aura, auraSkin } = auraWithSkin(detail)
  const clone = { itemId: '9d2ba5dfe1f49c5a5e31dd0d6665d1de', itemName: '오라 클론' }
  await render({
    ...detail,
    avatar: [
      ...detail.avatar.map((avatar) => (avatar === aura ? { ...avatar, clone } : avatar)),
      auraSkin
    ]
  })

  const rows = [...container.querySelectorAll('section[aria-label="아바타"] tbody tr')]
  expect(rows.some((row) => row.querySelector('td')?.textContent === '오라 스킨')).toBe(false)
  const auraCell = rows[9]!.querySelectorAll('td')[1]!
  expect(auraCell.querySelectorAll('img')[1]?.getAttribute('src')).toBe(itemIconUrl(clone.itemId))
  expect(auraCell.querySelector('span[title]')?.getAttribute('title')).toBe(clone.itemName)
  expect(auraCell.textContent).not.toContain(auraSkin.itemName)
})

it('크리쳐 행 아래에 아티팩트 3개를 슬롯 색 점과 등급 색 이름으로 보인다', async () => {
  await render(characterDetailFixture('dealer'))

  const rows = [...container.querySelectorAll('section[aria-label="크리쳐"] tbody tr')]
  expect(
    rows.map((row) => [...row.querySelectorAll('td')].map((cell) => cell.textContent))
  ).toEqual([
    ['크리쳐', '운명을 담는 재단사'],
    ['아티팩트', '[이벤트]타오르는 황혼의 공명'],
    ['아티팩트', '기민한 적룡의 날개'],
    ['아티팩트', '빛을 머금은 이슬']
  ])
  const dots = rows.map((row) => row.querySelector('td:first-child [aria-hidden="true"]'))
  expect(dots[0]).toBeNull()
  expect(hasTone(dots[1], dotTones.red)).toBe(true)
  expect(hasTone(dots[2], dotTones.blue)).toBe(true)
  expect(hasTone(dots[3], dotTones.green)).toBe(true)
  const names = rows.map((row) => row.querySelector('b'))
  expect(hasTone(names[1], rarityTones.unique)).toBe(true)
  expect(hasTone(names[2], rarityTones.rare)).toBe(true)
})

it('클론이 아닌 아바타는 클론 이름을 두지 않고, 응답에 없는 아바타와 크리쳐는 그 칸을 생략한다', async () => {
  const detail = characterDetailFixture('buffer')
  const [headgear] = detail.avatar
  await render({
    ...detail,
    avatar: [{ ...headgear!, clone: { itemId: null, itemName: null }, emblems: [] }],
    creature: null
  })

  const [row] = container.querySelectorAll('section[aria-label="아바타"] tbody tr')
  expect(cellTexts(row!)).toEqual(['모자', '레어 모자 클론 아바타', '정신력 55 증가', ''])
  expect(container.querySelector('section[aria-label="크리쳐"]')).toBeNull()

  await render({ ...detail, avatar: [] })
  expect(container.querySelector('section[aria-label="아바타"]')).toBeNull()
})
