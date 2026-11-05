import * as stylex from '@stylexjs/stylex'
import { type EquipmentView, toEquipmentView } from '@dfragon/client-core/lib/character-equipment'
import { formatPoint } from '@dfragon/client-core/lib/character-item'
import type { CharacterTabProps } from './character-tab-props'
import { EquipmentTable } from './equipment/EquipmentTable'
import { styles as tableStyles } from './equipment/item-table.style'
import { ItemName, RarityBadge } from './equipment/item-parts'
import { styles } from './equipment/item-parts.style'

export function EquipmentTab({ detail }: CharacterTabProps): React.JSX.Element {
  const view = toEquipmentView(detail)

  return (
    <div {...stylex.props(tableStyles.root)}>
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
    <div {...stylex.props(styles.strip)}>
      {sets.map((set, index) => (
        <span key={`${set.name}-${index}`} {...stylex.props(styles.itemText)}>
          <span {...stylex.props(styles.stripLabel)}>세트</span>
          <ItemName name={set.name} rarity={set.rarity} />
          {set.rarityName !== null && (
            <RarityBadge rarity={set.rarity}>{set.rarityName}</RarityBadge>
          )}
          {set.point !== null && (
            <span {...stylex.props(styles.stripMuted)}>{formatPoint(set.point)}</span>
          )}
        </span>
      ))}
      <span {...stylex.props(styles.spacer)} />
      {mistLevel !== null && (
        <span {...stylex.props(styles.itemText)}>
          <span {...stylex.props(styles.stripLabel)}>안개 융화</span>
          <b {...stylex.props(styles.name, tableStyles.number)}>{`Lv.${mistLevel}`}</b>
        </span>
      )}
    </div>
  )
}
