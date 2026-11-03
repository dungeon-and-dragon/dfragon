// @vitest-environment jsdom
import { colors } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ServerSelect } from '../../components/ServerSelect'
import type { SnapshotMark } from '@dfragon/client-core/lib/adventure-snapshot'
import { RAID_SEAT_LAYOUT } from '@dfragon/client-core/constants/cards'
import { createSeatOrder, swapSeats } from '@dfragon/client-core/lib/seats'
import type { SlotNotice } from '@dfragon/client-core/lib/character-card'
import { dealerCard } from '@dfragon/client-core/testing/fixtures/character-cards'
import type { CardCharacter, SlotState } from '@dfragon/client-core/types/cards'
import { RaidPage } from './RaidPage'

vi.mock('../../components/ServerSelect', () => ({
  ServerSelect: ({ value, onValueChange, label, options }: ComponentProps<typeof ServerSelect>) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">서버 선택</option>
      {options.map(({ id, label }) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  )
}))

// StyleX의 atomic class 이름은 속성과 값에서 정해지므로, 같은 선언을 여기서 만들면 같은 class가 나온다.
// jsdom은 색을 계산하지 않으므로 자리 배지가 파티 색의 옅은 면과 글자를 쓰는지 class로 확인한다.
const expectedPartyFill = stylex.create({
  red: { backgroundColor: colors.raidPartyRedWeak, color: colors.raidPartyRed },
  yellow: { backgroundColor: colors.raidPartyYellowWeak, color: colors.raidPartyYellow },
  green: { backgroundColor: colors.raidPartyGreenWeak, color: colors.raidPartyGreen }
})

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
  container.remove()
  vi.unstubAllGlobals()
})

const member: CardCharacter = {
  name: '공대원',
  adventure: '공대모험단',
  guild: '공대길드',
  job: '공대직업',
  serverId: 'cain',
  fame: 120000,
  card: { ...dealerCard, role: null }
}
const idle: SlotState[] = Array.from({ length: 12 }, () => 'idle')

type RenderProps = Partial<Omit<ComponentProps<typeof RaidPage>, 'slots' | 'seats' | 'actions'>> &
  Partial<ComponentProps<typeof RaidPage>['seats']> &
  Partial<ComponentProps<typeof RaidPage>['actions']> & {
    slots?: SlotState[]
    characters?: (CardCharacter | null)[]
    slotNotices?: (SlotNotice | undefined)[]
    snapshotMarks?: (SnapshotMark | undefined)[]
    snapshotAdventureInputs?: (string | undefined)[]
  }

async function render({
  slots: states,
  characters = [],
  slotNotices,
  snapshotMarks,
  snapshotAdventureInputs,
  seatOrder = createSeatOrder(RAID_SEAT_LAYOUT),
  canMoveSeats = true,
  swapSeats: swap = vi.fn(() => true),
  lookupSlot = vi.fn(),
  changeSnapshotAdventure = vi.fn(),
  ...props
}: RenderProps = {}): Promise<void> {
  const slots = (states ?? idle).map((state, index) => {
    const shownState: SlotState = states === undefined && characters[index] ? 'success' : state
    const character = characters[index] ?? undefined

    return {
      state: shownState,
      character,
      notice: slotNotices?.[index],
      snapshotMark: snapshotMarks?.[index],
      snapshotAdventureInput: snapshotAdventureInputs?.[index]
    }
  })
  await act(async () =>
    root.render(
      <RaidPage
        resetKey="raid"
        {...props}
        seats={{ layout: RAID_SEAT_LAYOUT, seatOrder, canMoveSeats, swapSeats: swap }}
        actions={{ lookupSlot, changeSnapshotAdventure }}
        slots={slots}
      />
    )
  )
}

function seats(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('[aria-label*="번 자리"]')]
}

function nameOf(seat: HTMLElement): string | undefined {
  return seat.querySelector<HTMLInputElement>('input')?.value
}

async function enterName(seat: HTMLElement, value: string): Promise<HTMLInputElement> {
  const input = seat.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  return input
}

async function pressAlt(target: HTMLElement, key: string, altKey = true): Promise<void> {
  await act(async () =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key, altKey, bubbles: true }))
  )
}

const SEAT_DRAG_TYPE = 'application/x-dfragon-seat'

// jsdom에는 DragEvent가 없어 React가 읽는 dataTransfer만 붙인 이벤트로 드래그를 흉내 낸다. 기본은 자리 드래그
// 형식이 담긴 드래그다.
async function drag(
  type: string,
  target: HTMLElement,
  types: string[] = [SEAT_DRAG_TYPE]
): Promise<{ event: Event; setData: () => void }> {
  const dataTransfer = { types, setData: vi.fn(), effectAllowed: '', dropEffect: '' }
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  await act(async () => target.dispatchEvent(event))

  return { event, setData: dataTransfer.setData }
}

