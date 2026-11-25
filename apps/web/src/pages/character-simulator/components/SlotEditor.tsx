import { type BuffSwitching, selectableBuffLevels } from '@dfragon/lib/buff-switching'
import { Checkbox, NumberField } from '@dfragon/ui'
import { useState } from 'react'
import {
  type AvatarPresetChange,
  avatarPresetNameOf,
  BEST_AVATAR_PRESET
} from '#pages/character-simulator/model/simulator-avatar'
import {
  draftOf,
  equipmentSetIdOf,
  type SimulatorChanges,
  type SimulatorEquipmentSet,
  type SimulatorSlot,
  type SimulatorSlotItem,
  type SlotDraft,
  slotItemChoiceOf,
  type WeaponTypeChoice,
  tuneLimitOf,
  variantChoiceOf
} from '#pages/character-simulator/model/simulator-draft'
import {
  type CrystalDraft,
  crystalChoicesOf,
  crystalDraftOf,
  crystalTuneLimitOf,
  oathBodyChoiceIdOf,
  type OathChoice,
  type SimulatorOath,
  type SimulatorOathBody,
  type SimulatorOathCrystal
} from '#pages/character-simulator/model/simulator-oath'
import {
  type SimulatorOathUpgrade,
  upgradeOf
} from '#pages/character-simulator/model/simulator-oath-upgrade'
import {
  buffLevelOf,
  SWITCHING_EQUIPMENT_COPY,
  switchingEquipmentOf
} from '#pages/character-simulator/model/simulator-switching'
import type { SimulatorTarget } from '#pages/character-simulator/model/simulator-target'
import { useOathIconOf } from '#pages/character-simulator/model/useOathIconOf'
import {
  EnchantControl,
  EquipmentTuneControl,
  ItemControl,
  OathItemControl,
  PotencyControl,
  ReinforceControl,
  ReleaseControl,
  TextChoiceControl,
  TextControl,
  SlotItemControl
} from './SlotControls'
import { TuneSelect } from './TuneSelect'

