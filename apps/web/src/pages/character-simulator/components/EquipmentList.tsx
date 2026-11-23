import {
  enhancementTextClasses,
  ItemIcon,
  ItemName,
  type ItemView,
  tuneNumeral
} from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import {
  draftOf,
  enchantLabelsOf,
  FULL_POTENCY,
  oathTuneOf,
  resolvedItemsOf,
  type SimulatorChanges,
  type SimulatorRow,
  type SimulatorSlot,
  type SimulatorSlotItem,
  slotItemChoiceOf,
  variantChoiceOf
} from '#pages/character-simulator/model/simulator-draft'
import type { SimulatorTarget } from '#pages/character-simulator/model/simulator-target'
import { EnchantText } from './SlotControls'

const SLOT = 'text-xs whitespace-nowrap text-fg-subtle'
const PICK =
  'flex w-full min-w-0 cursor-pointer items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal'

type SelectTarget = (key: string) => void

export function EquipmentList({
  rows,
  targets,
  changes,
  selectedKey,
  onSelect
}: {
  rows: readonly SimulatorRow[]
  targets: readonly SimulatorTarget[]
  changes: SimulatorChanges
  selectedKey: string | undefined
  onSelect: SelectTarget
}): React.JSX.Element {
  const resolved = resolvedItemsOf(rows, changes)

  return (
    <table className="table table-wrap table-fixed">
      <thead>
        <tr>
          <th scope="col" className="w-[80px] max-sm:hidden">
            부위
          </th>
          <th scope="col">장비</th>
          <th scope="col" className="w-[88px]">
            강화, 증폭
          </th>
          <th scope="col" className="w-[240px] max-sm:hidden">
            마법부여
          </th>
        </tr>
      </thead>
      <tbody>
        {targets.map((target) => {
          const selected = target.key === selectedKey

          switch (target.kind) {
            case 'equipment':
              return (
                <EquipmentRow
                  key={target.key}
                  target={target.key}
                  slot={target.slot}
                  shown={resolved[target.slot.slotId] ?? target.slot}
                  changes={changes}
                  selected={selected}
                  onSelect={onSelect}
                />
              )
            case 'slotItem':
              return (
                <SlotItemRow
                  key={target.key}
                  target={target.key}
                  slotItem={target.slotItem}
                  changes={changes}
                  selected={selected}
                  onSelect={onSelect}
                />
              )
            case 'oath':
              return null
          }
        })}
      </tbody>
    </table>
  )
}

function PickButton({
  target,
  selected,
  onSelect,
  children
}: {
  target: string
  selected: boolean
  onSelect: SelectTarget
  children: React.ReactNode
}): React.JSX.Element {
  function select(): void {
    onSelect(target)
  }

  return (
    <button type="button" aria-pressed={selected} className={PICK} onClick={select}>
      {children}
    </button>
  )
}

function ItemText({
  item,
  tune = null,
  potency = null
}: {
  item: ItemView
  tune?: string | null
  potency?: number | null
}): React.JSX.Element {
  return (
    <>
      <ItemIcon itemId={item.itemId} rarity={item.rarity} />
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <ItemName name={item.itemName} rarity={item.rarity} />
        {tune !== null && <span className="label">{tune}</span>}
        {/* 캐릭터 상세 화면처럼 정밀도가 다 찬 100%는 보이지 않는다. */}
        {potency !== null && potency !== FULL_POTENCY && (
          <span className="num text-xs text-game-precision">{`${potency}%`}</span>
        )}
      </span>
    </>
  )
}

function EquipmentRow({
  target,
  slot,
  shown,
  changes,
  selected,
  onSelect
}: {
  target: string
  slot: SimulatorSlot
  shown: ItemView
  changes: SimulatorChanges
  selected: boolean
  onSelect: SelectTarget
}): React.JSX.Element {
  const draft = draftOf(slot, changes)
  const exalted = variantChoiceOf(slot, draft.variantId)?.exalted === true
  const enhancement = draft.amplified ? 'amplify' : 'enhance'

  return (
    <tr aria-selected={selected}>
      <td className={`${SLOT} max-sm:hidden`}>{slot.slotName ?? slot.slotId}</td>
      <td>
        <PickButton target={target} selected={selected} onSelect={onSelect}>
          <ItemText
            item={shown}
            tune={tuneNumeral(draft.tune)}
            potency={exalted ? draft.potency : null}
          />
        </PickButton>
      </td>
      <td className="whitespace-nowrap">
        {draft.reinforce > 0 ? (
          <span
            className={`num ${enhancementTextClasses[enhancement]}`}
          >{`+${draft.reinforce}`}</span>
        ) : (
          <span className="text-fg-subtle">{MISSING_VALUE}</span>
        )}
      </td>
      <td className="text-xs max-sm:hidden">
        <EnchantText options={enchantLabelsOf(slot, draft.enchantId)} />
      </td>
    </tr>
  )
}

function SlotItemRow({
  target,
  slotItem,
  changes,
  selected,
  onSelect
}: {
  target: string
  slotItem: SimulatorSlotItem
  changes: SimulatorChanges
  selected: boolean
  onSelect: SelectTarget
}): React.JSX.Element {
  const chosenId = slotItemChoiceOf(slotItem, changes)
  const chosen = slotItem.choices.find(({ id }) => id === chosenId)
  const item: ItemView =
    chosen !== undefined
      ? { itemId: chosen.itemId, itemName: chosen.name, rarity: chosen.rarity }
      : slotItem

  return (
    <tr aria-selected={selected}>
      <td className={`${SLOT} max-sm:hidden`}>{slotItem.slotName}</td>
      <td>
        <PickButton target={target} selected={selected} onSelect={onSelect}>
          <ItemText item={item} />
        </PickButton>
      </td>
      <td />
      <td className="max-sm:hidden" />
    </tr>
  )
}

export function OathCrystalList({
  targets,
  changes,
  selectedKey,
  onSelect
}: {
  targets: readonly SimulatorTarget[]
  changes: SimulatorChanges
  selectedKey: string | undefined
  onSelect: SelectTarget
}): React.JSX.Element {
  return (
    <table className="table table-wrap table-fixed">
      <thead>
        <tr>
          <th scope="col">결정</th>
        </tr>
      </thead>
      <tbody>
        {targets.map((target) => {
          if (target.kind !== 'oath') {
            return null
          }

          const { crystal } = target
          const selected = target.key === selectedKey

          return (
            <tr key={target.key} aria-selected={selected}>
              <td>
                <PickButton target={target.key} selected={selected} onSelect={onSelect}>
                  <ItemText item={crystal} tune={tuneNumeral(oathTuneOf(crystal, changes))} />
                </PickButton>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
