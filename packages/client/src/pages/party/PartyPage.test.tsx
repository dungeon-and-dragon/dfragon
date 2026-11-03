// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PartyPage } from './PartyPage'
import { PARTY_SEAT_LAYOUT } from '@dfragon/client-core/constants/cards'
import type { SnapshotMark } from '@dfragon/client-core/lib/adventure-snapshot'
import { createSeatOrder, swapSeats, type SeatOrder } from '@dfragon/client-core/lib/seats'
import type { CardCharacter, SlotState } from '@dfragon/client-core/types/cards'

const CHARACTER_NAME_INPUT_SELECTOR = 'input[aria-label$="번 캐릭터 이름"]'

function columnText(row: HTMLTableRowElement, label: string): string | null {
  const headers = [...container.querySelectorAll('thead th')]
  const column = headers.findIndex((header) => header.textContent === label)

  const cell = row.cells.item(column)
  if (cell === null) {
    return null
  }

  return cell.textContent
}

function rows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')]
}

let root: Root
let container: HTMLDivElement
const character: CardCharacter = {
  characterId: 'matched-id',
  name: '선택된이름',
  serverId: 'cain',
  adventure: '모험단',
  job: '직업',
  level: 115,
  fame: 0,
  card: null,
  image: 'https://img-api.neople.co.kr/df/servers/cain/characters/matched-id?zoom=1'
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

type RenderProps = Partial<Omit<ComponentProps<typeof PartyPage>, 'slots' | 'seats'>> & {
  slots: SlotState[]
  characters?: (CardCharacter | null)[]
  nicknames?: (string | null)[]
  snapshotMarks?: (SnapshotMark | undefined)[]
  snapshotAdventureInputs?: (string | undefined)[]
  seatOrder?: SeatOrder
  canMoveSeats?: boolean
  swapSeats?: (from: number, to: number) => boolean
}

async function render({
  slots,
  characters,
  nicknames,
  snapshotMarks,
  snapshotAdventureInputs,
  seatOrder = createSeatOrder(PARTY_SEAT_LAYOUT),
  canMoveSeats = true,
  swapSeats: swap = vi.fn(() => true),
  ...props
}: RenderProps): Promise<void> {
  const cards = slots.map((state, index) => {
    const character = characters?.[index] ?? undefined
    const nickname = nicknames?.[index] ?? undefined

    return {
      state,
      character,
      nickname,
      snapshotMark: snapshotMarks?.[index],
      snapshotAdventureInput: snapshotAdventureInputs?.[index]
    }
  })
  await act(async () =>
    root.render(
      <PartyPage
        resetKey="party"
        actions={{ lookupSlot: vi.fn(), changeSnapshotAdventure: vi.fn() }}
        {...props}
        seats={{ layout: PARTY_SEAT_LAYOUT, seatOrder, canMoveSeats, swapSeats: swap }}
        slots={cards}
      />
    )
  )
}

it('비동기 식별 성공은 OCR 첫 이름 대신 선택된 이름과 서버를 표시한다', async () => {
  await render({
    slots: ['pending', 'idle', 'idle', 'idle'],
    nicknames: ['OCR첫후보']
  })
  expect(container.querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    'OCR첫후보'
  )
  await render({
    slots: ['success', 'idle', 'idle', 'idle'],
    characters: [character],
    nicknames: ['OCR첫후보']
  })

  const [row] = rows()
  expect(row.querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    '선택된이름'
  )
  expect(columnText(row, '서버')).toBe('카인')
  expect(columnText(row, '명성')).toBe('0')
  expect(columnText(row, '점수')).toBe('장비-')
  expect(row.querySelector('img')?.getAttribute('src')).toBe(character.image)
})

it('네 슬롯의 서로 다른 선택과 대기 상태를 독립적으로 표시한다', async () => {
  await render({
    slots: ['success', 'success', 'pending', 'idle'],
    characters: [
      character,
      { ...character, characterId: 'another-id', name: '다른이름', fame: null },
      null,
      null
    ],
    nicknames: [null, null, '검색중', null]
  })
  const slots = rows()
  expect(slots[0].querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    '선택된이름'
  )
  expect(slots[1].querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    '다른이름'
  )
  expect(columnText(slots[1], '명성')).toBe('-')
  expect(slots[2].getAttribute('aria-busy')).toBe('true')
  expect(slots[2].querySelector('[role="progressbar"]')?.textContent).toBe('캐릭터 검색 중')
  expect(slots[3].getAttribute('aria-busy')).toBe('false')
  expect(slots[3].querySelector('[role="progressbar"]')).toBeNull()
  expect(slots[2].querySelector('img')).toBeNull()
  expect(slots[3].querySelector('img')).toBeNull()
})

it('슬롯 번호대로 스냅샷 표시를 그 슬롯의 행에 전한다', async () => {
  await render({
    slots: ['success', 'success', 'success', 'idle'],
    characters: [character, character, character],
    snapshotMarks: [{ kind: 'kept', seat: 1 }, { kind: 'moved', seat: 1 }, { kind: 'absent' }]
  })

  expect(
    rows().map((row) =>
      row.querySelector('[role="img"][aria-label^="스냅샷"]')?.getAttribute('aria-label')
    )
  ).toEqual(['스냅샷 순번 1', '스냅샷 순번 1, 자리 바뀜', '스냅샷에 없는 모험단', undefined])
})

function seats(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[aria-label*="번 자리"]')]
}

function nameOf(seat: HTMLElement): string | undefined {
  return seat.querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value
}

async function pressAlt(target: HTMLElement, key: string): Promise<void> {
  await act(async () =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, altKey: true, bubbles: true }))
  )
}