function moveNotices(): (string | null)[] {
  return [...container.querySelectorAll('section > [role="status"]')].map(
    (region) => region.textContent
  )
}

function classesOf(style: stylex.StyleXStyles): string[] {
  return (stylex.props(style).className ?? '').split(' ').filter(Boolean)
}

it('R, Y, G 파티마다 파티 헤더 행에 파티 배지와 찾은 수를 두고 그 아래 네 자리 행을 놓는다', async () => {
  await render({ characters: [member, member, null, null, member] })

  const rows = [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')]
  const headers = rows.filter((row) => !row.hasAttribute('aria-label'))
  expect(headers.map((row) => row.textContent)).toEqual(['R 파티2/4', 'Y 파티1/4', 'G 파티0/4'])
  expect(rows.map((row) => rows.indexOf(row) % 5 === 0)).toEqual(
    rows.map((row) => headers.includes(row))
  )
  expect(seats().map((seat) => seat.getAttribute('aria-label'))).toEqual(
    Array.from({ length: 12 }, (_, index) => `${index + 1}번 자리, 끌어서 옮기기`)
  )
  const describedBy = (seat: HTMLElement): string | undefined =>
    seat
      .getAttribute('aria-describedby')
      ?.split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .join(', ')
  expect(describedBy(seats()[0])).toBe('R 파티2/4, Alt와 방향키로 위, 아래 자리와 맞바꿉니다.')
  expect(describedBy(seats()[4])?.startsWith('Y 파티')).toBe(true)
  expect(describedBy(seats()[11])?.startsWith('G 파티')).toBe(true)
  expect(seats()[0].getAttribute('aria-keyshortcuts')).toBe('Alt+ArrowUp Alt+ArrowDown')
})

it('자리 배지는 R, Y, G와 파티 안 순번을 그 파티 색의 옅은 면과 글자로 보인다', async () => {
  await render()
  const badges = seats().map((seat) => seat.cells[0].firstElementChild!)

  expect(badges.map((badge) => badge.textContent)).toEqual([
    'R1',
    'R2',
    'R3',
    'R4',
    'Y1',
    'Y2',
    'Y3',
    'Y4',
    'G1',
    'G2',
    'G3',
    'G4'
  ])
  const fills = [
    [0, expectedPartyFill.red],
    [4, expectedPartyFill.yellow],
    [11, expectedPartyFill.green]
  ] as const
  for (const [index, fill] of fills) {
    expect([...badges[index].classList]).toEqual(expect.arrayContaining(classesOf(fill)))
  }
})

it('맞바꾼 뒤 파티 헤더 행의 찾은 수는 지금 그 파티 자리에 놓인 행으로 센다', async () => {
  await render({
    characters: [member],
    seatOrder: swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 0, 4)
  })

  const headers = [...container.querySelectorAll('tbody tr:not([aria-label])')]
  expect(headers.map((header) => header.textContent)).toEqual([
    'R 파티0/4',
    'Y 파티1/4',
    'G 파티0/4'
  ])
})

it('공대의 추정 선택은 이름 옆 추정 배지와 모험단 뒤 경고색 안내를 두고 명성과 점수는 그대로 보인다', async () => {
  const notices: (SlotNotice | undefined)[] = Array(12).fill(undefined)
  notices[1] = { text: '명성으로 추정한 후보입니다.', tone: 'estimate' }
  await render({ characters: [member, member], slotNotices: notices })

  const [plain, estimated] = seats()
  expect(plain.textContent).not.toContain('추정')
  expect(estimated.cells[1].textContent).toContain('추정')
  expect(estimated.cells[3].colSpan).toBe(3)
  expect(estimated.cells[3].textContent).toBe('공대모험단!명성으로 추정한 후보입니다.')
  expect(estimated.cells[4].textContent).toBe('120,000')
})

it('스냅샷 순번 배지는 공대 자리를 파티와 파티 안 순번으로 보인다', async () => {
  await render({
    characters: [member, member, member],
    snapshotMarks: [
      { kind: 'kept', seat: 1 },
      { kind: 'moved', seat: 5 },
      { kind: 'moved', seat: 12 },
      ...Array(9).fill(undefined)
    ]
  })

  const badges = seats()
    .slice(0, 3)
    .map((seat) => seat.querySelector('[aria-label^="스냅샷 순번"]')!)
  expect(badges.map((badge) => [badge.getAttribute('aria-label'), badge.textContent])).toEqual([
    ['스냅샷 순번 1-1', '1-1'],
    ['스냅샷 순번 2-1, 자리 바뀜', '2-1'],
    ['스냅샷 순번 3-4, 자리 바뀜', '3-4']
  ])
})

