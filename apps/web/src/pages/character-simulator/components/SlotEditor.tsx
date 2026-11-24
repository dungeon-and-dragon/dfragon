import { Checkbox } from '@dfragon/ui'
import {
  draftOf,
  equipmentSetIdOf,
  resolvedItemsOf,
  type SimulatorChanges,
  type SimulatorEquipmentSet,
  type SimulatorRow,
  type SimulatorSlot,
  type SimulatorSlotItem,
  type SlotDraft,
  slotItemChoiceOf,
  tuneLimitOf,
  variantChoiceOf
} from '#pages/character-simulator/model/simulator-draft'
import {
  type CrystalDraft,
  crystalChoicesOf,
  crystalDraftOf,
  crystalItemOf,
  crystalTuneLimitOf,
  oathBodyChoiceIdOf,
  oathBodyItemOf,
  type OathChoice,
  type SimulatorOath,
  type SimulatorOathBody,
  type SimulatorOathCrystal
} from '#pages/character-simulator/model/simulator-oath'
import {
  isOathpointChosen,
  type SimulatorOathUpgrade,
  upgradeOf
} from '#pages/character-simulator/model/simulator-oath-upgrade'
import type { SimulatorTarget } from '#pages/character-simulator/model/simulator-target'
import { useOathIconOf } from '#pages/character-simulator/model/useOathIconOf'
import {
  EnchantControl,
  EquipmentTuneControl,
  ItemControl,
  OathItemControl,
  PotencyControl,
  ReinforceControl,
  TextControl,
  SlotItemControl
} from './SlotControls'
import { TuneSelect } from './TuneSelect'