// jsdom에는 DragEvent가 없어 React가 읽는 dataTransfer만 붙인 이벤트로 드래그를 흉내 낸다.
async function drag(type: string, target: HTMLElement, types: string[]): Promise<Event> {
  const dataTransfer = { types, setData: vi.fn(), effectAllowed: '', dropEffect: '' }
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  await act(async () => target.dispatchEvent(event))

  return event
}

it('파티 행을 다른 행에 끌어 놓으면 두 자리를 맞바꾼다', async () => {
  const swap = vi.fn(() => true)
  await render({
    slots: ['success', 'idle', 'idle', 'idle'],
    characters: [character],
    swapSeats: swap
  })
  const [first, , third] = seats()
  expect(first.getAttribute('draggable')).toBe('true')

  await drag('dragstart', first, [])
  await drag('dragover', third, ['application/x-dfragon-seat'])
  await drag('drop', third, ['application/x-dfragon-seat'])

  expect(swap).toHaveBeenCalledExactlyOnceWith(0, 2)
  expect(container.querySelector('section > [role="status"]')?.textContent).toBe(
    '1번 자리와 3번 자리를 맞바꿨습니다.'
  )
})

it('이름 칸을 고치는 동안은 그 파티 행을 끌 수 없다', async () => {
  await render({ slots: ['idle', 'idle', 'idle', 'idle'] })
  const [first, second] = seats()
  const input = first.querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)!

  await act(async () => input.focus())
  expect(first.getAttribute('draggable')).toBe('false')
  expect(second.getAttribute('draggable')).toBe('true')

  await act(async () => input.blur())
  expect(first.getAttribute('draggable')).toBe('true')
})

it('파티 행은 Alt와 위, 아래 방향키로만 위아래 자리와 맞바꾼다', async () => {
  const swap = vi.fn(() => true)
  await render({ slots: ['idle', 'idle', 'idle', 'idle'], swapSeats: swap })
  const hint = document.getElementById(seats()[1].getAttribute('aria-describedby')!)
  expect(hint?.textContent).toBe('Alt와 방향키로 위, 아래 자리와 맞바꿉니다.')
  expect(seats()[1].getAttribute('aria-keyshortcuts')).toBe('Alt+ArrowUp Alt+ArrowDown')

  await pressAlt(seats()[1], 'ArrowLeft')
  await pressAlt(seats()[1], 'ArrowRight')
  await pressAlt(seats()[0], 'ArrowUp')
  await pressAlt(seats()[3], 'ArrowDown')
  expect(swap).not.toHaveBeenCalled()

  await pressAlt(seats()[1], 'ArrowDown')
  expect(swap).toHaveBeenCalledExactlyOnceWith(1, 2)
})

it('자리 배치대로 행을 그리고 조회는 그 자리에 놓인 검색 슬롯 번호로 알린다', async () => {
  const lookupSlot = vi.fn()
  await render({
    slots: ['success', 'idle', 'idle', 'idle'],
    characters: [character],
    seatOrder: swapSeats(createSeatOrder(PARTY_SEAT_LAYOUT), 0, 3),
    actions: { lookupSlot, changeSnapshotAdventure: vi.fn() }
  })

  expect(nameOf(seats()[3])).toBe('선택된이름')
  expect(seats()[3].querySelector('[aria-label="4번 캐릭터 이름"]')).not.toBeNull()
  expect(nameOf(seats()[0])).toBe('')
  const input = seats()[3].querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
      input,
      '옮긴자리'
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookupSlot).toHaveBeenCalledExactlyOnceWith(0, '옮긴자리', undefined)
})

it('스냅샷 모험단 입력은 그 슬롯이 놓인 자리 행에 열리고 바꾼 값을 자리 번호로 알린다', async () => {
  const changeSnapshotAdventure = vi.fn()
  await render({
    slots: ['failure', 'idle', 'idle', 'idle'],
    snapshotAdventureInputs: [''],
    seatOrder: swapSeats(createSeatOrder(PARTY_SEAT_LAYOUT), 0, 3),
    actions: { lookupSlot: vi.fn(), changeSnapshotAdventure }
  })

  const field = seats()[3].querySelector<HTMLInputElement>('input[aria-label="4번 모험단"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '별빛')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(changeSnapshotAdventure).toHaveBeenCalledExactlyOnceWith(3, '별빛')
})

it('맞바꿀 수 없는 동안에는 파티 행을 끌거나 옮길 수 없다', async () => {
  const swap = vi.fn(() => true)
  await render({ slots: ['idle', 'idle', 'idle', 'idle'], canMoveSeats: false, swapSeats: swap })

  expect(seats().map((seat) => seat.getAttribute('aria-label'))).toEqual([
    '1번 자리',
    '2번 자리',
    '3번 자리',
    '4번 자리'
  ])
  expect(seats()[0].getAttribute('draggable')).toBe('false')
  await pressAlt(seats()[0], 'ArrowDown')
  expect(swap).not.toHaveBeenCalled()
})