it('자리 배치대로 슬롯을 그리고 조회는 그 자리에 놓인 검색 슬롯 번호로 알린다', async () => {
  const lookup = vi.fn()
  const seatOrder = swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 0, 5)
  await render({
    characters: [member],
    seatOrder,
    lookupSlot: lookup
  })

  expect(nameOf(seats()[5])).toBe('공대원')
  expect(seats()[5].textContent).toContain('Y2')
  expect(nameOf(seats()[0])).toBe('')
  const firstSeat = seats()[0]
  const input = await enterName(firstSeat, '첫자리')
  const select = firstSeat.querySelector('select')!
  await act(async () => {
    select.value = 'siroco'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(lookup).toHaveBeenCalledExactlyOnceWith(5, '첫자리', 'siroco')
  await enterName(firstSeat, '다시조회')
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookup).toHaveBeenLastCalledWith(5, '다시조회', undefined)
})

it('맞바꾸면 행이 입력 중인 이름과 함께 다른 파티의 자리로 옮겨 간다', async () => {
  await render({ characters: [member] })
  await enterName(seats()[3], '넷째초안')

  await render({
    characters: [member],
    seatOrder: swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 3, 4)
  })

  expect(nameOf(seats()[4])).toBe('넷째초안')
  expect(seats()[4].querySelector('[aria-label="5번 캐릭터 이름"]')).not.toBeNull()
  expect(nameOf(seats()[3])).toBe('')
})

it('행에 포커스한 채 Alt와 위, 아래 방향키로 이웃 자리와 맞바꾸고 옮긴 행에 포커스를 되돌린다', async () => {
  const swap = vi.fn(() => true)
  await render({ characters: [member], swapSeats: swap })
  const first = seats()[0]
  await act(async () => first.focus())

  await pressAlt(first, 'ArrowDown')
  expect(swap).toHaveBeenCalledExactlyOnceWith(0, 1)
  expect(container.querySelector('section > [role="status"]')?.textContent).toBe(
    '1번 자리와 2번 자리를 맞바꿨습니다.'
  )
  // Chromium은 React가 옮긴 행 노드의 포커스를 잃지만 jsdom은 그대로 두므로, 다시 그리기 전에 잃은 상태를 만든다.
  await act(async () => first.blur())
  await render({
    characters: [member],
    swapSeats: swap,
    seatOrder: swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 0, 1)
  })
  expect(document.activeElement).toBe(seats()[1])
  expect(nameOf(seats()[1])).toBe('공대원')

  await pressAlt(seats()[3], 'ArrowDown')
  expect(swap).toHaveBeenLastCalledWith(3, 4)
  swap.mockClear()
  await pressAlt(seats()[0], 'ArrowUp')
  await pressAlt(seats()[5], 'ArrowLeft')
  await pressAlt(seats()[5], 'ArrowRight')
  await pressAlt(seats()[11], 'ArrowDown')
  await pressAlt(seats()[2], 'ArrowDown', false)
  await pressAlt(seats()[2].querySelector('input')!, 'ArrowDown')
  expect(swap).not.toHaveBeenCalled()
})

it('행을 다른 행에 드래그해 놓으면 두 자리를 맞바꾸고 이름 칸 글자를 드래그하는 동작은 자리를 옮기지 않는다', async () => {
  const swap = vi.fn(() => true)
  await render({ characters: [member], swapSeats: swap })

  const start = await drag('dragstart', seats()[1])
  expect(start.setData).toHaveBeenCalledWith(SEAT_DRAG_TYPE, '2')
  await drag('dragover', seats()[4])
  expect(seats()[4].className).not.toBe(seats()[3].className)
  await drag('drop', seats()[4])
  expect(swap).toHaveBeenCalledExactlyOnceWith(1, 4)
  expect(seats()[4].className).toBe(seats()[3].className)

  swap.mockClear()
  await drag('dragstart', seats()[2].querySelector('input')!)
  await drag('dragover', seats()[6])
  await drag('drop', seats()[6])
  expect(swap).not.toHaveBeenCalled()
})

it('맞바꿀 수 없는 동안은 드래그와 Alt 방향키를 받지 않고 자리 이름에서 옮기기 안내를 뺀다', async () => {
  const swap = vi.fn(() => true)
  await render({ characters: [member], swapSeats: swap, canMoveSeats: false })

  const first = seats()[0]
  expect(first.getAttribute('aria-label')).toBe('1번 자리')
  expect(first.getAttribute('draggable')).toBe('false')
  expect(first.getAttribute('aria-keyshortcuts')).toBeNull()
  await pressAlt(first, 'ArrowDown')
  await drag('dragstart', seats()[1])
  await drag('dragover', seats()[4])
  await drag('drop', seats()[4])
  expect(swap).not.toHaveBeenCalled()
})

