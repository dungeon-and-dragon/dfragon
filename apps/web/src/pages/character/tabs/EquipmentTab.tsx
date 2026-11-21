import {
  EQUIPMENT_SET_POINT_BONUS,
  type EquipmentView,
  ItemName,
  itemPartClasses,
  OATH_SET_POINT_BONUS,
  type OathView,
  RarityBadge,
  toEquipmentView,
  toOathView
} from '#entities/character'
import type { CharacterTabProps } from './character-tab-props'
import { EquipmentTable } from './equipment/EquipmentTable'
import { itemClasses, itemTableClasses } from './equipment/item-classes'
import { SetPoint } from './equipment/item-parts'

export function EquipmentTab({ detail }: CharacterTabProps): React.JSX.Element {
  const view = toEquipmentView(detail)
  const oathSet = detail.oath !== null ? toOathView(detail.oath).set : null
  const hasEquipmentStrip = view.sets.length > 0 || view.mistLevel !== null

  return (
    <div className={itemTableClasses.root}>
      {(hasEquipmentStrip || oathSet !== null) && (
        <div className={itemClasses.stripGroup}>
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
    <div className={`${itemClasses.stripRow} max-sm:contents`}>
      {sets.map((set, index) => (
        <span key={`${set.name}-${index}`} className={itemClasses.itemText}>
          <span className="label">장비</span>
          <ItemName name={set.name} rarity={set.rarity} />
          {set.rarityName !== null && (
            <RarityBadge rarity={set.rarity}>{set.rarityName}</RarityBadge>
          )}
          {set.point !== null && <SetPoint point={set.point} rule={EQUIPMENT_SET_POINT_BONUS} />}
        </span>
      ))}
      <span className={`${itemClasses.spacer} max-sm:hidden`} />
      {mistLevel !== null && (
        <span className={`${itemClasses.itemText} max-sm:order-last max-sm:self-end`}>
          <span className="label">안개 융화</span>
          <b className={`${itemPartClasses.name} num`}>{`Lv ${mistLevel}`}</b>
        </span>
      )}
    </div>
  )
}

function OathSetStrip({ set }: { set: NonNullable<OathView['set']> }): React.JSX.Element {
  return (
    <div className={`${itemClasses.stripRow} max-sm:px-0`}>
      <span className={itemClasses.itemText}>
        <span className="label">서약</span>
        <ItemName name={set.name} rarity={set.rarity} />
        {set.rarityName !== null && <RarityBadge rarity={set.rarity}>{set.rarityName}</RarityBadge>}
        {set.point !== null && <SetPoint point={set.point} rule={OATH_SET_POINT_BONUS} />}
      </span>
    </div>
  )
}
