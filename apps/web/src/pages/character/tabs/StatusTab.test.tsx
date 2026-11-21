// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '#entities/character'
import { characterDetailFixture } from '#entities/character/api/character-detail.fixture'
import { StatusTab } from './StatusTab'

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
  await act(async () => root.render(<StatusTab detail={detail} />))
}

function stats(): { name: string; value: string; icon: boolean }[] {
  return [...container.querySelectorAll('dl > div')].map((stat) => ({
    name: stat.querySelector('dt')?.textContent ?? '',
    value: stat.querySelector('dd')?.textContent ?? '',
    icon: stat.querySelector('dt > [aria-hidden="true"]') != null
  }))
}

function namesIn(label: string): string[] {
  return [...container.querySelectorAll(`dl[aria-label="${label}"] dt`)].map(
    (name) => name.textContent ?? ''
  )
}

it('딜러 스탯 79개를 힘부터 속성 강화까지의 첫 묶음과, HP, MP, 방어율과 모험가 명성부터의 나머지 묶음으로 나눠 보인다', async () => {
  const detail = characterDetailFixture('dealer')
  await render(detail)

  expect(stats()).toHaveLength(79)
  expect(namesIn('스탯')).toEqual([
    '힘',
    '지능',
    '체력',
    '정신력',
    '물리 공격',
    '마법 공격',
    '물리 크리티컬',
    '마법 크리티컬',
    '독립 공격',
    '공격 속도',
    '캐스팅 속도',
    '이동 속도',
    '화속성 강화',
    '수속성 강화',
    '명속성 강화',
    '암속성 강화'
  ])

  const responseNames = detail.status.status.map(({ name }) => name ?? '')
  const fameIndex = responseNames.indexOf('모험가 명성')
  const afterFame = responseNames.slice(fameIndex).filter((name) => !name.endsWith('속성 강화'))
  expect(namesIn('그 밖의 스탯')).toEqual(['HP', 'MP', '물리 방어율', '마법 방어율', ...afterFame])

  expect(stats().find((stat) => stat.name === '최종 데미지 증가')?.value).toBe('122,134,200')
})

it('기본 스탯, 공격, 크리티컬, 속성 강화마다 가장 높은 스탯의 이름과 값을 굵게 두고, 같은 값은 모두 굵게 둔다', async () => {
  await render(characterDetailFixture('dealer'))

  const emphasized = [...container.querySelectorAll('dl > div')]
    .filter((stat) => stat.querySelector('dd')?.classList.contains('font-semibold'))
    .map((stat) => [
      stat.querySelector('dt')?.textContent,
      stat.querySelector('dt')?.classList.contains('font-semibold')
    ])
  expect(emphasized).toEqual([
    ['힘', true],
    ['물리 공격', true],
    ['물리 크리티컬', true],
    ['화속성 강화', true],
    ['명속성 강화', true]
  ])
})

it('속성 강화도 이름 왼쪽에 빈 자리 없이 보이고 값은 강조하지 않은 다른 스탯과 같은 class로 보인다', async () => {
  await render(characterDetailFixture('dealer'))

  expect(stats().filter((stat) => stat.icon)).toEqual([])
  expect(stats().filter((stat) => stat.name.endsWith('속성 강화'))).toEqual([
    { name: '화속성 강화', value: '306', icon: false },
    { name: '수속성 강화', value: '281', icon: false },
    { name: '명속성 강화', value: '306', icon: false },
    { name: '암속성 강화', value: '246', icon: false }
  ])
  const valueClasses = new Set(
    [...container.querySelectorAll('dl dd')]
      .filter((value) => !value.classList.contains('font-semibold'))
      .map((value) => value.className)
  )
  expect(valueClasses.size).toBe(1)
})

it('적용 중인 버프는 이름, 있으면 레벨, 수치를 보인다', async () => {
  await render(characterDetailFixture('buffer'))

  const buffs = [...container.querySelectorAll('section[aria-label="적용 중인 버프"] li')]
  expect(buffs.map((buff) => [...buff.children].map((part) => part.textContent))).toEqual([
    ['모험단 버프', 'Lv 41', '힘 290, 지능 290, 체력 290, 정신력 290'],
    ['무제한 길드능력치', '힘 60, 지능 60, 체력 60, 정신력 60'],
    ['기간제 길드능력치', '힘 40, 지능 40, 체력 40, 정신력 40']
  ])
})

it('값이 없는 스탯 줄과 비어 있는 버프 목록은 생략한다', async () => {
  const detail = characterDetailFixture('dealer')
  await render({
    ...detail,
    status: {
      status: [
        { name: 'HP', value: null },
        { name: 'MP', value: 1 }
      ],
      buff: []
    }
  })

  expect(stats()).toEqual([{ name: 'MP', value: '1', icon: false }])
  expect(container.querySelector('section[aria-label="적용 중인 버프"]')).toBeNull()
})
