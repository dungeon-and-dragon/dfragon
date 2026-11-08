// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import { characterDetailFixture } from '@dfragon/client-core/testing/fixtures/character-detail'
import { EquipmentTab } from './EquipmentTab'

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
  await act(async () => root.render(<EquipmentTab detail={detail} />))
}

function rowTexts(): string[][] {
  return [...container.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
  )
}

it('딜러 장비 13칸과 크리쳐, 오라 행을 부위, 장비, 강화, 마법부여, 세트 포인트, 정밀도 순으로 그린다', async () => {
  const detail = characterDetailFixture('dealer')
  Object.assign(detail.equipment.equipment[9], {
    tune: [{ level: 2, setPoint: 265 }],
    exaltedInfo: { explain: null },
    potency: { value: 100 }
  })
  await render(detail)

  const rows = rowTexts()
  expect(rows).toHaveLength(15)
  expect(rows[0]).toEqual(['무기', '재앙의 송곳니', '+10', '모든 속성 강화 +15', '-', '-'])
  expect(rows[1].slice(0, 3)).toEqual(['칭호', '프로스트의 전설 플래티넘[35Lv]', '-'])
  expect(rows[9]).toEqual([
    '반지',
    '거룩한 희생의 반지II유일',
    '-',
    '최종 데미지 증가 +1%, 모든 속성 강화 +35',
    '265pt',
    '100%'
  ])
  expect(rows[12].slice(0, 3)).toEqual(['귀걸이', '강인한 절제의 귀걸이', '+8'])
  expect(rows[13]).toEqual(['크리쳐', '운명을 담는 재단사', '-', '', '-', '-'])
  expect(rows[14]).toEqual(['오라', '고결한 영혼의 잔상', '-', '', '-', '-'])
  expect(container.querySelector('tbody img')?.getAttribute('src')).toBe(
    'https://img-api.neople.co.kr/df/items/89c42c1d02e6749244ce518e9b34e1c7'
  )
  expect(container.textContent).toContain('로열 페어리 세트태초2,615pt')
  expect(container.textContent).toContain('안개 융화Lv.100')
})

it('버퍼의 재련과 버프 패시브 스킬 마법부여를 그린다', async () => {
  await render(characterDetailFixture('buffer'))

  const rows = rowTexts()
  expect(rows[0][2]).toBe('재련 8')
  expect(rows[2][3]).toBe('버프 패시브 스킬 +3, 올스탯 +100')
})

it('장비, 세트, 크리쳐, 오라가 모두 없으면 표와 위 한 줄을 그리지 않는다', async () => {
  const detail = characterDetailFixture('dealer')
  await render({
    ...detail,
    equipment: { equipment: [], setItemInfo: [] },
    creature: null,
    avatar: [],
    mistAssimilation: null
  })

  expect(container.querySelector('table')).toBeNull()
  expect(container.textContent).toBe('')
})
