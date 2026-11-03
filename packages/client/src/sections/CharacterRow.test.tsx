// @vitest-environment jsdom
import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { bufferCard, dealerCard } from '@dfragon/client-core/testing/fixtures/character-cards'
import type { SlotCard } from '@dfragon/client-core/lib/slot-cards'
import type { CardCharacter } from '@dfragon/client-core/types/cards'
import type { ServerSelect } from '../components/ServerSelect'
import { colors } from '@dfragon/ui/tokens.stylex'
import { toneClassesOf } from '../testing/test-support/score-tone-class'
import { CharacterRow } from './CharacterRow'

vi.mock('../components/ServerSelect', () => ({
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

const found: CardCharacter = {
  name: '찾은이름',
  serverId: 'cain',
  adventure: '찾은모험단',
  guild: '찾은길드',
  job: '眞 웨펀마스터',
  fame: 125850,
  card: dealerCard
}

const COLUMNS = ['자리', '캐릭터', '서버', '모험단', '길드', '직업', '명성', '점수', '스냅샷']

type RenderProps = Partial<SlotCard> &
  Partial<Pick<ComponentProps<typeof CharacterRow>, 'onLookup' | 'onChangeSnapshotAdventure'>> & {
    resetKey?: string
  }

async function render({
  state = 'idle',
  onLookup = vi.fn(),
  onChangeSnapshotAdventure = vi.fn(),
  resetKey = '0',
  ...card
}: RenderProps = {}): Promise<void> {
  await act(async () =>
    root.render(
      <table>
        <tbody>
          <tr>
            <CharacterRow
              key={resetKey}
              cardKey={{ id: 'party-0', resetKey }}
              card={{ state, ...card }}
              slot={1}
              seat="1"
              screen="party"
              onLookup={onLookup}
              onChangeSnapshotAdventure={onChangeSnapshotAdventure}
            />
          </tr>
        </tbody>
      </table>
    )
  )
}

function row(): HTMLTableRowElement {
  return container.querySelector('tr')!
}

function cell(column: string): HTMLTableCellElement | undefined {
  let start = 0
  for (const td of row().cells) {
    if (COLUMNS[start] === column) {
      return td
    }
    start += td.colSpan
  }

  return undefined
}

// jsdom은 색을 계산하지 않으므로 같은 선언에서 나온 atomic class를 요소가 가졌는지로 색을 확인한다.
const expectedColors = stylex.create({
  failure: { color: colors.cardFailure },
  error: { color: colors.fgDanger },
  signalFill: { backgroundColor: colors.signal },
  danger: { color: colors.fgDanger }
})

function hasStyle(element: Element, style: keyof typeof expectedColors): boolean {
  const names = stylex.props(expectedColors[style]).className!.split(' ')

  return names.every((name) => element.classList.contains(name))
}

const srOnlySelector = `.${stylex.props(shapes.srOnly).className!.split(' ').join('.')}`

function visibleText(element: Element): string {
  const copy = element.cloneNode(true) as HTMLElement
  for (const hidden of copy.querySelectorAll(`[aria-hidden="true"], ${srOnlySelector}`)) {
    hidden.remove()
  }

  return copy.textContent!
}

function nameInput(): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!
}

async function enterName(value: string): Promise<HTMLInputElement> {
  const input = nameInput()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  return input
}

async function pressEnter(init: KeyboardEventInit = {}): Promise<void> {
  await act(async () =>
    nameInput().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ...init })
    )
  )
}

it('한 행은 자리부터 스냅샷까지 아홉 열을 채운다', async () => {
  await render({ state: 'success', character: found, snapshotMark: { kind: 'kept', seat: 1 } })

  expect([...row().cells].reduce((sum, td) => sum + td.colSpan, 0)).toBe(COLUMNS.length)
  expect(cell('서버')?.querySelector('select')?.value).toBe('cain')
  expect(cell('모험단')?.textContent).toBe('찾은모험단')
  expect(cell('길드')?.textContent).toBe('찾은길드')
  expect(cell('직업')?.textContent).toBe('眞 웨펀마스터')
  expect(cell('명성')?.textContent).toBe('125,850')
  expect(visibleText(cell('점수')!)).toBe('장비330,556')
  expect(cell('스냅샷')?.textContent).toBe('1')
})

