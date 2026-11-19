import { Select } from '@dfragon/ui'
import type { FameRankingSetFilter } from '#core/ranking'
import type { SetChoice, SetChoices } from './ranking-sets'

const ALL = 'all'

export function SetSelect({
  label,
  allLabel,
  choices,
  value,
  disabled = false,
  onChange
}: {
  label: string
  allLabel: string
  choices: readonly SetChoice[]
  value: string | undefined
  disabled?: boolean
  onChange: (value: string | undefined) => void
}): React.JSX.Element {
  const items = [{ value: ALL, label: allLabel }, ...choices]

  function handleValueChange(next: string | null): void {
    if (next == null) {
      return
    }

    onChange(next === ALL ? undefined : next)
  }

  return (
    <Select.Root
      value={value ?? ALL}
      onValueChange={handleValueChange}
      items={items}
      disabled={disabled}
    >
      <Select.Trigger size="sm" aria-label={label}>
        <Select.Value />
      </Select.Trigger>
      <Select.Popup aria-label={label}>
        {items.map((item) => (
          <Select.Item key={item.value} value={item.value}>
            <Select.ItemText>{item.label}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Popup>
    </Select.Root>
  )
}

export function RankingSetFilter({
  choices,
  filter,
  onChange
}: {
  choices: SetChoices
  filter: FameRankingSetFilter
  onChange: (filter: FameRankingSetFilter) => void
}): React.JSX.Element {
  const { equipmentSetId, oathSetId, oathSetOption } = filter
  const oathValue = oathSetId !== undefined ? String(oathSetId) : undefined

  function changeEquipment(next: string | undefined): void {
    onChange({ ...filter, equipmentSetId: next })
  }

  // 선택지는 서약 세트에 딸리므로 서약 세트를 바꾸면 선택지를 지운다.
  function changeOath(next: string | undefined): void {
    const nextOathSetId = next !== undefined ? Number(next) : undefined

    onChange({ equipmentSetId, oathSetId: nextOathSetId, oathSetOption: undefined })
  }

  function changeOption(next: string | undefined): void {
    onChange({ ...filter, oathSetOption: next })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <SetSelect
        label="장비 세트"
        allLabel="장비 세트 전체"
        choices={choices.equipment}
        value={equipmentSetId}
        onChange={changeEquipment}
      />
      <SetSelect
        label="서약 세트"
        allLabel="서약 세트 전체"
        choices={choices.oath}
        value={oathValue}
        onChange={changeOath}
      />
      <SetSelect
        label="서약 선택지"
        allLabel="선택지 전체"
        choices={choices.options}
        value={oathSetOption}
        disabled={oathSetId === undefined}
        onChange={changeOption}
      />
    </div>
  )
}
