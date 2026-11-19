import { Chip, Select } from '@dfragon/ui'
import {
  chosenWeaponOf,
  type ItemChoices,
  type WeaponGroup,
  withUniqueToggled,
  withWeapon
} from './ranking-items'

const ALL = 'all'
const LABEL = '무기'
const ALL_LABEL = '무기 전체'

export function WeaponSelect({
  choices,
  itemIds,
  onChange
}: {
  choices: ItemChoices
  itemIds: readonly string[]
  onChange: (itemIds: readonly string[]) => void
}): React.JSX.Element {
  const weapon = chosenWeaponOf(choices, itemIds)
  const known = weapon === undefined || choices.weapons.some(({ value }) => value === weapon)
  // 통계를 받기 전이거나 목록에 없는 무기가 주소에 있어도 고른 값을 보이도록 앞에 더한다.
  const groups: readonly WeaponGroup[] = known
    ? choices.weaponGroups
    : [{ label: null, choices: [{ value: weapon, label: weapon }] }, ...choices.weaponGroups]
  const items = [{ value: ALL, label: ALL_LABEL }, ...groups.flatMap((group) => group.choices)]

  function handleValueChange(next: string | null): void {
    if (next == null) {
      return
    }

    const chosen = next === ALL ? undefined : next
    onChange(withWeapon(choices, itemIds, chosen))
  }

  return (
    <Select.Root value={weapon ?? ALL} onValueChange={handleValueChange} items={items}>
      <Select.Trigger size="sm" aria-label={LABEL}>
        <Select.Value />
      </Select.Trigger>
      <Select.Popup aria-label={LABEL}>
        <Select.Item value={ALL}>
          <Select.ItemText>{ALL_LABEL}</Select.ItemText>
        </Select.Item>
        {groups.map((group, index) => (
          <WeaponOptions
            key={group.label ?? `unknown-${index}`}
            group={group}
            separated={group.label === null && index > 0}
          />
        ))}
      </Select.Popup>
    </Select.Root>
  )
}

// 종류 묶음 뒤에 오는 종류를 모르는 무기는 앞 묶음에 붙어 보이지 않게 구분선을 둔다.
function WeaponOptions({
  group: { label, choices },
  separated
}: {
  group: WeaponGroup
  separated: boolean
}): React.JSX.Element {
  const options = choices.map(({ value, label: name }) => (
    <Select.Item key={value} value={value}>
      <Select.ItemText>{name}</Select.ItemText>
    </Select.Item>
  ))

  if (label === null) {
    return (
      <>
        {separated && <Select.Separator />}
        {options}
      </>
    )
  }

  return (
    <Select.Group>
      <Select.GroupLabel>{label}</Select.GroupLabel>
      {options}
    </Select.Group>
  )
}

export function UniqueItemChips({
  choices,
  itemIds,
  onChange
}: {
  choices: ItemChoices
  itemIds: readonly string[]
  onChange: (itemIds: readonly string[]) => void
}): React.JSX.Element {
  function toggle(itemId: string): void {
    onChange(withUniqueToggled(itemIds, itemId))
  }

  return (
    <div className="flex flex-wrap gap-2">
      {choices.uniques.map(({ slotId, label, itemId }) => (
        <UniqueChip
          key={slotId}
          label={label}
          itemId={itemId}
          pressed={itemIds.includes(itemId)}
          onToggle={toggle}
        />
      ))}
    </div>
  )
}

function UniqueChip({
  label,
  itemId,
  pressed,
  onToggle
}: {
  label: string
  itemId: string
  pressed: boolean
  onToggle: (itemId: string) => void
}): React.JSX.Element {
  function handlePressedChange(): void {
    onToggle(itemId)
  }

  return (
    <Chip pressed={pressed} onPressedChange={handlePressedChange}>
      {label}
    </Chip>
  )
}
