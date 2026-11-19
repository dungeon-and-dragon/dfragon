import { Chip } from '@dfragon/ui'
import { SetSelect } from './RankingSetFilter'
import { chosenWeaponOf, type ItemChoices, withUniqueToggled, withWeapon } from './ranking-items'

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
  const weapons = known ? choices.weapons : [{ value: weapon, label: weapon }, ...choices.weapons]

  function changeWeapon(next: string | undefined): void {
    onChange(withWeapon(choices, itemIds, next))
  }

  return (
    <SetSelect
      label="무기"
      allLabel="무기 전체"
      choices={weapons}
      value={weapon}
      onChange={changeWeapon}
    />
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