it('드래그하던 행이 회차나 배치 변경으로 다시 그려지면 dragend 없이도 드래그를 끝내고 흐린 표시와 놓기를 거둔다', async () => {
  const swap = vi.fn(() => true)
  const idleClass = (): string => seats()[2].className
  await render({ characters: [member], swapSeats: swap })

  await drag('dragstart', seats()[1])
  expect(seats()[1].className).not.toBe(idleClass())
  await render({ characters: [member], swapSeats: swap, resetKey: 'next-round' })
  expect(seats()[1].className).toBe(idleClass())
  await drag('dragover', seats()[4])
  await drag('drop', seats()[4])
  expect(swap).not.toHaveBeenCalled()

  await drag('dragstart', seats()[1])
  await render({
    characters: [member],
    swapSeats: swap,
    resetKey: 'next-round',
    seatOrder: swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 6, 7)
  })
  expect(seats()[1].className).toBe(idleClass())
  await drag('drop', seats()[4])
  expect(swap).not.toHaveBeenCalled()
})

it('드래그하는 동안 맞바꿀 수 없게 되면 드래그를 끝내 다시 맞바꿀 수 있게 돼도 그 드래그로는 놓지 않는다', async () => {
  const swap = vi.fn(() => true)
  await render({ characters: [member], swapSeats: swap })

  await drag('dragstart', seats()[1])
  await render({ characters: [member], swapSeats: swap, canMoveSeats: false })
  await render({ characters: [member], swapSeats: swap })
  await drag('dragover', seats()[4])
  await drag('drop', seats()[4])
  expect(swap).not.toHaveBeenCalled()
})

it('자리 드래그 형식이 없는 드래그는 자리 드래그 중이어도 드롭 대상으로 받지 않는다', async () => {
  const swap = vi.fn(() => true)
  await render({ characters: [member], swapSeats: swap })

  await drag('dragstart', seats()[1])
  const over = await drag('dragover', seats()[4], ['text/plain'])
  const drop = await drag('drop', seats()[4], ['text/plain'])
  expect(over.event.defaultPrevented).toBe(false)
  expect(drop.event.defaultPrevented).toBe(false)
  expect(swap).not.toHaveBeenCalled()
})

it('맞바꾸기를 거절하면 알리지 않고, 다음 배치 변경에서 그 행으로 포커스를 가져가지 않는다', async () => {
  const swap = vi.fn(() => false)
  await render({ characters: [member], swapSeats: swap })
  await act(async () => seats()[0].focus())

  await pressAlt(seats()[0], 'ArrowDown')
  expect(swap).toHaveBeenCalledExactlyOnceWith(0, 1)
  expect(moveNotices()).toEqual(['', ''])

  const outsideButton = document.createElement('button')
  container.after(outsideButton)
  try {
    await act(async () => outsideButton.focus())
    await render({
      characters: [member],
      swapSeats: swap,
      seatOrder: swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 0, 1)
    })
    expect(document.activeElement).toBe(outsideButton)
  } finally {
    outsideButton.remove()
  }
})

it('같은 두 자리를 연달아 맞바꿔도 알림 영역을 번갈아 채워 다시 읽히게 한다', async () => {
  await render({ characters: [member] })
  const text = '1번 자리와 2번 자리를 맞바꿨습니다.'

  await pressAlt(seats()[0], 'ArrowDown')
  const first = moveNotices()
  expect(first.filter((notice) => notice === text)).toHaveLength(1)
  expect(first.filter((notice) => notice === '')).toHaveLength(1)
  await pressAlt(seats()[0], 'ArrowDown')
  const second = moveNotices()
  expect(second.filter((notice) => notice === text)).toHaveLength(1)
  expect(second.indexOf(text)).not.toBe(first.indexOf(text))
})

it('스냅샷 모험단 입력은 그 슬롯이 놓인 자리 행에 열리고 바꾼 값을 자리 번호로 알린다', async () => {
  const change = vi.fn()
  const seatOrder = swapSeats(createSeatOrder(RAID_SEAT_LAYOUT), 0, 5)
  await render({
    slots: idle.with(5, 'failure'),
    slotNotices: idle.map((_, slot) =>
      slot === 5 ? { text: '캐릭터를 찾지 못함', tone: 'failure' } : undefined
    ),
    snapshotAdventureInputs: idle.map((_, slot) => (slot === 5 ? '' : undefined)),
    seatOrder,
    changeSnapshotAdventure: change
  })

  expect(container.querySelectorAll('input[aria-label$="번 모험단"]')).toHaveLength(1)
  const field = seats()[0].querySelector<HTMLInputElement>('input[aria-label="1번 모험단"]')!
  expect(field.title).toBe('캐릭터를 찾지 못함')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '별빛')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(change).toHaveBeenCalledExactlyOnceWith(0, '별빛')
})
