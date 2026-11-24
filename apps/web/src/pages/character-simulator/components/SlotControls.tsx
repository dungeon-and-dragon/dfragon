import { NumberField, Select, Switch } from '@dfragon/ui'
import {
  type EnchantOption,
  enhancementTextClasses,
  ItemIcon,
  ItemName,
  type ItemView
} from '#entities/character'
import { ItemTooltip } from '#widgets/item-tooltip'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import {
  type EnchantChoice,
  enchantLabelsOf,
  FULL_POTENCY,
  type SimulatorSlot,
  type SimulatorSlotItem,
  type SlotDraft
} from '#pages/character-simulator/model/simulator-draft'
import { TuneSelect } from './TuneSelect'

// 등급표 id는 `부위:카드:역할`, 칭호, 크리쳐, 오라 묶음 id는 `분류:명성:아이템`, 장비 선택지 id는 32자리 itemId 모양이라 이 값과 겹치지 않는다.
const CURRENT = 'current'
const ENCHANT_TIERS: EnchantChoice['tier'][] = ['종결', '준종결']
const SIGNED: Intl.NumberFormatOptions = { signDisplay: 'always' }
const CONTROL_LINE = 'flex h-control-sm items-center'

// icon이 있으면 Neople 아이템 그림 대신 그 그림을 쓴다(서약 본체).
type ItemFace = Readonly<{
  itemId: string | null
  name: string | null
  rarity: ItemView['rarity']
  icon?: string | null
}>

function ItemFaceText({ item }: { item: ItemFace }): React.JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <ItemIcon itemId={item.itemId} src={item.icon} rarity={item.rarity} />
      <span className="min-w-0 truncate">
        <ItemName name={item.name} rarity={item.rarity} />
      </span>
    </span>
  )
}

// 목록 항목의 아이콘에만 아이템 정보 tooltip을 걸고, 이름은 항목 글자로 둔다.
function SlotItemOption({ value, item }: { value: string; item: ItemFace }): React.JSX.Element {
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
    <Select.Item value={value}>
      {described}
      <Select.ItemText>
        <ItemName name={item.name} rarity={item.rarity} />
      </Select.ItemText>
    </Select.Item>
  )
}

