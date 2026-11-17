import { type EquipmentView, toEquipmentView } from '#core/character/character-equipment'
import { formatPoint } from '#core/character/character-item'
import type { CharacterTabProps } from './character-tab-props'
import { EquipmentTable } from './equipment/EquipmentTable'
import { itemClasses, itemTableClasses } from './equipment/item-classes'
import { ItemName, RarityBadge } from './equipment/item-parts'

export function EquipmentTab({ detail }: CharacterTabProps): React.JSX.Element {
  const view = toEquipmentView(detail)

  return (
    <div className={itemTableClasses.root}>
      <EquipmentStrip view={view} />
      <EquipmentTable view={view} />
    </div>
  )
}

function EquipmentStrip({ view }: { view: EquipmentView }): React.JSX.Element | null {
  const { sets, mistLevel } = view

  if (sets.length === 0 && mistLevel === null) {
    return null
  }

  return (
    <div className={itemClasses.strip}>
      {sets.map((set, index) => (
        <span key={`${set.name}-${index}`} className={itemClasses.itemText}>
          <span className={itemClasses.stripLabel}>세트</span>
          <ItemName name={set.name} rarity={set.rarity} />
          {set.rarityName !== null && (
            <RarityBadge rarity={set.rarity}>{set.rarityName}</RarityBadge>
          )}
          {set.point !== null && (
            <span className={itemClasses.stripNumber}>{formatPoint(set.point)}</span>
          )}
        </span>
      ))}
      <span className={itemClasses.spacer} />
      {mistLevel !== null && (
        <span className={itemClasses.itemText}>
          <span className={itemClasses.stripLabel}>안개 융화</span>
          <b className={`${itemClasses.name} ${itemTableClasses.number}`}>{`Lv.${mistLevel}`}</b>
        </span>
      )}
    </div>
  )
}
