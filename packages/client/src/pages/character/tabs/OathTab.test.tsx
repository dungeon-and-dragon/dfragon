// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import { characterDetailFixture } from '@dfragon/client-core/testing/fixtures/character-detail'
import { OathTab } from './OathTab'

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
  await act(async () => root.render(<OathTab detail={detail} />))
}

function section(name: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`section[aria-label="${name}"]`)

  if (found === null) {
    throw new Error(`${name} 영역이 없다`)
  }

  return found
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
  expect(crystals[0]).toEqual(['1', '용투 : 완전한 광휘 결정III', '195pt'])
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