it('빈 자리는 캐릭터 이름 placeholder와 빈 서버만 두고 나머지 칸은 -다', async () => {
  await render()

  expect(nameInput().placeholder).toBe('캐릭터 이름')
  expect(cell('서버')?.querySelector('select')?.value).toBe('')
  expect(COLUMNS.slice(3, 8).map((column) => cell(column)?.textContent)).toEqual([
    '-',
    '-',
    '-',
    '-',
    '-'
  ])
  expect(row().querySelector('img')).toBeNull()
})

it('이름을 읽는 동안에는 빈 이름 칸에 placeholder를 두지 않는다', async () => {
  await render({ loading: true })

  expect(nameInput().value).toBe('')
  expect(nameInput().hasAttribute('placeholder')).toBe(false)
})

it('결과가 없어도 이름과 서버를 고치고 서버 변경은 그 서버로, Enter는 서버 없이 조회한다', async () => {
  const lookup = vi.fn()
  await render({ onLookup: lookup })
  await enterName('수동이름')
  const select = cell('서버')!.querySelector('select')!
  await act(async () => {
    select.value = 'cain'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(lookup).toHaveBeenCalledExactlyOnceWith('수동이름', 'cain')
  await enterName('새이름')
  await pressEnter()
  expect(lookup).toHaveBeenLastCalledWith('새이름', undefined)
})

it('한글 조합 중 Enter는 조회하지 않는다', async () => {
  const lookup = vi.fn()
  await render({ onLookup: lookup })
  await enterName('이름')
  await pressEnter({ isComposing: true })
  expect(lookup).not.toHaveBeenCalled()
  await pressEnter()
  expect(lookup).toHaveBeenCalledExactlyOnceWith('이름', undefined)
})

it('이름 없이 Enter를 누르면 조회하지 않고 모험단 자리에 노란 입력 안내를 둔다', async () => {
  const lookup = vi.fn()
  await render({ onLookup: lookup })
  await pressEnter()

  expect(lookup).not.toHaveBeenCalled()
  expect(cell('모험단')?.colSpan).toBe(3)
  expect(visibleText(cell('모험단')!)).toBe('캐릭터 이름을 입력해 주세요.')
})

it('OCR 갱신은 고치는 중인 이름을 덮지 않고, 제출한 이름은 대기와 실패 중에도 남는다', async () => {
  const lookup = vi.fn()
  await render({ nickname: 'OCR이름', onLookup: lookup })
  const input = await enterName('직접수정')
  await render({ nickname: '뒤늦은OCR', onLookup: lookup })
  expect(input.value).toBe('직접수정')

  await pressEnter()
  await render({ state: 'pending', nickname: '이전OCR', onLookup: lookup })
  expect(input.value).toBe('직접수정')
  await render({ state: 'failure', nickname: '이전OCR', onLookup: lookup })
  expect(input.value).toBe('직접수정')

  await render({ state: 'pending', nickname: '다음OCR', resetKey: 'next-round' })
  expect(nameInput().value).toBe('다음OCR')
})

it('찾은 캐릭터의 이름을 고치는 동안 모험단 자리에 Enter 조회 안내를 둔다', async () => {
  await render({ state: 'success', character: found })
  expect(cell('모험단')?.textContent).toBe('찾은모험단')

  await enterName('고친이름')
  expect(cell('모험단')?.textContent).toBe('Enter로 조회')
  expect(cell('길드')?.textContent).toBe('찾은길드')
  expect(cell('명성')?.textContent).toBe('125,850')
})

it('이름 인식과 캐릭터 검색은 모험단 자리에, 상세 정보 확인은 명성과 점수 자리에 세 점 진행을 둔다', async () => {
  const progress = (): { column: string | undefined; step: string; current: string } => {
    const bar = row().querySelector('[role="progressbar"]')!
    const column = COLUMNS.find((name) => cell(name)?.contains(bar))
    const step = bar.textContent!
    const current = bar.getAttribute('aria-valuenow')!

    return { column, step, current }
  }

  await render({ loading: true })
  expect(progress()).toEqual({ column: '모험단', step: '이름 인식 중', current: '0' })
  await render({ state: 'pending', nickname: '인식이름' })
  expect(progress()).toEqual({ column: '모험단', step: '캐릭터 검색 중', current: '1' })
  expect(cell('명성')?.textContent).toBe('-')
  await render({ state: 'success', character: found, scorePending: true })
  expect(progress()).toEqual({ column: '명성', step: '상세 정보 확인 중', current: '2' })
  expect(cell('명성')?.colSpan).toBe(2)
  expect(cell('모험단')?.textContent).toBe('찾은모험단')
  await render({ state: 'success', character: found })
  expect(row().querySelector('[role="progressbar"]')).toBeNull()
})

it('검색 실패와 오류는 모험단 자리부터 한 줄 문구로 보이고 초상화와 스냅샷 배지를 두지 않는다', async () => {
  for (const notice of [
    { text: '캐릭터를 찾지 못함', tone: 'failure' },
    { text: '현재 캐릭터 검색을 이용할 수 없습니다.', tone: 'error' }
  ] as const) {
    await render({
      state: notice.tone === 'failure' ? 'empty' : 'failure',
      nickname: '실패이름',
      notice,
      snapshotMark: { kind: 'kept', seat: 1 }
    })

    expect(cell('모험단')?.colSpan).toBe(3)
    expect(visibleText(cell('모험단')!)).toBe(notice.text)
    expect(cell('모험단')?.querySelector('[title]')?.getAttribute('title')).toBe(notice.text)
    expect(cell('명성')?.textContent).toBe('-')
    expect(cell('점수')?.textContent).toBe('-')
    expect(cell('스냅샷')?.textContent).toBe('')
    expect(row().querySelector('img')).toBeNull()
    expect(nameInput().value).toBe('실패이름')
  }
})

it('실패 문구는 노란 글자, 오류 문구는 빨간 글자로 칠한다', async () => {
  const notice = async (tone: 'failure' | 'error'): Promise<Element> => {
    await render({ state: 'failure', notice: { text: '문구', tone } })

    return cell('모험단')!.querySelector('[title]')!
  }

  const failure = await notice('failure')
  expect([hasStyle(failure, 'failure'), hasStyle(failure, 'error')]).toEqual([true, false])
  const error = await notice('error')
  expect([hasStyle(error, 'failure'), hasStyle(error, 'error')]).toEqual([false, true])
})

it('상세 정보 오류는 모험단, 길드, 직업을 두고 명성과 점수 자리에 오류 문구를 둔다', async () => {
  await render({
    state: 'success',
    character: found,
    notice: { text: '캐릭터 검색 응답 시간이 초과됐습니다.', tone: 'error' }
  })

  expect(cell('모험단')?.textContent).toBe('찾은모험단')
  expect(cell('직업')?.textContent).toBe('眞 웨펀마스터')
  expect(cell('명성')?.colSpan).toBe(2)
  expect(visibleText(cell('명성')!)).toBe('캐릭터 검색 응답 시간이 초과됐습니다.')
})

it('스냅샷을 켠 채 찾지 못한 행은 모험단 자리에 직접 입력 칸을 두고 실패 문구는 마우스 설명으로 둔다', async () => {
  const change = vi.fn()
  await render({
    state: 'empty',
    notice: { text: '캐릭터를 찾지 못함', tone: 'failure' },
    snapshotAdventureInput: '',
    onChangeSnapshotAdventure: change
  })

  const field = cell('모험단')!.querySelector<HTMLInputElement>('input[aria-label="1번 모험단"]')!
  expect(field.placeholder).toBe('모험단 이름')
  expect(field.title).toBe('캐릭터를 찾지 못함')
  expect(cell('모험단')?.colSpan).toBe(1)
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '별빛')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(change).toHaveBeenCalledExactlyOnceWith('별빛')
})

it('상위와 랭커는 이름 옆 배지와 명성 숫자 색만 바꾸고 점수는 역할 색을 지킨다', async () => {
  await render({ state: 'success', character: { ...found, tier: 'top' } })
  expect(cell('캐릭터')?.textContent).toContain('상위')
  expect(toneClassesOf(cell('명성')!)).toEqual(['top'])
  expect(toneClassesOf(cell('점수')!.lastElementChild!)).toEqual(['dealer'])

  await render({ state: 'success', character: { ...found, tier: 'ranker', card: bufferCard } })
  expect(cell('캐릭터')?.textContent).toContain('랭커')
  expect(toneClassesOf(cell('명성')!)).toEqual(['ranker'])
  expect(toneClassesOf(cell('점수')!.lastElementChild!)).toEqual(['buffer'])

  await render({ state: 'success', character: found })
  expect(visibleText(cell('캐릭터')!)).not.toMatch(/상위|랭커/)
  expect(toneClassesOf(cell('명성')!)).toEqual([])
})

it('점수 열은 딜러 장비 라벨과 파란 숫자, 버퍼 버프 라벨과 초록 숫자이고 역할을 모르면 기본색이다', async () => {
  const score = async (card: CardCharacter['card']): Promise<[string, string[]]> => {
    await render({ state: 'success', character: { ...found, card } })
    const value = cell('점수')!.lastElementChild!

    return [cell('점수')!.firstElementChild!.textContent!, toneClassesOf(value)]
  }

  expect(await score(dealerCard)).toEqual(['장비', ['dealer']])
  expect(await score(bufferCard)).toEqual(['버프', ['buffer']])
  expect(await score({ ...dealerCard, role: null })).toEqual(['장비', []])
})

it('근사값 점수는 ≈를 붙이고 이유를 마우스 설명과 보조 기술로 전한다', async () => {
  await render({
    state: 'success',
    character: {
      ...found,
      card: {
        ...dealerCard,
        score: {
          ...dealerCard.score!,
          value: null,
          skipped: { kind: 'unresolved', message: 'unresolved: equipment TITLE missing' },
          approximate: { value: 321000, source: 'legacy_fusion_policy_a', warning: '근사값' }
        }
      }
    }
  })
  const value = cell('점수')!.lastElementChild!
  const reason =
    '근사값, 장비 정보 부족. 이전 시즌 융합석을 빼고 계산한 값이라 게임 장비 점수와 1% 넘게 다를 수 있습니다.'

  expect(visibleText(value)).toBe('≈321,000')
  expect(value.getAttribute('title')).toBe(reason)
  expect(value.textContent).toBe(`≈321,000${reason}`)
})

it('검색 응답에 없는 길드, 명성, 점수는 -로 보이고 계산하지 못한 점수는 사유를 보조 기술로 전한다', async () => {
  await render({
    state: 'success',
    character: {
      ...found,
      guild: null,
      fame: null,
      card: {
        ...dealerCard,
        score: { ...dealerCard.score!, value: null, skipped: { kind: 'unresolved', message: '' } }
      }
    }
  })

  expect(cell('길드')?.textContent).toBe('-')
  expect(cell('명성')?.textContent).toBe('-')
  expect(visibleText(cell('점수')!)).toBe('장비-')
  expect(cell('점수')?.textContent).toBe('장비-계산하지 못함, 장비 정보 부족')
})

it('스냅샷 열은 제자리 순번, 신호색으로 채운 바뀐 순번, 빨간 없음 배지 하나만 둔다', async () => {
  const badge = async (
    mark: SlotCard['snapshotMark']
  ): Promise<{ label: string | null; filled: boolean; danger: boolean }> => {
    await render({ state: 'success', character: found, snapshotMark: mark })
    const element = cell('스냅샷')!.querySelector('[role="img"]')!
    const label = element.getAttribute('aria-label')
    const filled = hasStyle(element, 'signalFill')
    const danger = hasStyle(element, 'danger')

    return { label, filled, danger }
  }

  expect(await badge({ kind: 'kept', seat: 2 })).toEqual({
    label: '스냅샷 순번 2',
    filled: false,
    danger: false
  })
  expect(await badge({ kind: 'moved', seat: 2 })).toEqual({
    label: '스냅샷 순번 2, 자리 바뀜',
    filled: true,
    danger: false
  })
  expect(await badge({ kind: 'absent' })).toEqual({
    label: '스냅샷에 없는 모험단',
    filled: false,
    danger: true
  })
  expect(cell('스냅샷')?.textContent).toBe('없음')
})

it('찾은 이름은 보조 기술에 알리고 고치는 동안에는 이름 대신 문구를 알린다', async () => {
  const announced = (): string | null => row().querySelector('[aria-live]')!.textContent

  await render({ state: 'success', character: found })
  expect(announced()).toBe('찾은이름')
  await enterName('')
  await pressEnter()
  expect(announced()).toBe('캐릭터 이름을 입력해 주세요.')
  await render({
    state: 'empty',
    notice: { text: '캐릭터를 찾지 못함', tone: 'failure' },
    resetKey: 'next-round'
  })
  expect(announced()).toBe('캐릭터를 찾지 못함')
})

it('찾은 이름을 지우고 Enter를 누르면 빈 자리처럼 입력 안내만 두고 이전 캐릭터 값을 감춘다', async () => {
  await render({ state: 'success', character: found, snapshotMark: { kind: 'kept', seat: 1 } })
  await enterName('')
  await pressEnter()

  expect(cell('모험단')?.colSpan).toBe(3)
  expect(visibleText(cell('모험단')!)).toBe('캐릭터 이름을 입력해 주세요.')
  expect(cell('명성')?.textContent).toBe('-')
  expect(cell('스냅샷')?.textContent).toBe('')
  expect(row().querySelector('img')).toBeNull()
})

it('상세 정보를 기다리거나 받지 못했거나 이름을 고치는 동안에는 스냅샷 배지를 두지 않는다', async () => {
  const snapshotMark = { kind: 'kept', seat: 1 } as const
  const badge = (): Element | null => cell('스냅샷')!.querySelector('[role="img"]')

  await render({ state: 'success', character: found, snapshotMark, scorePending: true })
  expect(badge()).toBeNull()
  await render({
    state: 'success',
    character: found,
    snapshotMark,
    notice: { text: '상세 오류', tone: 'error' }
  })
  expect(badge()).toBeNull()
  await render({ state: 'success', character: found, snapshotMark })
  expect(badge()).not.toBeNull()
  await enterName('고친이름')
  expect(badge()).toBeNull()
})

it('추정 행도 이름을 고치는 동안에는 모험단 자리에 Enter 조회 안내를 둔다', async () => {
  await render({
    state: 'success',
    character: found,
    notice: { text: '명성으로 추정한 후보입니다.', tone: 'estimate' }
  })
  expect(cell('모험단')?.colSpan).toBe(3)

  await enterName('고친이름')
  expect(cell('모험단')?.colSpan).toBe(1)
  expect(cell('모험단')?.textContent).toBe('Enter로 조회')
  expect(cell('길드')?.textContent).toBe('찾은길드')
})