export type SlotEditorActions = Readonly<{
  onEquipmentSetChange: (equipmentSet: SimulatorEquipmentSet, setItemId: string) => void
  onChange: (slot: SimulatorSlot, draft: Partial<SlotDraft>) => void
  onSlotItemChange: (slotItem: SimulatorSlotItem, id: string | null) => void
  onOathSetChange: (setId: number) => void
  onOathBodyChange: (body: SimulatorOathBody, id: string) => void
  onOathUpgradeUnlockChange: (
    upgrade: SimulatorOathUpgrade,
    step: number,
    unlocked: boolean
  ) => void
  onOathUpgradeOathpointChange: (
    upgrade: SimulatorOathUpgrade,
    step: number,
    oathpoint: boolean
  ) => void
  onCrystalChange: (crystal: SimulatorOathCrystal, draft: Partial<CrystalDraft>) => void
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

function Fields({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex flex-col gap-4 p-4">{children}</div>
}

export function SlotEditor({
  target,
  rows,
  oath,
  changes,
  actions
}: {
  target: SimulatorTarget
  rows: readonly SimulatorRow[]
  oath: SimulatorOath | null
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  switch (target.kind) {
    case 'equipmentSet':
      return (
        <EquipmentSetEditor
          equipmentSet={target.equipmentSet}
          changes={changes}
          actions={actions}
        />
      )
    case 'equipment':
      return <EquipmentEditor slot={target.slot} rows={rows} changes={changes} actions={actions} />
    case 'slotItem':
      return (
        <Fields>
          <Field label="장비">
            <SlotItemControl
              slotItem={target.slotItem}
              chosen={slotItemChoiceOf(target.slotItem, changes)}
              onChange={actions.onSlotItemChange}
            />
          </Field>
        </Fields>
      )
    case 'oathSet':
      return <OathSetEditor oath={target.oath} actions={actions} />
    case 'oathBody':
      return <OathBodyEditor body={target.body} changes={changes} actions={actions} />
    case 'oathUpgrade':
      return <OathUpgradeEditor upgrade={target.upgrade} changes={changes} actions={actions} />
    case 'crystal':
      return (
        <CrystalEditor
          crystal={target.crystal}
          choices={oath !== null ? crystalChoicesOf(oath, target.crystal, changes.oath) : []}
          changes={changes}
          actions={actions}
        />
      )
  }
}

function EquipmentSetEditor({
  equipmentSet,
  changes,
  actions
}: {
  equipmentSet: SimulatorEquipmentSet
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  const options = equipmentSet.sets.map(({ setItemId, setItemName }) => ({
    id: setItemId,
    name: setItemName
  }))

  function changeSet(setItemId: string): void {
    actions.onEquipmentSetChange(equipmentSet, setItemId)
  }

  return (
    <Fields>
      <Field label="세트">
        <TextControl
          label="장비 세트"
          value={equipmentSetIdOf(equipmentSet, changes)}
          options={options}
          onChange={changeSet}
        />
      </Field>
    </Fields>
  )
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
  const tuneLimit = tuneLimitOf(slot, draft.variantId)

  function changeSlot(next: Partial<SlotDraft>): void {
    actions.onChange(slot, next)
  }

  return (
    <Fields>
      <Field label="장비">
        <ItemControl
          slot={slot}
          slotLabel={slotLabel}
          shown={shown}
          draft={draft}
          onChange={changeSlot}
        />
      </Field>
      {tuneLimit > 0 && (
        <Field label="조율">
          <EquipmentTuneControl
            slotLabel={slotLabel}
            maxTune={tuneLimit}
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
    </Fields>
  )
}

function OathSetEditor({
  oath,
  actions
}: {
  oath: SimulatorOath
  actions: SlotEditorActions
}): React.JSX.Element {
  const options = oath.sets.map(({ setId, name }) => ({ id: String(setId), name }))

  function changeSet(id: string): void {
    actions.onOathSetChange(Number(id))
  }

  return (
    <Fields>
      <Field label="세트">
        <TextControl
          label="서약 세트"
          value={String(oath.setId)}
          options={options}
          onChange={changeSet}
        />
      </Field>
    </Fields>
  )
}

function OathBodyEditor({
  body,
  changes,
  actions
}: {
  body: SimulatorOathBody
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  const iconOf = useOathIconOf()

  function changeBody(id: string | null): void {
    if (id !== null) {
      actions.onOathBodyChange(body, id)
    }
  }

  return (
    <Fields>
      <Field label="서약">
        <OathItemControl
          label="서약 교체"
          worn={body}
          wornListed
          shown={oathBodyItemOf(body, changes.oath)}
          choices={body.choices}
          value={oathBodyChoiceIdOf(body, changes.oath)}
          iconOf={iconOf}
          onChange={changeBody}
        />
      </Field>
    </Fields>
  )
}

function CrystalEditor({
  crystal,
  choices,
  changes,
  actions
}: {
  crystal: SimulatorOathCrystal
  choices: readonly OathChoice[]
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  const number = crystal.slotNo + 1
  const draft = crystalDraftOf(crystal, changes.oath)
  const tuneLimit = crystalTuneLimitOf(crystal, draft.variantId)

  function changeVariant(variantId: string | null): void {
    actions.onCrystalChange(crystal, { variantId })
  }

  function changeTune(tune: number): void {
    actions.onCrystalChange(crystal, { tune })
  }

  return (
    <Fields>
      <Field label="결정">
        <OathItemControl
          label={`결정 ${number} 교체`}
          worn={crystal}
          wornListed={crystal.wornVariantId !== null}
          shown={crystalItemOf(crystal, changes.oath)}
          choices={choices}
          value={draft.variantId}
          onChange={changeVariant}
        />
      </Field>
      {tuneLimit > 0 && (
        <Field label="조율">
          <TuneSelect
            label={`결정 ${number} 조율`}
            tune={draft.tune}
            maxTune={tuneLimit}
            onChange={changeTune}
          />
        </Field>
      )}
    </Fields>
  )
}

const DAMAGE = 'damage'
const OATHPOINT = 'oathpoint'
// 엔진은 서약 포인트가 아닌 선택지를 모두 같은 값으로 계산해, 서약 포인트가 아닌 선택지는 최종 데미지 하나로 보인다.
const UPGRADE_OPTIONS = [
  { id: DAMAGE, name: '최종 데미지' },
  { id: OATHPOINT, name: '서약 포인트' }
]

function OathUpgradeEditor({
  upgrade,
  changes,
  actions
}: {
  upgrade: SimulatorOathUpgrade
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  const level = upgradeOf(upgrade, changes.oath.upgrade).length

  return (
    <div className="flex flex-col gap-2 p-4">
      {upgrade.steps.map(({ step, name, oathpointOption }) => {
        const unlocked = step <= level
        const oathpoint = isOathpointChosen(upgrade, changes.oath.upgrade, step)

        function changeUnlock(checked: boolean): void {
          actions.onOathUpgradeUnlockChange(upgrade, step, checked)
        }

        function changeOption(id: string): void {
          actions.onOathUpgradeOathpointChange(upgrade, step, id === OATHPOINT)
        }

        return (
          <div key={step} className="grid h-control-sm grid-cols-2 items-center gap-3">
            <label className="flex min-w-0 cursor-pointer items-center gap-2">
              <Checkbox aria-label={name} checked={unlocked} onCheckedChange={changeUnlock} />
              <span className="min-w-0 truncate">{name}</span>
            </label>
            {unlocked && oathpointOption !== null && (
              <TextControl
                label={`${name} 선택지`}
                value={oathpoint ? OATHPOINT : DAMAGE}
                options={UPGRADE_OPTIONS}
                onChange={changeOption}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
