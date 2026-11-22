import { NumberField, Select, Switch } from '@dfragon/ui'
import { type EnchantOption, enhancementTextClasses, ItemIcon, ItemName } from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import {
  draftOf,
  type EnchantChoice,
  type SimulatorChanges,
  type SimulatorSlot,
  type SlotDraft
} from '#pages/character-simulator/model/simulator-draft'

// 등급표 id는 `부위:카드:역할` 모양이라 이 값과 겹치지 않는다.
const CURRENT_ENCHANT = 'current'
const ENCHANT_TIERS: EnchantChoice['tier'][] = ['종결', '준종결']
const SIGNED: Intl.NumberFormatOptions = { signDisplay: 'always' }

export function SimulatorTable({
  slots,
  changes,
  onChange
}: {
  slots: readonly SimulatorSlot[]
  changes: SimulatorChanges
  onChange: (slot: SimulatorSlot, draft: Partial<SlotDraft>) => void
}): React.JSX.Element {
  return (
    <div className="table-scroll">
      <table className="table table-wrap table-fixed min-w-[720px] max-sm:min-w-[640px]">
        <thead>
          <tr>
            <th scope="col" className="w-[80px] max-sm:hidden">
              부위
            </th>
            <th scope="col">장비</th>
            <th scope="col" className="w-[200px]">
              강화, 증폭
            </th>
            <th scope="col" className="w-[280px]">
              마법부여
            </th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <SimulatorRow
              key={slot.slotId}
              slot={slot}
              draft={draftOf(slot, changes)}
              onChange={onChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SimulatorRow({
  slot,
  draft,
  onChange
}: {
  slot: SimulatorSlot
  draft: SlotDraft
  onChange: (slot: SimulatorSlot, draft: Partial<SlotDraft>) => void
}): React.JSX.Element {
  const slotLabel = slot.slotName ?? slot.slotId

  function changeSlot(next: Partial<SlotDraft>): void {
    onChange(slot, next)
  }

  return (
    <tr>
      <td className="text-xs whitespace-nowrap text-fg-subtle max-sm:hidden">{slotLabel}</td>
      <td>
        <div className="flex min-w-0 items-center gap-3">
          <ItemIcon itemId={slot.itemId} rarity={slot.rarity} />
          <ItemName name={slot.itemName} rarity={slot.rarity} />
        </div>
      </td>
      <td>
        <ReinforceControl slot={slot} slotLabel={slotLabel} draft={draft} onChange={changeSlot} />
      </td>
      <td>
        <EnchantControl slot={slot} slotLabel={slotLabel} draft={draft} onChange={changeSlot} />
      </td>
    </tr>
  )
}

function ReinforceControl({
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
    <div className="flex items-center gap-3">
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

function EnchantText({ options }: { options: readonly EnchantOption[] }): React.JSX.Element {
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

function EnchantControl({
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

  function optionsOf(value: string): readonly EnchantOption[] {
    const choice = slot.enchantChoices.find(({ id }) => id === value)

    if (choice === undefined) {
      return slot.enchants
    }

    return choice.options
  }

  function changeEnchant(value: string | null): void {
    if (value != null) {
      const enchantId = value === CURRENT_ENCHANT ? null : value
      onChange({ enchantId })
    }
  }

  return (
    <div className="grid min-w-0">
      <Select.Root value={draft.enchantId ?? CURRENT_ENCHANT} onValueChange={changeEnchant}>
        <Select.Trigger size="xs" aria-label={label}>
          <Select.Value>
            {(value: string) => <EnchantText options={optionsOf(value)} />}
          </Select.Value>
        </Select.Trigger>
        <Select.Popup aria-label={label}>
          <Select.Item value={CURRENT_ENCHANT}>
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
