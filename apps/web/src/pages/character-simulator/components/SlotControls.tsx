import { WEAPON_RELEASE_MAX } from '@dfragon/lib/equipment-variants'
import { LAB_ITEM_TIERS } from '@dfragon/lib/lab-items'
import { Chip, NumberField, Select, Switch } from '@dfragon/ui'
import { Fragment } from 'react'
import {
  type EnchantOption,
  enhancementTextClasses,
  ItemIcon,
  ItemName,
  type ItemView,
  itemPartClasses,
  itemRarityOfGrade,
  raritySolidOf
} from '#entities/character'
import { ItemTooltip } from '#widgets/item-tooltip'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { LabEnchantCard } from '#pages/character-simulator/api/useEnchantOptions'
import {
  FULL_POTENCY,
  type SimulatorSlot,
  type SimulatorSlotItem,
  type SlotDraft,
  type SlotItemChoice
} from '#pages/character-simulator/model/simulator-draft'
import { TuneSelect } from './TuneSelect'

// 마법부여 선택지 id는 `lab:부위:역할:hash`, 칭호, 크리쳐, 오라 선택지 id는 `lab:종류:hash`, 장비 선택지 id는 32자리 itemId 모양이라 이 값과 겹치지 않는다.
const CURRENT = 'current'
const integer = new Intl.NumberFormat('ko-KR')
const SIGNED: Intl.NumberFormatOptions = { signDisplay: 'always' }
const CONTROL_LINE = 'flex h-control-sm items-center'

// icon이 있으면 Neople 아이템 그림 대신 그 그림을 쓴다(서약 본체).
type ItemFace = Readonly<{
  itemId: string | null
  name: string | null
  rarity: ItemView['rarity']
  icon?: string | null
}>

// 하나는 늘 켜져 있는 목록이라 켜진 버튼을 다시 눌러 꺼지는 변화는 버린다.
function ChoiceChip({
  value,
  chosen,
  onChoose,
  ariaLabel,
  children
}: {
  value: string
  chosen: string
  onChoose: (value: string) => void
  ariaLabel?: string
  children: React.ReactNode
}): React.JSX.Element {
  function changePressed(pressed: boolean): void {
    if (pressed) {
      onChoose(value)
    }
  }

  return (
    <Chip pressed={value === chosen} onPressedChange={changePressed} aria-label={ariaLabel}>
      {children}
    </Chip>
  )
}

// 버튼의 아이콘에만 아이템 정보 tooltip을 걸고, 이름은 버튼 글자로 둔다.
function ItemChoiceChip({
  value,
  item,
  chosen,
  onChoose
}: {
  value: string
  item: ItemFace
  chosen: string
  onChoose: (value: string) => void
}): React.JSX.Element {
  const icon = <ItemIcon itemId={item.itemId} src={item.icon} rarity={item.rarity} />
  const described =
    item.itemId !== null ? (
      <ItemTooltip itemId={item.itemId}>
        <span className="flex shrink-0">{icon}</span>
      </ItemTooltip>
    ) : (
      icon
    )

  return (
    <ChoiceChip value={value} chosen={chosen} onChoose={onChoose}>
      {described}
      <ItemName name={item.name} rarity={item.rarity} weight="normal" />
    </ChoiceChip>
  )
}

export function ItemControl({
  slot,
  slotLabel,
  draft,
  onChange
}: {
  slot: SimulatorSlot
  slotLabel: string
  draft: SlotDraft
  onChange: (draft: Partial<SlotDraft>) => void
}): React.JSX.Element {
  const label = `${slotLabel} 교체`
  const chosen = draft.variantId ?? CURRENT
  const worn: ItemFace = { itemId: slot.itemId, name: slot.itemName, rarity: slot.rarity }

  if (slot.variants.length === 0) {
    return (
      <div className={`${CONTROL_LINE} min-w-0 gap-3`}>
        <ItemIcon itemId={slot.itemId} rarity={slot.rarity} />
        <ItemName name={slot.itemName} rarity={slot.rarity} weight="normal" />
      </div>
    )
  }

  function changeItem(value: string): void {
    const variantId = value === CURRENT ? null : value
    onChange({ variantId })
  }

  return (
    <div className="chip-list" role="group" aria-label={label}>
      {slot.wornVariantId === null && (
        <ItemChoiceChip value={CURRENT} item={worn} chosen={chosen} onChoose={changeItem} />
      )}
      {slot.variants.map((variant) => (
        <ItemChoiceChip
          key={variant.id}
          value={variant.id}
          item={variant}
          chosen={chosen}
          onChoose={changeItem}
        />
      ))}
    </div>
  )
}

