import {
  formatPoint,
  type HistoryFieldChange,
  type HistoryNameChange,
  signedEnchantValue,
  tuneNumeral
} from '#entities/character'

export const MISSING = '-'

export const integer = new Intl.NumberFormat('ko-KR')

export const FIELD_LABELS = {
  reinforce: '강화',
  amplify: '증폭',
  refine: '재련',
  tune: '조율',
  enchant: '마법부여',
  rarity: '등급',
  point: '포인트'
} as const satisfies Record<HistoryFieldChange['field'], string>

export const NAME_CHANGE_LABELS = {
  character: '캐릭터명',
  adventure: '모험단명'
} as const satisfies Record<HistoryNameChange['kind'], string>

function signedNumber(value: number): string {
  if (value > 0) {
    return `+${integer.format(value)}`
  }

  return integer.format(value)
}

function tuneText(value: number): string {
  const numeral = tuneNumeral(value)

  if (numeral === null) {
    return String(value)
  }

  return numeral
}

export function formatFieldValue(
  field: HistoryFieldChange['field'],
  value: HistoryFieldChange['before']
): string {
  if (value === null) {
    return MISSING
  }

  if (typeof value === 'string') {
    if (field === 'enchant') {
      return signedEnchantValue(value)
    }

    return value
  }

  switch (field) {
    case 'reinforce':
    case 'amplify':
      return signedNumber(value)
    case 'enchant':
      return signedEnchantValue(value)
    case 'tune':
      return tuneText(value)
    case 'point':
      return formatPoint(value)
    case 'refine':
    case 'rarity':
      return integer.format(value)
  }
}

export function formatOptional(value: number | null): string {
  if (value === null) {
    return MISSING
  }

  return integer.format(value)
}

export type Delta = Readonly<{ text: string; direction: 'up' | 'down' | null }>

export function deltaOf(
  current: number | null,
  previous: number | null | undefined,
  format: (value: number) => string = integer.format
): Delta {
  if (current === null || previous == null || current === previous) {
    return { text: MISSING, direction: null }
  }

  const change = current - previous
  const sign = change > 0 ? '+' : '-'
  const direction = change > 0 ? 'up' : 'down'
  const text = `${sign}${format(Math.abs(change))}`

  return { text, direction }
}
