// @vitest-environment jsdom
import * as stylex from '@stylexjs/stylex'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import { characterDetailFixture } from '@dfragon/client-core/testing/fixtures/character-detail'
import { styles as rarityTones } from './avatar/ItemName.style'
import { BuffTab } from './BuffTab'

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

async function render(detail: CharacterDetailView): Promise<void> {
  await act(async () => root.render(<BuffTab detail={detail} />))
}

function section(label: string): Element | null {
  return container.querySelector(`section[aria-label="${label}"]`)
}

it('버퍼 버프 스킬은 이름, 레벨과 desc의 {valueN} 자리에 values를 채운 줄을 보인다', async () => {
  await render(characterDetailFixture('buffer'))

  const skill = section('버프 스킬')!
  expect(skill.querySelector('h2')?.textContent).toBe('러블리 템포')
  expect(skill.querySelector('h2 + span')?.textContent).toBe('Lv.30')
  expect([...skill.querySelectorAll('li')].map((line) => line.textContent)).toEqual([
    '지속 시간 : 300초',
    '적중률 증가 : 40.6%',
    '[뮤즈 전용 효과]',
    '기본 공격 및 스킬 공격력 증가율 : 70%',
    '[파티원 전용 효과]',
    '힘 증가 : 488',
    '지능 증가 : 488',
    '물리 공격력 증가 : 92',
    '마법 공격력 증가 : 92',
    '독립 공격력 증가 : 92',
    '[범위 정보]',
    '버프 적용 범위 : 900px'
  ])
})

it('버퍼 버프 강화 장비는 부위와 등급 색 이름을, 아바타는 부위와 옵션을 보인다', async () => {
  await render(characterDetailFixture('buffer'))

  const [row] = section('버프 강화 장비')!.querySelectorAll('tr')
  const [slot, item] = row!.querySelectorAll('td')
  expect(slot?.textContent).toBe('칭호')
  expect(item?.textContent).toBe('모험가의 의지[빛]')
  const { className } = stylex.props(rarityTones.rare)
  expect(item?.querySelector('span')?.className.split(' ')).toContain(className)
  const avatarRows = [...section('버프 강화 아바타')!.querySelectorAll('tbody tr')]
  expect(avatarRows.map((avatar) => avatar.querySelector('td')?.textContent)).toEqual(['상의'])
  expect(avatarRows[0]?.textContent).toContain('러블리 템포 스킬Lv +1')
  expect(section('버프 강화 크리쳐')).toBeNull()
})

it('딜러처럼 버프 강화 장비가 없으면 장비 칸을 생략하고 크리쳐 이름을 보인다', async () => {
  await render(characterDetailFixture('dealer'))

  expect(section('버프 강화 장비')).toBeNull()
  expect(section('버프 스킬')?.querySelector('li')?.textContent).toBe('지속 시간 : -초')
  expect(section('버프 강화 크리쳐')?.querySelector('li')?.textContent).toBe('2026 쁘띠 발키리')
})

it('버프 강화 응답이 없으면 스킬 줄과 장착 목록을 모두 생략한다', async () => {
  const detail = characterDetailFixture('buffer')
  await render({ ...detail, buff: { equipment: null, avatar: null, creature: null } })

  expect(container.querySelectorAll('section')).toHaveLength(0)
})