export function EquipmentTuneControl({
  slotLabel,
  maxTune,
  draft,
  onChange
}: {
  slotLabel: string
  maxTune: number
  draft: SlotDraft
  onChange: (draft: Partial<SlotDraft>) => void
}): React.JSX.Element {
  function changeTune(tune: number): void {
    onChange({ tune })
  }

  return (
    <TuneSelect
      label={`${slotLabel} 조율`}
      tune={draft.tune}
      maxTune={maxTune}
      onChange={changeTune}
    />
  )
}

export function PotencyControl({
  slotLabel,
  draft,
  onChange
}: {
  slotLabel: string
  draft: SlotDraft
  onChange: (draft: Partial<SlotDraft>) => void
}): React.JSX.Element {
  function changePotency(potency: number): void {
    onChange({ potency })
  }

  return (
    <div className="self-start text-game-precision">
      <NumberField
        aria-label={`${slotLabel} 정밀도`}
        value={draft.potency ?? FULL_POTENCY}
        onValueChange={changePotency}
        min={0}
        max={FULL_POTENCY}
      />
    </div>
  )
}

export function ReleaseControl({
  slotLabel,
  draft,
  onChange
}: {
  slotLabel: string
  draft: SlotDraft
  onChange: (draft: Partial<SlotDraft>) => void
}): React.JSX.Element {
  function changeRelease(release: number): void {
    onChange({ release })
  }

  return (
    <div className="self-start">
      <NumberField
        aria-label={`${slotLabel} 해방`}
        value={draft.release ?? WEAPON_RELEASE_MAX}
        onValueChange={changeRelease}
        min={0}
        max={WEAPON_RELEASE_MAX}
      />
    </div>
  )
}

export function SlotItemControl({
  slotItem,
  chosen,
  onChange
}: {
  slotItem: SimulatorSlotItem
  chosen: string | null
  onChange: (slotItem: SimulatorSlotItem, id: string | null) => void
}): React.JSX.Element {
  const label = `${slotItem.slotName} 교체`
  const value = chosen ?? slotItem.wornChoiceId ?? CURRENT
  const worn: ItemFace = {
    itemId: slotItem.itemId,
    name: slotItem.itemName,
    rarity: slotItem.rarity
  }

  function changeItem(next: string): void {
    const id = next === CURRENT ? null : next
    onChange(slotItem, id)
  }

  return (
    <div className="chip-list" role="group" aria-label={label}>
      {slotItem.wornChoiceId === null && (
        <>
          <span className="chip-list-label">현재</span>
          <ItemChoiceChip value={CURRENT} item={worn} chosen={value} onChoose={changeItem} />
        </>
      )}
      {slotItem.choicesStatus === 'error' && (
        <p className="m-0 pt-2 text-xs text-fg-subtle">
          {`${slotItem.slotName} 목록을 불러오지 못했습니다.`}
        </p>
      )}
      {LAB_ITEM_TIERS.map((tier) => {
        const choices = slotItem.choices.filter((choice) => choice.tier === tier)

        if (choices.length === 0) {
          return null
        }

        return (
          <Fragment key={tier}>
            <span className="chip-list-label">{tier}</span>
            {choices.map((choice) => (
              <SlotItemChoiceChip
                key={choice.id}
                choice={choice}
                chosen={value}
                onChoose={changeItem}
              />
            ))}
          </Fragment>
        )
      })}
    </div>
  )
}

function SlotItemChoiceChip({
  choice,
  chosen,
  onChoose
}: {
  choice: SlotItemChoice
  chosen: string
  onChoose: (value: string) => void
}): React.JSX.Element {
  const { itemId, name, rarity, cards } = choice

  return (
    <ChoiceChip value={choice.id} chosen={chosen} onChoose={onChoose} ariaLabel={name}>
      <ItemTooltip itemId={itemId}>
        <span className="flex shrink-0">
          <ItemIcon itemId={itemId} rarity={rarity} />
        </span>
      </ItemTooltip>
      <span className="flex min-w-0 grow flex-col gap-1 text-xs">
        <ItemName name={name} rarity={rarity} weight="normal" />
        {cards.map((card) => (
          <span
            key={card.itemName}
            className="flex items-center justify-between gap-3 text-2xs text-fg-muted"
          >
            <span className="truncate">{card.itemName}</span>
            <EnchantCardPrice card={card} />
          </span>
        ))}
      </span>
    </ChoiceChip>
  )
}

