import { z } from 'zod'
import type { LabItemCard } from '#ops-api/ops-schemas'

// 옵션 줄은 `이름 | 1단계 값 | 2단계 값`처럼 적고, 그 단계에 없는 옵션은 값 자리에 `-`를 적는다.
const OPTION_SEPARATOR = '|'
const MISSING_VALUE = '-'
// 운영 app이 받는 부위 수, 단계 수, 옵션 줄 수, 글자 수 상한과 같다.
const SLOT_MAX_COUNT = 12
const STAGE_MAX_COUNT = 5
const OPTION_MAX_COUNT = 30
const OPTION_TEXT_MAX_LENGTH = 40

export type TooltipText = {
  typeDetail: string
  level: string
  fame: string
  slots: string
  options: string
}

export type TooltipValues = {
  itemTypeDetail: string
  availableLevel: number | null
  fame: number | null
  card: LabItemCard | null
}

function numberText(value: number | null): string {
  if (value === null) {
    return ''
  }

  return String(value)
}

function optionLines(card: LabItemCard): string[] {
  const names = [...new Set(card.enchants.flatMap(({ status }) => status.map(({ name }) => name)))]

  return names.map((name) => {
    const values = card.enchants.map(
      ({ status }) => status.find((option) => option.name === name)?.value ?? MISSING_VALUE
    )

    return [name, ...values].join(` ${OPTION_SEPARATOR} `)
  })
}

export function tooltipText(values: {
  itemTypeDetail: string | null
  availableLevel: number | null
  fame: number | null
  card: LabItemCard | null
}): TooltipText {
  const { card } = values
  const typeDetail = values.itemTypeDetail ?? ''
  const level = numberText(values.availableLevel)
  const fame = numberText(values.fame)
  const slots = card?.slots.join(', ') ?? ''
  const options = card !== null ? optionLines(card).join('\n') : ''

  return { typeDetail, level, fame, slots, options }
}

const positiveInteger = z.coerce.number().pipe(z.int32().positive())

// 빈 칸은 값 없음이고, 양의 정수가 아니면 undefined다.
function readPositiveInteger(text: string): number | null | undefined {
  const trimmed = text.trim()

  if (trimmed === '') {
    return null
  }

  return positiveInteger.safeParse(trimmed).data
}

function isUnreadableRow(cells: readonly string[], stageCount: number): boolean {
  return (
    cells.length !== stageCount ||
    cells.some((cell) => cell === '' || cell.length > OPTION_TEXT_MAX_LENGTH)
  )
}

function stageOptions(rows: readonly string[][], stage: number): LabItemCard['enchants'][number] {
  const status = rows
    .map(([name = '', ...values]) => {
      const value = values[stage] ?? MISSING_VALUE

      return { name, value }
    })
    .filter(({ value }) => value !== MISSING_VALUE)

  return { upgrade: stage, status }
}

function readCard(slotsText: string, optionsText: string): LabItemCard | null | undefined {
  const slots = slotsText
    .split(',')
    .map((slot) => slot.trim())
    .filter((slot) => slot !== '')
  const rows = optionsText
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.split(OPTION_SEPARATOR).map((cell) => cell.trim()))

  if (slots.length === 0 && rows.length === 0) {
    return null
  }

  // 이름 칸 하나와 단계 값 칸이 이어진다.
  const stageCount = (rows[0]?.length ?? 1) - 1
  const unreadableSlots =
    slots.length === 0 ||
    slots.length > SLOT_MAX_COUNT ||
    slots.some((slot) => slot.length > OPTION_TEXT_MAX_LENGTH)
  const unreadableOptions =
    stageCount < 1 ||
    stageCount > STAGE_MAX_COUNT ||
    rows.length > OPTION_MAX_COUNT ||
    rows.some((cells) => isUnreadableRow(cells, stageCount + 1))

  if (unreadableSlots || unreadableOptions) {
    return undefined
  }

  const enchants = Array.from({ length: stageCount }, (_, stage) => stageOptions(rows, stage))

  return { slots, enchants }
}

// 하나라도 읽을 수 없으면 undefined를 돌려 저장하지 않게 한다.
export function readTooltipText(text: TooltipText): TooltipValues | undefined {
  const availableLevel = readPositiveInteger(text.level)
  const fame = readPositiveInteger(text.fame)
  const card = readCard(text.slots, text.options)

  if (availableLevel === undefined || fame === undefined || card === undefined) {
    return undefined
  }

  return { itemTypeDetail: text.typeDetail, availableLevel, fame, card }
}
