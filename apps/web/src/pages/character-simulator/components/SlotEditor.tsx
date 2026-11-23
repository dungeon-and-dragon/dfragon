import { ItemIcon, ItemName } from '#entities/character'
import {
  draftOf,
  oathTuneOf,
  resolvedItemsOf,
  type SimulatorChanges,
  type SimulatorOathCrystal,
  type SimulatorRow,
  type SimulatorSlot,
  type SimulatorSlotItem,
  type SlotDraft,
  slotItemChoiceOf,
  variantChoiceOf
} from '#pages/character-simulator/model/simulator-draft'
import type { SimulatorTarget } from '#pages/character-simulator/model/simulator-target'
import {
  EnchantControl,
  EquipmentTuneControl,
  ItemControl,
  PotencyControl,
  ReinforceControl,
  SlotItemControl
} from './SlotControls'
import { TuneSelect } from './TuneSelect'

export type SlotEditorActions = Readonly<{
  onChange: (slot: SimulatorSlot, draft: Partial<SlotDraft>) => void
  onSlotItemChange: (slotItem: SimulatorSlotItem, id: string | null) => void
  onOathTuneChange: (crystal: SimulatorOathCrystal, tune: number) => void
}>

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="label">{label}</span>
      {children}
    </div>
  )
}

export function SlotEditor({
  target,
  rows,
  changes,
  actions
}: {
  target: SimulatorTarget
  rows: readonly SimulatorRow[]
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  switch (target.kind) {
    case 'equipment':
      return <EquipmentEditor slot={target.slot} rows={rows} changes={changes} actions={actions} />
    case 'slotItem':
      return (
        <div className="flex flex-col gap-4 p-4">
          <Field label="장비">
            <SlotItemControl
              slotItem={target.slotItem}
              chosen={slotItemChoiceOf(target.slotItem, changes)}
              onChange={actions.onSlotItemChange}
            />
          </Field>
        </div>
      )
    case 'oath':
      return <OathEditor crystal={target.crystal} changes={changes} actions={actions} />
  }
}

function EquipmentEditor({
  slot,
  rows,
  changes,
  actions
}: {
  slot: SimulatorSlot
  rows: readonly SimulatorRow[]
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  const slotLabel = slot.slotName ?? slot.slotId
  const draft = draftOf(slot, changes)
  const shown = resolvedItemsOf(rows, changes)[slot.slotId] ?? slot
  const choice = variantChoiceOf(slot, draft.variantId)

  function changeSlot(next: Partial<SlotDraft>): void {
    actions.onChange(slot, next)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="장비">
        <ItemControl
          slot={slot}
          slotLabel={slotLabel}
          shown={shown}
          draft={draft}
          onChange={changeSlot}
        />
      </Field>
      {choice !== undefined && choice.maxTune > 0 && (
        <Field label="조율">
          <EquipmentTuneControl
            slotLabel={slotLabel}
            maxTune={choice.maxTune}
            draft={draft}
            onChange={changeSlot}
          />
        </Field>
      )}
      {choice?.exalted === true && (
        <Field label="정밀도">
          <PotencyControl slotLabel={slotLabel} draft={draft} onChange={changeSlot} />
        </Field>
      )}
      <Field label="강화, 증폭">
        <ReinforceControl slot={slot} slotLabel={slotLabel} draft={draft} onChange={changeSlot} />
      </Field>
      <Field label="마법부여">
        <EnchantControl slot={slot} slotLabel={slotLabel} draft={draft} onChange={changeSlot} />
      </Field>
    </div>
  )
}

function OathEditor({
  crystal,
  changes,
  actions
}: {
  crystal: SimulatorOathCrystal
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  function changeTune(tune: number): void {
    actions.onOathTuneChange(crystal, tune)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="결정">
        <span className="flex min-w-0 items-center gap-3">
          <ItemIcon itemId={crystal.itemId} rarity={crystal.rarity} />
          <ItemName name={crystal.itemName} rarity={crystal.rarity} />
        </span>
      </Field>
      {crystal.maxTune > 0 && (
        <Field label="조율">
          <TuneSelect
            label={`결정 ${crystal.slotNo + 1} 조율`}
            tune={oathTuneOf(crystal, changes)}
            maxTune={crystal.maxTune}
            onChange={changeTune}
          />
        </Field>
      )}
    </div>
  )
}
