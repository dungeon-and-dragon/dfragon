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
import { buffLevelOf } from '#pages/character-simulator/model/simulator-switching'
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
              return (
                <TextRow
                  key={target.key}
                  label="아바타"
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  {avatarPresetNameOf(changes.avatarPreset)}
                </TextRow>
              )
            case 'switching': {
              const { switching } = target
              const level = buffLevelOf(switching, changes.buffLevel)

              return (
                <TextRow
                  key={target.key}
                  label="스위칭"
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  {`${switching.skillName} ${level}레벨`}
                </TextRow>
              )
            }
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
    <tr aria-selected={selected}>
      <td className={`${SLOT} max-sm:hidden`}>세트</td>
      <td>
        <PickButton target={target} selected={selected} onSelect={onSelect}>
          <span className="min-w-0 font-semibold">
            {equipmentSetNameOf(equipmentSet, changes) ?? MISSING_VALUE}
          </span>
        </PickButton>
      </td>
      <td />
      <td className="max-sm:hidden" />
    </tr>
  )
}

function TextRow({
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
    <tr aria-selected={selected}>
      <td className={`${SLOT} max-sm:hidden`}>{label}</td>
      <td>
        <PickButton target={target} selected={selected} onSelect={onSelect}>
          <span className="min-w-0 font-semibold">{children}</span>
        </PickButton>
      </td>
      <td />
      <td className="max-sm:hidden" />
    </tr>
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
                <OathRow
                  key={target.key}
                  label="세트"
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  <span className="min-w-0 font-semibold">
                    {oathSetNameOf(target.oath) ?? MISSING_VALUE}
                  </span>
                </OathRow>
              )
            case 'oathBody':
              return (
                <OathRow
                  key={target.key}
                  label="서약"
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  <OathBodyText body={target.body} changes={changes} />
                </OathRow>
              )
            case 'oathUpgrade': {
              const level = upgradeOf(target.upgrade, changes.oath.upgrade).length

              return (
                <OathRow
                  key={target.key}
                  label={target.upgrade.title}
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  <span className="min-w-0 font-semibold">
                    {level > 0 ? `${level}단계` : MISSING_VALUE}
                  </span>
                </OathRow>
              )
            }
            case 'crystal': {
              const { crystal } = target
              const { tune } = crystalDraftOf(crystal, changes.oath)

              return (
                <OathRow
                  key={target.key}
                  label={`결정 ${crystal.slotNo + 1}`}
                  target={target.key}
                  selected={selected}
                  onSelect={onSelect}
                >
                  <ItemText item={crystalItemOf(crystal, changes.oath)} tune={tuneNumeral(tune)} />
                </OathRow>
              )
            }
            case 'equipmentSet':
            case 'equipment':
            case 'slotItem':
            case 'avatar':
            case 'switching':
              return null
          }
        })}
      </tbody>
    </table>
  )
}

function OathRow({
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
    <tr aria-selected={selected}>
      {/* "묵언의 진의"처럼 칸보다 긴 줄 이름은 말줄임하지 않고 두 줄로 둔다. */}
      <td className="w-[80px] text-xs text-fg-subtle max-sm:hidden">{label}</td>
      <td>
        <PickButton target={target} selected={selected} onSelect={onSelect}>
          {children}
        </PickButton>
      </td>
    </tr>
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
