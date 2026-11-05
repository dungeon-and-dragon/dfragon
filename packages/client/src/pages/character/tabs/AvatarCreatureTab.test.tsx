// @vitest-environment jsdom
import * as stylex from '@stylexjs/stylex'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { characterDetailFixture } from '@dfragon/client-core/testing/fixtures/character-detail'
import { styles as dotTones } from './avatar/CreatureArtifacts.style'
import { styles as rarityTones } from './shared/ItemName.style'
import { AvatarCreatureTab } from './AvatarCreatureTab'

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

// 이름 칸은 등급 색 이름과 클론 이름처럼 span 여럿을 줄로 쌓으므로 span마다 |로 나눠 읽는다.
function cellTexts(row: Element): string[] {
  return [...row.querySelectorAll('td')].map((cell) => {
    const lines = [...cell.querySelectorAll('span')].map((span) => span.textContent)
    if (lines.length === 0) {
      return cell.textContent
    }

    return lines.join('|')
  })
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
  expect(hasTone(avatarCell?.querySelector('div > span'), rarityTones.rare)).toBe(true)
  expect(hasTone(emblemCell?.querySelector('div > span'), rarityTones.unique)).toBe(true)
})

it('크리쳐 이름 아래에 아티팩트 3개를 슬롯 색 점과 등급 색 이름으로 보인다', async () => {
  await render(characterDetailFixture('dealer'))

  const creature = container.querySelector('section[aria-label="크리쳐"]')!
  expect(creature.querySelector('h2 ~ div > span')?.textContent).toBe('운명을 담는 재단사')
  const artifacts = [...creature.querySelectorAll('li')]
  expect(artifacts.map((artifact) => artifact.textContent)).toEqual([
    '[이벤트]타오르는 황혼의 공명',
    '기민한 적룡의 날개',
    '빛을 머금은 이슬'
  ])
  const dots = artifacts.map((artifact) => artifact.querySelector('[aria-hidden="true"]'))
  expect(hasTone(dots[0], dotTones.red)).toBe(true)
  expect(hasTone(dots[1], dotTones.blue)).toBe(true)
  expect(hasTone(dots[2], dotTones.green)).toBe(true)
  const names = artifacts.map((artifact) => artifact.querySelector('span:not([aria-hidden])'))
  expect(hasTone(names[0], rarityTones.unique)).toBe(true)
  expect(hasTone(names[1], rarityTones.rare)).toBe(true)
})

it('클론이 아닌 아바타는 클론 줄을 두지 않고, 응답에 없는 아바타와 크리쳐는 그 칸을 생략한다', async () => {
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
