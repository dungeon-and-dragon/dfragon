import { Button, Select, TextField, TextFieldInput } from '@dfragon/ui'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import type { ScoreSort } from '#entities/ranking'
import { MAX_RANGE_DIGITS, type SearchRange, searchRangeOf } from './search-range'

const RANGE_INPUT = 'w-[112px] max-sm:w-[88px]'
const FAME = 'fame'
const LABEL = '검색 기준'
const CRITERIA = [
  { value: FAME, label: '명성' },
  { value: 'equipmentScore', label: '장비 점수' },
  { value: 'buffScore', label: '버프 점수' }
] as const

type CriterionValue = (typeof CRITERIA)[number]['value']

const GROUPED = new Intl.NumberFormat('en-US')
const NON_DIGIT_PATTERN = /\D/g
const LEADING_ZEROS_PATTERN = /^0+(?=\d)/

function textOf(bound: number | undefined): string {
  if (bound === undefined) {
    return ''
  }

  return String(bound)
}

function digitsOf(text: string): string {
  return text
    .replace(NON_DIGIT_PATTERN, '')
    .replace(LEADING_ZEROS_PATTERN, '')
    .slice(0, MAX_RANGE_DIGITS)
}

function groupedOf(digits: string): string {
  if (digits === '') {
    return ''
  }

  return GROUPED.format(Number(digits))
}

function sortOf(value: CriterionValue): ScoreSort | undefined {
  if (value === FAME) {
    return undefined
  }

  return value
}

export function SearchCriterionFilter({
  sort,
  range,
  onSortChange,
  onRangeChange
}: {
  sort: ScoreSort | undefined
  range: SearchRange
  onSortChange: (sort: ScoreSort | undefined) => void
  onRangeChange: (range: SearchRange) => void
}): React.JSX.Element {
  const [from, setFrom] = useState(textOf(range.from))
  const [to, setTo] = useState(textOf(range.to))
  const next = searchRangeOf(from, to)
  const criterion = CRITERIA.find(({ value }) => value === (sort ?? FAME)) ?? CRITERIA[0]

  function handleCriterionChange(value: CriterionValue | null): void {
    if (value === null || value === criterion.value) {
      return
    }

    onSortChange(sortOf(value))
  }

  function handleFromChange(event: ChangeEvent<HTMLInputElement>): void {
    setFrom(digitsOf(event.target.value))
  }

  function handleToChange(event: ChangeEvent<HTMLInputElement>): void {
    setTo(digitsOf(event.target.value))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (next !== null) {
      onRangeChange(next)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <Select.Root value={criterion.value} onValueChange={handleCriterionChange} items={CRITERIA}>
        <Select.Trigger size="sm" aria-label={LABEL}>
          <Select.Value />
        </Select.Trigger>
        <Select.Popup aria-label={LABEL}>
          {CRITERIA.map(({ value, label }) => (
            <Select.Item key={value} value={value}>
              <Select.ItemText>{label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Popup>
      </Select.Root>
      <div className="flex items-center gap-2">
        <div className={RANGE_INPUT}>
          <TextField size="sm" invalid={next === null}>
            <TextFieldInput
              aria-label={`최저 ${criterion.label}`}
              inputMode="numeric"
              autoComplete="off"
              value={groupedOf(from)}
              onChange={handleFromChange}
            />
          </TextField>
        </div>
        <span className="text-fg-muted">~</span>
        <div className={RANGE_INPUT}>
          <TextField size="sm" invalid={next === null}>
            <TextFieldInput
              aria-label={`최대 ${criterion.label}`}
              inputMode="numeric"
              autoComplete="off"
              value={groupedOf(to)}
              onChange={handleToChange}
            />
          </TextField>
        </div>
      </div>
      <Button type="submit" variant="secondary" size="sm" disabled={next === null}>
        적용
      </Button>
    </form>
  )
}
