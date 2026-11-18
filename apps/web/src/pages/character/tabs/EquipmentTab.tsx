import {
  type EquipmentView,
  formatPoint,
  type OathView,
  toEquipmentView,
  toOathView
} from '#core/character'
import type { CharacterTabProps } from './character-tab-props'
import { EquipmentTable } from './equipment/EquipmentTable'
import { itemClasses, itemTableClasses } from './equipment/item-classes'
import { ItemName, RarityBadge } from './equipment/item-parts'

export function EquipmentTab({ detail }: CharacterTabProps): React.JSX.Element {
  const view = toEquipmentView(detail)
  const oathSet = detail.oath !== null ? toOathView(detail.oath).set : null
  const hasEquipmentStrip = view.sets.length > 0 || view.mistLevel !== null

  return (
    <div className={itemTableClasses.root}>
      {(hasEquipmentStrip || oathSet !== null) && (
        <div className="border-b border-line">
          {hasEquipmentStrip && <EquipmentStrip view={view} />}
          {oathSet !== null && <OathSetStrip set={oathSet} />}
        </div>
      )}
      <EquipmentTable view={view} />
    </div>
  )
}

function EquipmentStrip({ view: { sets, mistLevel } }: { view: EquipmentView }): React.JSX.Element {
  return (
    <div className={itemClasses.stripRow}>
      {sets.map((set, index) => (
        <span key={`${set.name}-${index}`} className={itemClasses.itemText}>
          <span className="label">장비</span>
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
          <span className="label">안개 융화</span>
          <b className={`${itemClasses.name} num`}>{`Lv.${mistLevel}`}</b>
        </span>
      )}
    </div>
  )
}

function OathSetStrip({ set }: { set: NonNullable<OathView['set']> }): React.JSX.Element {
  return (
    <div className={itemClasses.stripRow}>
      <span className={itemClasses.itemText}>
        <span className="label">서약</span>
        <ItemName name={set.name} rarity={set.rarity} />
        {set.rarityName !== null && <RarityBadge rarity={set.rarity}>{set.rarityName}</RarityBadge>}
        {set.point !== null && (
          <span className={itemClasses.stripNumber}>{formatPoint(set.point)}</span>
        )}
      </span>
    </div>
  )
}
