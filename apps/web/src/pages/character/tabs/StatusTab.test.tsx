// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { characterDetailFixture } from '#core/testing/character-detail'
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

it('딜러 스탯은 응답의 79개를 응답 순서대로 이름과 값으로 보인다', async () => {
  const detail = characterDetailFixture('dealer')
  await render(detail)

  const shown = stats()
  expect(shown).toHaveLength(79)
  expect(shown.map((stat) => stat.name)).toEqual(detail.status.status.map((stat) => stat.name))
  expect(shown.slice(0, 3)).toEqual([
    { name: 'HP', value: '176,036', icon: false },
    { name: 'MP', value: '117,334', icon: false },
    { name: '물리 방어율', value: '40.1', icon: false }
  ])
  expect(shown.find((stat) => stat.name === '최종 데미지 증가')?.value).toBe('122,134,200')
})

it('속성 강화 네 개만 이름 왼쪽에 아이콘 자리를 두고 값은 다른 스탯과 같은 class로 보인다', async () => {
  await render(characterDetailFixture('dealer'))

  expect(stats().filter((stat) => stat.icon)).toEqual([
    { name: '화속성 강화', value: '306', icon: true },
    { name: '수속성 강화', value: '281', icon: true },
    { name: '명속성 강화', value: '306', icon: true },
    { name: '암속성 강화', value: '246', icon: true }
  ])
  const valueClasses = new Set(
    [...container.querySelectorAll('dl dd')].map((value) => value.className)
  )
  expect(valueClasses.size).toBe(1)
})

it('적용 중인 버프는 이름, 있으면 레벨, 수치를 보인다', async () => {
  await render(characterDetailFixture('buffer'))

  const buffs = [...container.querySelectorAll('section[aria-label="적용 중인 버프"] li')]
  expect(buffs.map((buff) => [...buff.children].map((part) => part.textContent))).toEqual([
    ['모험단 버프', 'Lv.41', '힘 290, 지능 290, 체력 290, 정신력 290'],
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
