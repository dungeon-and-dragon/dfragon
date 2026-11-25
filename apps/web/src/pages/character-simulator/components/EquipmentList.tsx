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
  EMPTY_SLOT_NAME,
  equipmentSetNameOf,
  FULL_POTENCY,
  resolvedItemsOf,
  type SimulatorChanges,
  type SimulatorEquipmentSet,
  type SimulatorRow,
  type SimulatorSlot,
  type SimulatorSlotItem,
  slotItemChoiceOf,
  variantChoiceOf
} from '#pages/character-simulator/model/simulator-draft'
import { avatarPresetNameOf } from '#pages/character-simulator/model/simulator-avatar'
import { upgradeOf } from '#pages/character-simulator/model/simulator-oath-upgrade'
import { switchingTextOf } from '#pages/character-simulator/model/simulator-switching'
import { useOathIconOf } from '#pages/character-simulator/model/useOathIconOf'
import {
  crystalDraftOf,
  crystalItemOf,
  oathBodyItemOf,
  oathSetNameOf,
  type SimulatorOathBody
} from '#pages/character-simulator/model/simulator-oath'
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
            case 'equipmentSet':
              return (
                <EquipmentSetRow
                  key={target.key}
                  target={target.key}
                  equipmentSet={target.equipmentSet}
                  changes={changes}
                  selected={selected}
                  onSelect={onSelect}
                />
              )
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
            case 'avatar':
            case 'switching':
            case 'oathSet':
            case 'oathBody':
            case 'oathUpgrade':
            case 'crystal':
              return null
          }
        })}
      </tbody>
    </table>
  )
}

function EquipmentSetRow({
  target,
  equipmentSet,
  changes,
  selected,
  onSelect
}: {
  target: string
  equipmentSet: SimulatorEquipmentSet
  changes: SimulatorChanges
  selected: boolean
  onSelect: SelectTarget
}): React.JSX.Element {
  return (
    <PickRow target={target} selected={selected} onSelect={onSelect}>
      <td className={`${SLOT} max-sm:hidden`}>세트</td>
      <td>
        <PickButton selected={selected}>
          <ItemName
            name={equipmentSetNameOf(equipmentSet, changes) ?? EMPTY_SLOT_NAME}
            rarity={equipmentSet.rarity}
            weight="normal"
          />
        </PickButton>
      </td>
      <td />
      <td className="max-sm:hidden" />
    </PickRow>
  )
}

// 줄 어디를 눌러도 고르도록 click은 줄이 받는다. 버튼은 키보드와 보조 기술이 누르는 곳이고, 그 click도 줄로 올라간다.
function PickRow({
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
    <tr aria-selected={selected} className="cursor-pointer" onClick={select}>
      {children}
    </tr>
  )
}

function PickButton({
  selected,
  children
}: {
  selected: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button type="button" aria-pressed={selected} className={PICK}>
      {children}
    </button>
  )
}

function ItemText({
  item,
  icon = null,
  tune = null,
  potency = null
}: {
  item: ItemView
  icon?: string | null
  tune?: string | null
  potency?: number | null
}): React.JSX.Element {
  return (
    <>
      <ItemIcon itemId={item.itemId} src={icon} rarity={item.rarity} />
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <ItemName name={item.itemName} rarity={item.rarity} weight="normal" />
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
    <PickRow target={target} selected={selected} onSelect={onSelect}>
      <td className={`${SLOT} max-sm:hidden`}>{slot.slotName ?? slot.slotId}</td>
      <td>
        <PickButton selected={selected}>
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
    </PickRow>
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
    <PickRow target={target} selected={selected} onSelect={onSelect}>
      <td className={`${SLOT} max-sm:hidden`}>{slotItem.slotName}</td>
      <td>
        <PickButton selected={selected}>
          <ItemText item={item} />
        </PickButton>
      </td>
      <td />
      <td className="max-sm:hidden" />
    </PickRow>
  )
}

export function OathList({
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
      <tbody>
        {targets.map((target) => {
          const selected = target.key === selectedKey

          switch (target.kind) {
            case 'oathSet':
              return (
                <LabelRow
                  key={target.key}
                  label="세트"
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  <ItemName
                    name={oathSetNameOf(target.oath) ?? EMPTY_SLOT_NAME}
                    rarity={target.oath.rarity}
                    weight="normal"
                  />
                </LabelRow>
              )
            case 'oathBody':
              return (
                <LabelRow
                  key={target.key}
                  label="서약"
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  <OathBodyText body={target.body} changes={changes} />
                </LabelRow>
              )
            case 'crystal': {
              const { crystal } = target
              const { tune } = crystalDraftOf(crystal, changes.oath)

              return (
                <LabelRow
                  key={target.key}
                  label={`결정 ${crystal.slotNo + 1}`}
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  <ItemText item={crystalItemOf(crystal, changes.oath)} tune={tuneNumeral(tune)} />
                </LabelRow>
              )
            }
            case 'equipmentSet':
            case 'equipment':
            case 'slotItem':
            case 'avatar':
            case 'switching':
            case 'oathUpgrade':
              return null
          }
        })}
      </tbody>
    </table>
  )
}

export function EtcList({
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
      <tbody>
        {targets.map((target) => {
          const selected = target.key === selectedKey

          switch (target.kind) {
            case 'avatar':
              return (
                <LabelRow
                  key={target.key}
                  label="아바타"
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  <span className="min-w-0">{avatarPresetNameOf(changes.avatarPreset)}</span>
                </LabelRow>
              )
            case 'switching':
              return (
                <LabelRow
                  key={target.key}
                  label="스위칭"
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  <span className="min-w-0">
                    {switchingTextOf(
                      target.switching,
                      changes.buffLevel,
                      changes.switchingEquipment
                    )}
                  </span>
                </LabelRow>
              )
            case 'oathUpgrade': {
              const level = upgradeOf(target.upgrade, changes.oath.upgrade).length

              return (
                <LabelRow
                  key={target.key}
                  label={target.upgrade.title}
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  <span className="min-w-0">{level > 0 ? `${level}단계` : MISSING_VALUE}</span>
                </LabelRow>
              )
            }
            case 'equipmentSet':
            case 'equipment':
            case 'slotItem':
            case 'oathSet':
            case 'oathBody':
            case 'crystal':
              return null
          }
        })}
      </tbody>
    </table>
  )
}

function LabelRow({
  label,
  target,
  selected,
  onSelect,
  children
}: {
  label: string
  target: string
  selected: boolean
  onSelect: SelectTarget
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <PickRow target={target} selected={selected} onSelect={onSelect}>
      {/* "묵언의 진의"처럼 칸보다 긴 줄 이름은 말줄임하지 않고 두 줄로 둔다. */}
      <td className="w-[80px] text-xs text-fg-subtle max-sm:hidden">{label}</td>
      <td>
        <PickButton selected={selected}>{children}</PickButton>
      </td>
    </PickRow>
  )
}

function OathBodyText({
  body,
  changes
}: {
  body: SimulatorOathBody
  changes: SimulatorChanges
}): React.JSX.Element {
  const iconOf = useOathIconOf()
  const item = oathBodyItemOf(body, changes.oath)

  return <ItemText item={item} icon={iconOf(item)} />
}
