import { Select } from '@dfragon/ui'
import { ItemIcon } from '#entities/character'
import {
  chosenUniquesOf,
  chosenWeaponOf,
  type ItemChoices,
  isUniqueBlocked,
  type UniqueItemGroup,
  type WeaponGroup,
  withUniques,
  withWeapon
} from '#widgets/ranking-filter/lib/ranking-items'

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
        {weapon !== undefined && <ItemIcon itemId={weapon} rarity={null} size="sm" />}
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
      <ItemIcon itemId={value} rarity={null} size="sm" />
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

const UNIQUE_LABEL = '유일 장비'
const UNIQUE_ALL_LABEL = '유일 장비 전체'

export function UniqueItemSelect({
  choices,
  itemIds,
  onChange
}: {
  choices: ItemChoices
  itemIds: readonly string[]
  onChange: (itemIds: readonly string[]) => void
}): React.JSX.Element {
  const chosen = chosenUniquesOf(choices, itemIds)
  const items = choices.uniqueGroups.flatMap((group) => group.choices)

  function handleValueChange(next: string[]): void {
    onChange(withUniques(choices, itemIds, next))
  }

  function valueText(values: string[]): string {
    const [only] = values

    if (only === undefined) {
      return UNIQUE_ALL_LABEL
    }

    if (values.length > 1) {
      return `${values.length}개`
    }

    const chosenItem = items.find(({ value }) => value === only)

    if (chosenItem === undefined) {
      return only
    }

    return chosenItem.label
  }

  function isBlocked(itemId: string): boolean {
    return isUniqueBlocked(choices, itemIds, itemId)
  }

  return (
    <Select.Root multiple value={chosen} onValueChange={handleValueChange} items={items}>
      <Select.Trigger size="sm" aria-label={UNIQUE_LABEL}>
        {chosen.length > 0 && (
          <span className="flex items-center gap-1">
            {chosen.map((itemId) => (
              <ItemIcon key={itemId} itemId={itemId} rarity={null} size="sm" />
            ))}
          </span>
        )}
        <Select.Value>{valueText}</Select.Value>
      </Select.Trigger>
      <Select.Popup aria-label={UNIQUE_LABEL}>
        {choices.uniqueGroups.map((group) => (
          <UniqueOptions key={group.slotId} group={group} isBlocked={isBlocked} />
        ))}
      </Select.Popup>
    </Select.Root>
  )
}

function UniqueOptions({
  group: { label, choices },
  isBlocked
}: {
  group: UniqueItemGroup
  isBlocked: (itemId: string) => boolean
}): React.JSX.Element {
  return (
    <Select.Group>
      <Select.GroupLabel>{label}</Select.GroupLabel>
      {choices.map(({ value, label: name }) => (
        <Select.Item key={value} value={value} disabled={isBlocked(value)}>
          <ItemIcon itemId={value} rarity={null} size="sm" />
          <Select.ItemText>{name}</Select.ItemText>
        </Select.Item>
      ))}
    </Select.Group>
  )
}