export type SlotEditorActions = Readonly<{
  onEquipmentSetChange: (equipmentSet: SimulatorEquipmentSet, setItemId: string) => void
  onChange: (slot: SimulatorSlot, draft: Partial<SlotDraft>) => void
  onSlotItemChange: (slotItem: SimulatorSlotItem, id: string | null) => void
  onAvatarPresetChange: (preset: AvatarPresetChange) => void
  onBuffLevelChange: (switching: BuffSwitching, level: number) => void
  onSwitchingEquipmentChange: (switching: BuffSwitching, count: number) => void
  onOathSetChange: (setId: number) => void
  onOathBodyChange: (body: SimulatorOathBody, id: string) => void
  onOathUpgradeUnlockChange: (
    upgrade: SimulatorOathUpgrade,
    step: number,
    unlocked: boolean
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
  oath,
  changes,
  actions
}: {
  target: SimulatorTarget
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
      if (target.slot.weaponTypes.length > 0) {
        return <UnwornWeaponEditor slot={target.slot} changes={changes} actions={actions} />
      }

      return <EquipmentEditor slot={target.slot} changes={changes} actions={actions} />
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
    case 'avatar':
      return <AvatarEditor changes={changes} actions={actions} />
    case 'switching':
      return <SwitchingEditor switching={target.switching} changes={changes} actions={actions} />
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
        <TextChoiceControl
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
  changes,
  actions
}: {
  slot: SimulatorSlot
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  const slotLabel = slot.slotName ?? slot.slotId
  const draft = draftOf(slot, changes)
  const choice = variantChoiceOf(slot, draft.variantId)
  const tuneLimit = tuneLimitOf(slot, draft.variantId)

  function changeSlot(next: Partial<SlotDraft>): void {
    actions.onChange(slot, next)
  }

  return (
    <Fields>
      <Field label="장비">
        <ItemControl slot={slot} slotLabel={slotLabel} draft={draft} onChange={changeSlot} />
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
      {draft.release !== null && (
        <Field label="해방">
          <ReleaseControl slotLabel={slotLabel} draft={draft} onChange={changeSlot} />
        </Field>
      )}
      {!slot.empty && (
        <Field label="강화, 증폭">
          <ReinforceControl slot={slot} slotLabel={slotLabel} draft={draft} onChange={changeSlot} />
        </Field>
      )}
      {!slot.empty && (
        <Field label="마법부여">
          <EnchantControl slot={slot} slotLabel={slotLabel} draft={draft} onChange={changeSlot} />
        </Field>
      )}
    </Fields>
  )
}

function weaponTypeOf(
  weaponTypes: readonly WeaponTypeChoice[],
  variantId: string | null
): WeaponTypeChoice {
  const chosen = weaponTypes.find(({ variants }) => variants.some(({ id }) => id === variantId))

  if (chosen === undefined) {
    return weaponTypes[0]!
  }

  return chosen
}

function UnwornWeaponEditor({
  slot,
  changes,
  actions
}: {
  slot: SimulatorSlot
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  const slotLabel = slot.slotName ?? slot.slotId
  const draft = draftOf(slot, changes)
  const [weaponType, setWeaponType] = useState(
    () => weaponTypeOf(slot.weaponTypes, draft.variantId).type
  )
  const chosenType =
    slot.weaponTypes.find(({ type }) => type === weaponType) ?? slot.weaponTypes[0]!
  const tuneLimit = tuneLimitOf(slot, draft.variantId)
  const typeOptions = slot.weaponTypes.map(({ type }) => ({ id: type, name: type }))

  function changeSlot(next: Partial<SlotDraft>): void {
    actions.onChange(slot, next)
  }

  return (
    <Fields>
      {slot.weaponTypes.length > 1 && (
        <Field label="무기 종류">
          <TextChoiceControl
            label={`${slotLabel} 종류`}
            value={chosenType.type}
            options={typeOptions}
            onChange={setWeaponType}
          />
        </Field>
      )}
      <Field label="장비">
        <ItemControl
          slot={{ ...slot, variants: chosenType.variants }}
          slotLabel={slotLabel}
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
      {draft.release !== null && (
        <Field label="해방">
          <ReleaseControl slotLabel={slotLabel} draft={draft} onChange={changeSlot} />
        </Field>
      )}
    </Fields>
  )
}

// 선택 버튼의 값은 문자열이라 프리셋을 고르지 않은 상태에 따로 id를 둔다.
const WORN_AVATAR = 'worn'
const WORN_AVATAR_NAME = avatarPresetNameOf(null)
const BEST_AVATAR_NAME = avatarPresetNameOf(BEST_AVATAR_PRESET)
const AVATAR_OPTIONS = [
  { id: WORN_AVATAR, name: WORN_AVATAR_NAME },
  { id: BEST_AVATAR_PRESET, name: BEST_AVATAR_NAME }
]

function AvatarEditor({
  changes,
  actions
}: {
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  function changePreset(id: string): void {
    const preset = id === BEST_AVATAR_PRESET ? BEST_AVATAR_PRESET : null
    actions.onAvatarPresetChange(preset)
  }

  return (
    <Fields>
      <Field label="아바타">
        <TextChoiceControl
          label="아바타"
          value={changes.avatarPreset ?? WORN_AVATAR}
          options={AVATAR_OPTIONS}
          onChange={changePreset}
        />
      </Field>
    </Fields>
  )
}

function SwitchingEditor({
  switching,
  changes,
  actions
}: {
  switching: BuffSwitching
  changes: SimulatorChanges
  actions: SlotEditorActions
}): React.JSX.Element {
  const options = selectableBuffLevels(switching).map((level) => {
    const id = String(level)

    return { id, name: `${level}레벨` }
  })

  function changeLevel(id: string): void {
    actions.onBuffLevelChange(switching, Number(id))
  }

  function changeEquipment(count: number): void {
    actions.onSwitchingEquipmentChange(switching, count)
  }

  return (
    <Fields>
      <Field label={switching.skillName}>
        <TextControl
          label="스위칭 레벨"
          value={String(buffLevelOf(switching, changes.buffLevel))}
          options={options}
          onChange={changeLevel}
        />
      </Field>
      {switching.equipment !== null && (
        <Field label={SWITCHING_EQUIPMENT_COPY.label}>
          <div className="self-start">
            <NumberField
              aria-label={SWITCHING_EQUIPMENT_COPY.inputLabel}
              value={switchingEquipmentOf(switching.equipment, changes.switchingEquipment)}
              onValueChange={changeEquipment}
              min={0}
              max={switching.equipment.max}
            />
          </div>
        </Field>
      )}
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
        <TextChoiceControl
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
      {upgrade.steps.map(({ step, name }) => {
        const unlocked = step <= level

        function changeUnlock(checked: boolean): void {
          actions.onOathUpgradeUnlockChange(upgrade, step, checked)
        }

        return (
          <label key={step} className="flex h-control-sm min-w-0 cursor-pointer items-center gap-2">
            <Checkbox aria-label={name} checked={unlocked} onCheckedChange={changeUnlock} />
            <span className="min-w-0 truncate">{name}</span>
          </label>
        )
      })}
    </div>
  )
}