export function ItemControl({
  slot,
  slotLabel,
  shown,
  draft,
  onChange
}: {
  slot: SimulatorSlot
  slotLabel: string
  shown: ItemView
  draft: SlotDraft
  onChange: (draft: Partial<SlotDraft>) => void
}): React.JSX.Element {
  const label = `${slotLabel} 교체`
  const face: ItemFace = { itemId: shown.itemId, name: shown.itemName, rarity: shown.rarity }
  const worn: ItemFace = { itemId: slot.itemId, name: slot.itemName, rarity: slot.rarity }

  if (slot.variants.length === 0) {
    return (
      <div className={`${CONTROL_LINE} min-w-0 gap-3`}>
        <ItemIcon itemId={slot.itemId} rarity={slot.rarity} />
        <ItemName name={slot.itemName} rarity={slot.rarity} />
      </div>
    )
  }

  function changeItem(value: string | null): void {
    if (value != null) {
      const variantId = value === CURRENT ? null : value
      onChange({ variantId })
    }
  }

  return (
    <div className="grid w-full min-w-0">
      <Select.Root value={draft.variantId ?? CURRENT} onValueChange={changeItem}>
        <Select.Trigger size="sm" aria-label={label}>
          <Select.Value>{() => <ItemFaceText item={face} />}</Select.Value>
        </Select.Trigger>
        <Select.Popup aria-label={label}>
          {slot.wornVariantId === null && <SlotItemOption value={CURRENT} item={worn} />}
          {slot.variants.map((variant) => (
            <SlotItemOption key={variant.id} value={variant.id} item={variant} />
          ))}
        </Select.Popup>
      </Select.Root>
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
  const worn: ItemFace = {
    itemId: slotItem.itemId,
    name: slotItem.itemName,
    rarity: slotItem.rarity
  }

  function faceOf(value: string): ItemFace {
    const choice = slotItem.choices.find(({ id }) => id === value)

    if (choice === undefined) {
      return worn
    }

    return choice
  }

  function changeItem(value: string | null): void {
    if (value != null) {
      const id = value === CURRENT ? null : value
      onChange(slotItem, id)
    }
  }

  return (
    <div className="grid min-w-0">
      <Select.Root value={chosen ?? CURRENT} onValueChange={changeItem}>
        <Select.Trigger size="sm" aria-label={label}>
          <Select.Value>{(value: string) => <ItemFaceText item={faceOf(value)} />}</Select.Value>
        </Select.Trigger>
        <Select.Popup aria-label={label}>
          <SlotItemOption value={CURRENT} item={worn} />
          {slotItem.choices.map((choice) => (
            <SlotItemOption key={choice.id} value={choice.id} item={choice} />
          ))}
        </Select.Popup>
      </Select.Root>
    </div>
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

export function EnchantText({ options }: { options: readonly EnchantOption[] }): React.JSX.Element {
  const important = joinLabels(options.filter(({ emphasized }) => emphasized))
  const minor = joinLabels(options.filter(({ emphasized }) => !emphasized))

  if (important === '' && minor === '') {
    return <span className="text-fg-subtle">{MISSING_VALUE}</span>
  }

  return (
    <>
      {important !== '' && <span className="text-game-enchant">{important}</span>}
      {important !== '' && minor !== '' && ', '}
      {minor !== '' && <span className="text-fg-subtle">{minor}</span>}
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

  function changeEnchant(value: string | null): void {
    if (value != null) {
      const enchantId = value === CURRENT ? null : value
      onChange({ enchantId })
    }
  }

  return (
    <div className="grid h-control-sm min-w-0 items-center">
      <Select.Root value={draft.enchantId ?? CURRENT} onValueChange={changeEnchant}>
        <Select.Trigger size="xs" aria-label={label}>
          <Select.Value>
            {(value: string) => <EnchantText options={enchantLabelsOf(slot, value)} />}
          </Select.Value>
        </Select.Trigger>
        <Select.Popup aria-label={label}>
          <Select.Item value={CURRENT}>
            <Select.ItemText>현재 마법부여</Select.ItemText>
            {slot.enchants.length > 0 && (
              <span className="text-xs text-fg-subtle">{joinLabels(slot.enchants)}</span>
            )}
          </Select.Item>
          {ENCHANT_TIERS.map((tier) => {
            const choices = slot.enchantChoices.filter((choice) => choice.tier === tier)

            if (choices.length === 0) {
              return null
            }

            return (
              <Select.Group key={tier}>
                <Select.GroupLabel>{tier}</Select.GroupLabel>
                {choices.map((choice) => (
                  <Select.Item key={choice.id} value={choice.id}>
                    <Select.ItemText>
                      <EnchantText options={choice.options} />
                    </Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Group>
            )
          })}
        </Select.Popup>
      </Select.Root>
    </div>
  )
}

export type SetOption = Readonly<{ id: string; name: string }>

export function SetControl({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: readonly SetOption[]
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

/**
 * 서약 본체와 결정처럼 아이콘과 이름으로 고르는 선택이다. 착용 아이템이 선택지에 없으면 착용 중 항목을 첫 항목으로 두고,
 * 선택지가 없으면 착용 아이템을 고정해 보인다.
 */
export function OathItemControl({
  label,
  worn,
  wornListed,
  shown,
  choices,
  value,
  iconOf = () => null,
  onChange
}: {
  label: string
  worn: ItemView
  wornListed: boolean
  shown: ItemView
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
  const shownIcon = iconOf(shown)
  const face: ItemFace = {
    itemId: shown.itemId,
    name: shown.itemName,
    rarity: shown.rarity,
    icon: shownIcon
  }
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
        <ItemName name={worn.itemName} rarity={worn.rarity} />
      </div>
    )
  }

  function changeItem(next: string | null): void {
    if (next != null) {
      const id = next === CURRENT ? null : next
      onChange(id)
    }
  }

  return (
    <div className="grid w-full min-w-0">
      <Select.Root value={value ?? CURRENT} onValueChange={changeItem}>
        <Select.Trigger size="sm" aria-label={label}>
          <Select.Value>{() => <ItemFaceText item={face} />}</Select.Value>
        </Select.Trigger>
        <Select.Popup aria-label={label}>
          {!wornListed && <SlotItemOption value={CURRENT} item={wornFace} />}
          {choices.map((choice) => {
            const icon = iconOf({
              itemId: choice.itemId,
              itemName: choice.name,
              rarity: choice.rarity
            })

            return <SlotItemOption key={choice.id} value={choice.id} item={{ ...choice, icon }} />
          })}
        </Select.Popup>
      </Select.Root>
    </div>
  )
}