export function ReinforceControl({
  slot,
  slotLabel,
  draft,
  onChange
}: {
  slot: SimulatorSlot
  slotLabel: string
  draft: SlotDraft
  onChange: (draft: Partial<SlotDraft>) => void
}): React.JSX.Element {
  const disabled = !slot.reinforceEditable
  const enhancement = draft.amplified ? 'amplify' : 'enhance'
  const tone = disabled ? '' : enhancementTextClasses[enhancement]

  function changeReinforce(reinforce: number): void {
    onChange({ reinforce })
  }

  function changeAmplified(amplified: boolean): void {
    onChange({ amplified })
  }

  return (
    <div className={`${CONTROL_LINE} gap-3`}>
      {/* 숫자 칸은 놓인 자리의 글자색을 따르므로 강화, 증폭 색은 감싼 요소가 정한다. */}
      <div className={tone}>
        <NumberField
          aria-label={`${slotLabel} 수치`}
          value={draft.reinforce}
          onValueChange={changeReinforce}
          min={0}
          max={slot.reinforceLimit}
          disabled={disabled}
          format={SIGNED}
        />
      </div>
      <label className="flex shrink-0 items-center gap-2 text-xs whitespace-nowrap text-fg-muted">
        <Switch
          aria-label={`${slotLabel} 증폭`}
          checked={draft.amplified}
          disabled={disabled}
          onCheckedChange={changeAmplified}
        />
        증폭
      </label>
    </div>
  )
}

function joinLabels(options: readonly EnchantOption[]): string {
  return options.map(({ label }) => label).join(', ')
}

// iconUrl은 소유자가 올린 그림이라 Neople 아이콘보다 먼저 쓴다.
function EnchantCardIcon({ card }: { card: LabEnchantCard | null }): React.JSX.Element {
  if (card === null) {
    return <ItemIcon itemId={null} rarity={null} />
  }

  const rarity = itemRarityOfGrade(card.itemRarity)

  if (card.iconUrl === null) {
    return <ItemIcon itemId={card.itemId} rarity={rarity} />
  }

  return (
    <img
      src={card.iconUrl}
      alt=""
      loading="lazy"
      className={`${itemPartClasses.icon} size-game-icon ${raritySolidOf(rarity)}`}
    />
  )
}

function EnchantCardPrice({ card }: { card: LabEnchantCard }): React.JSX.Element {
  if (card.cost !== null) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1">
        <span className="num">{integer.format(card.cost.count)}</span>
        <img src={card.cost.iconUrl} alt={card.cost.currencyName} className="size-[16px]" />
      </span>
    )
  }

  if (card.unitPrice === null) {
    return <span className="num shrink-0">{MISSING_VALUE}</span>
  }

  return <span className="num shrink-0">{integer.format(card.unitPrice)}</span>
}

export function EnchantText({ options }: { options: readonly EnchantOption[] }): React.JSX.Element {
  const important = joinLabels(options.filter(({ emphasized }) => emphasized))
  const minor = joinLabels(options.filter(({ emphasized }) => !emphasized))

  if (important === '' && minor === '') {
    return <span className="text-fg-subtle">{MISSING_VALUE}</span>
  }

  return (
    <>
      {important !== '' && <span className="block text-game-enchant">{important}</span>}
      {minor !== '' && <span className="block text-fg-subtle">{minor}</span>}
    </>
  )
}

export function EnchantControl({
  slot,
  slotLabel,
  draft,
  onChange
}: {
  slot: SimulatorSlot
  slotLabel: string
  draft: SlotDraft
  onChange: (draft: Partial<SlotDraft>) => void
}): React.JSX.Element {
  const label = `${slotLabel} 마법부여`
  const chosen = draft.enchantId ?? CURRENT

  function changeEnchant(value: string): void {
    const enchantId = value === CURRENT ? null : value
    onChange({ enchantId })
  }

  return (
    <div className="chip-list" role="group" aria-label={label}>
      <span className="chip-list-label">현재</span>
      <ChoiceChip
        value={CURRENT}
        chosen={chosen}
        onChoose={changeEnchant}
        ariaLabel="현재 마법부여"
      >
        <EnchantCardIcon card={slot.wornEnchantCard} />
        <span className="min-w-0 grow text-xs">
          <EnchantText options={slot.enchants} />
        </span>
      </ChoiceChip>
      {slot.enchantChoicesStatus === 'error' && (
        <p className="m-0 pt-2 text-xs text-fg-subtle">마법부여 목록을 불러오지 못했습니다.</p>
      )}
      {LAB_ITEM_TIERS.map((tier) => {
        const choices = slot.enchantChoices.filter((choice) => choice.tier === tier)

        if (choices.length === 0) {
          return null
        }

        return (
          <Fragment key={tier}>
            <span className="chip-list-label">{tier}</span>
            {choices.map((choice) => (
              <ChoiceChip
                key={choice.id}
                value={choice.id}
                chosen={chosen}
                onChoose={changeEnchant}
              >
                <EnchantCardIcon card={choice.cards[0]!} />
                <span className="flex min-w-0 grow flex-col gap-1 text-xs">
                  <span>
                    <EnchantText options={choice.options} />
                  </span>
                  {choice.cards.map((card) => (
                    <span
                      key={card.itemName}
                      className="flex items-center justify-between gap-3 text-2xs text-fg-muted"
                    >
                      <span className="truncate">{card.itemName}</span>
                      <EnchantCardPrice card={card} />
                    </span>
                  ))}
                </span>
              </ChoiceChip>
            ))}
          </Fragment>
        )
      })}
    </div>
  )
}

