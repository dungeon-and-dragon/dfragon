// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CandidatePicker } from '@dfragon/client-core/lib/candidate-picker'
import type { CharacterChoice } from '@dfragon/client-core/preload/common/types/search'
import { CandidatePopover } from './CandidatePopover'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

function choice(
  serverId: string,
  serverName: string,
  fame: number | null,
  adventureName: string | null = null
): CharacterChoice {
  return {
    characterId: `synthetic-${serverId}`,
    characterName: '같은이름',
    serverId,
    serverName,
    fame,
    adventureName
  }
}

const picker: CandidatePicker = {
  choices: [
    choice('bakal', '바칼', 142977, '흰늑대'),
    choice('cain', '카인', 131204),
    choice('casillas', '카시야스', null)
  ],
  shownServerId: 'cain',
  picking: null
}

async function render(onPick = vi.fn()): Promise<HTMLButtonElement> {
  await act(async () => root.render(<CandidatePopover slot={2} picker={picker} onPick={onPick} />))

  return container.querySelector<HTMLButtonElement>('[aria-label="2번 후보 고르기, 후보 3"]')!
}

async function open(chip: HTMLButtonElement): Promise<HTMLElement> {
  await act(async () => chip.click())

  return vi.waitFor(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.getAttribute('aria-label')).toBe('2번 후보 고르기')

    return dialog!
  })
}

function tiles(dialog: HTMLElement): HTMLButtonElement[] {
  return [...dialog.querySelectorAll('button')]
}

it('후보 N 칩을 누르면 타일만 있는 창을 열고 지금 후보를 눌린 타일로 둔다', async () => {
  const chip = await render()
  expect(chip.textContent).toBe('후보 3')
  expect(chip.getAttribute('aria-expanded')).toBe('false')

  const dialog = await open(chip)

  expect(chip.getAttribute('aria-expanded')).toBe('true')
  expect(container.contains(dialog)).toBe(false)
  expect(tiles(dialog).map((tile) => tile.getAttribute('aria-label'))).toEqual([
    '바칼, 명성 142,977, 모험단 흰늑대',
    '카인, 명성 131,204, 지금 행에 보이는 후보',
    '카시야스, 명성 -'
  ])
  expect(tiles(dialog).map((tile) => tile.getAttribute('aria-pressed'))).toEqual([
    'false',
    'true',
    'false'
  ])
  expect(dialog.textContent).not.toContain('흰늑대')
  await vi.waitFor(() => expect(document.activeElement).toBe(tiles(dialog)[1]))
})

it('타일을 한 번 누르면 그 서버를 알리고 창을 닫는다', async () => {
  const onPick = vi.fn()
  const chip = await render(onPick)
  const dialog = await open(chip)

  await act(async () => tiles(dialog)[0].click())

  expect(onPick).toHaveBeenCalledExactlyOnceWith('bakal')
  await vi.waitFor(() => expect(chip.getAttribute('aria-expanded')).toBe('false'))
})

it.each([
  {
    name: 'Esc',
    close: (dialog: HTMLElement) =>
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  },
  {
    name: '바깥 클릭',
    close: () => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
  },
  { name: '칩 재클릭', close: (_: HTMLElement, chip: HTMLButtonElement) => chip.click() }
])('$name은 후보를 고르지 않고 창을 닫는다', async ({ close }) => {
  const onPick = vi.fn()
  const chip = await render(onPick)
  const dialog = await open(chip)

  await act(async () => close(dialog, chip))

  await vi.waitFor(() => expect(chip.getAttribute('aria-expanded')).toBe('false'))
  expect(onPick).not.toHaveBeenCalled()
})

it('방향키는 타일 사이에서 포커스를 옮기고 끝에서 처음으로 돌아간다', async () => {
  const chip = await render()
  const dialog = await open(chip)
  const [first, shown, last] = tiles(dialog)
  await vi.waitFor(() => expect(document.activeElement).toBe(shown))

  const press = async (target: HTMLElement, key: string): Promise<void> =>
    act(async () => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })

  await press(shown, 'ArrowRight')
  expect(document.activeElement).toBe(last)
  await press(last, 'ArrowDown')
  expect(document.activeElement).toBe(first)
  await press(first, 'ArrowLeft')
  expect(document.activeElement).toBe(last)
})