export type TextOption = Readonly<{ id: string; name: string }>

export function TextControl({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: readonly TextOption[]
  onChange: (id: string) => void
}): React.JSX.Element {
  function nameOf(id: string): string {
    const option = options.find((candidate) => candidate.id === id)

    if (option === undefined) {
      return MISSING_VALUE
    }

    return option.name
  }

  function changeSet(next: string | null): void {
    if (next != null) {
      onChange(next)
    }
  }

  return (
    <div className="grid min-w-0">
      <Select.Root value={value} onValueChange={changeSet}>
        <Select.Trigger size="sm" aria-label={label}>
          <Select.Value>
            {(id: string) => <span className="min-w-0 truncate">{nameOf(id)}</span>}
          </Select.Value>
        </Select.Trigger>
        <Select.Popup aria-label={label}>
          {options.map((option) => (
            <Select.Item key={option.id} value={option.id}>
              <Select.ItemText>{option.name}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Popup>
      </Select.Root>
    </div>
  )
}

export function TextChoiceControl({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: readonly TextOption[]
  onChange: (id: string) => void
}): React.JSX.Element {
  return (
    <div className="chip-list" role="group" aria-label={label}>
      {options.map((option) => (
        <ChoiceChip key={option.id} value={option.id} chosen={value} onChoose={onChange}>
          {option.name}
        </ChoiceChip>
      ))}
    </div>
  )
}

/**
 * 서약 본체와 결정처럼 아이콘과 이름으로 고르는 선택이다. 착용 아이템이 선택지에 없으면 착용 중 항목을 첫 항목으로 두고,
 * 선택지가 없으면 착용 아이템을 고정해 보인다.
 */
export function OathItemControl({
  label,
  worn,
  wornListed,
  choices,
  value,
  iconOf = () => null,
  onChange
}: {
  label: string
  worn: ItemView
  wornListed: boolean
  choices: readonly Readonly<{
    id: string
    itemId: string
    name: string
    rarity: ItemView['rarity']
  }>[]
  value: string | null
  iconOf?: (item: ItemView) => string | null
  onChange: (id: string | null) => void
}): React.JSX.Element {
  const chosen = value ?? CURRENT
  const wornIcon = iconOf(worn)
  const wornFace: ItemFace = {
    itemId: worn.itemId,
    name: worn.itemName,
    rarity: worn.rarity,
    icon: wornIcon
  }

  if (choices.length === 0) {
    return (
      <div className={`${CONTROL_LINE} min-w-0 gap-3`}>
        <ItemIcon itemId={worn.itemId} src={wornIcon} rarity={worn.rarity} />
        <ItemName name={worn.itemName} rarity={worn.rarity} weight="normal" />
      </div>
    )
  }

  function changeItem(next: string): void {
    const id = next === CURRENT ? null : next
    onChange(id)
  }

  return (
    <div className="chip-list" role="group" aria-label={label}>
      {!wornListed && (
        <ItemChoiceChip value={CURRENT} item={wornFace} chosen={chosen} onChoose={changeItem} />
      )}
      {choices.map((choice) => {
        const icon = iconOf({
          itemId: choice.itemId,
          itemName: choice.name,
          rarity: choice.rarity
        })

        return (
          <ItemChoiceChip
            key={choice.id}
            value={choice.id}
            item={{ ...choice, icon }}
            chosen={chosen}
            onChoose={changeItem}
          />
        )
      })}
    </div>
  )
}
