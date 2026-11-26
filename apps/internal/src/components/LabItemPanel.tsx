import { enchantOptionsOf } from '@dfragon/lib/enchant-grades'
import {
  isEnchantCategory,
  LAB_ITEM_CATEGORIES,
  LAB_ITEM_TIERS,
  type LabItemCategory,
  type LabItemGroupKey,
  type LabItemRole,
  labItemRolesOf
} from '@dfragon/lib/lab-items'
import { Button, Checkbox } from '@dfragon/ui'
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import type { LabCurrency, LabItem, LabItemCost } from '#ops-api/ops-schemas'
import { useLabCurrencies, useLabItems, useReplaceLabItems } from '#ops-app/ops-queries'
import {
  type CandidateNames,
  groupIdOf,
  readCandidateFile,
  uniqueNames
} from './lab-item-candidates'
import { FIELD_INPUT, panelClasses } from './panel-classes'

const CATEGORY_NAMES: Readonly<Record<LabItemCategory, string>> = {
  WEAPON: '무기',
  JACKET: '상의',
  SHOULDER: '머리어깨',
  PANTS: '하의',
  WAIST: '벨트',
  SHOES: '신발',
  AMULET: '목걸이',
  WRIST: '팔찌',
  RING: '반지',
  SUPPORT: '보조장비',
  MAGIC_STON: '마법석',
  EARRING: '귀걸이',
  TITLE: '칭호',
  CREATURE: '크리쳐',
  AURA: '오라'
}

const ROLE_NAMES: Readonly<Record<LabItemRole, string | undefined>> = {
  dealer: '딜러',
  buffer: '버퍼',
  all: undefined
}

function hasGradeOptions({ category, role, tier }: LabItemGroupKey): boolean {
  if (!isEnchantCategory(category) || role === 'all') {
    return true
  }

  return enchantOptionsOf(category, role)[tier].length > 0
}

const GROUPS: readonly LabItemGroupKey[] = LAB_ITEM_CATEGORIES.flatMap((category) =>
  labItemRolesOf(category).flatMap((role) =>
    LAB_ITEM_TIERS.map((tier) => ({ category, role, tier }))
  )
).filter(hasGradeOptions)

function titleOf({ category, role, tier }: LabItemGroupKey): string {
  const words = [CATEGORY_NAMES[category], ROLE_NAMES[role], tier]

  return words.filter((word) => word !== undefined).join(' ')
}

function sameNames(left: ReadonlySet<string>, right: readonly string[]): boolean {
  return left.size === right.length && right.every((name) => left.has(name))
}

function sameCost(left: LabItemCost | null, right: LabItemCost | null): boolean {
  return left?.currencyId === right?.currencyId && left?.count === right?.count
}

type CostChanges = ReadonlyMap<string, ReadonlyMap<string, LabItemCost | null>>

function appendName(names: CandidateNames, id: string, name: string): CandidateNames {
  const appended = uniqueNames([...(names.get(id) ?? []), name])

  return new Map(names).set(id, appended)
}

type GroupRowsProps = {
  id: string
  title: string
  names: readonly string[]
  checked: ReadonlySet<string>
  currencies: readonly LabCurrency[]
  costOf: (id: string, name: string) => LabItemCost | null
  onCheckedChange: (id: string, name: string, checked: boolean) => void
  onCostChange: (id: string, name: string, cost: LabItemCost | null) => void
  onAdd: (id: string, name: string) => void
}

type NameRowProps = {
  name: string
  checked: boolean
  cost: LabItemCost | null
  currencies: readonly LabCurrency[]
  onCheckedChange: (name: string, checked: boolean) => void
  onCostChange: (name: string, cost: LabItemCost | null) => void
}

const AUCTION_OPTION = ''

function NameRow({ name, checked, cost, currencies, onCheckedChange, onCostChange }: NameRowProps) {
  function handleCheckedChange(next: boolean): void {
    onCheckedChange(name, next)
  }

  function handleCurrencyChange(event: ChangeEvent<HTMLSelectElement>): void {
    const { value } = event.currentTarget

    if (value === AUCTION_OPTION) {
      onCostChange(name, null)

      return
    }

    const currencyId = Number(value)
    const count = cost?.count ?? 1

    onCostChange(name, { currencyId, count })
  }

  function handleCountChange(event: ChangeEvent<HTMLInputElement>): void {
    if (cost === null) {
      return
    }

    const count = Number(event.currentTarget.value)
    onCostChange(name, { ...cost, count })
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <Checkbox aria-label={name} checked={checked} onCheckedChange={handleCheckedChange} />
        <span className="min-w-0 truncate">{name}</span>
      </label>
      <div className="w-[112px] shrink-0">
        <select
          aria-label={`${name} 재화`}
          value={cost?.currencyId ?? AUCTION_OPTION}
          onChange={handleCurrencyChange}
          className={`${FIELD_INPUT} field-box-sm`}
        >
          <option value={AUCTION_OPTION}>경매장</option>
          {currencies.map((currency) => (
            <option key={currency.id} value={currency.id}>
              {currency.name}
            </option>
          ))}
        </select>
      </div>
      {cost !== null && (
        <div className="w-16 shrink-0">
          <input
            type="number"
            min={1}
            step={1}
            aria-label={`${name} 개수`}
            value={cost.count}
            onChange={handleCountChange}
            className={`${FIELD_INPUT} field-box-sm`}
          />
        </div>
      )}
    </div>
  )
}

function AddNameForm({ title, onAdd }: { title: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setName(event.currentTarget.value)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const trimmed = name.trim()

    if (trimmed === '') {
      return
    }

    onAdd(trimmed)
    setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="m-0 flex items-center gap-2">
      <input
        type="text"
        autoComplete="off"
        aria-label={`${title} 이름`}
        value={name}
        onChange={handleChange}
        className={`${FIELD_INPUT} field-box-sm min-w-0 flex-1`}
      />
      <Button type="submit" size="sm">
        추가
      </Button>
    </form>
  )
}

function GroupRows({
  id,
  title,
  names,
  checked,
  currencies,
  costOf,
  onCheckedChange,
  onCostChange,
  onAdd
}: GroupRowsProps) {
  function handleCheckedChange(name: string, next: boolean): void {
    onCheckedChange(id, name, next)
  }

  function handleCostChange(name: string, cost: LabItemCost | null): void {
    onCostChange(id, name, cost)
  }

  function handleAdd(name: string): void {
    onAdd(id, name)
  }

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border border-line p-3">
      <legend className="px-1 font-semibold">{title}</legend>
      {names.map((name) => (
        <NameRow
          key={name}
          name={name}
          checked={checked.has(name)}
          cost={costOf(id, name)}
          currencies={currencies}
          onCheckedChange={handleCheckedChange}
          onCostChange={handleCostChange}
        />
      ))}
      <AddNameForm title={title} onAdd={handleAdd} />
    </fieldset>
  )
}

export function LabItemPanel(): React.JSX.Element {
  const labItems = useLabItems()
  const labCurrencies = useLabCurrencies()
  const replaceLabItems = useReplaceLabItems()
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileNames, setFileNames] = useState<CandidateNames>(new Map())
  const [addedNames, setAddedNames] = useState<CandidateNames>(new Map())
  const [checkedChanges, setCheckedChanges] = useState<ReadonlyMap<string, ReadonlySet<string>>>(
    new Map()
  )
  const [costChanges, setCostChanges] = useState<CostChanges>(new Map())
  const [fileInvalid, setFileInvalid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const currencies = labCurrencies.data?.currencies ?? []
  const savedItems = new Map(labItems.data?.groups.map((group) => [groupIdOf(group), group.items]))

  function savedItemsOf(id: string): readonly LabItem[] {
    const saved = savedItems.get(id)

    if (saved === undefined) {
      return []
    }

    return saved
  }

  function savedOf(id: string): readonly string[] {
    return savedItemsOf(id).map(({ itemName }) => itemName)
  }

  function savedCostOf(id: string, name: string): LabItemCost | null {
    const saved = savedItemsOf(id).find(({ itemName }) => itemName === name)

    if (saved === undefined) {
      return null
    }

    return saved.cost
  }

  function costOf(id: string, name: string): LabItemCost | null {
    const changed = costChanges.get(id)?.get(name)

    if (changed === undefined) {
      return savedCostOf(id, name)
    }

    return changed
  }

  function setCost(id: string, name: string, cost: LabItemCost | null): void {
    const group = new Map(costChanges.get(id)).set(name, cost)
    setCostChanges(new Map(costChanges).set(id, group))
  }

  function checkedOf(id: string): ReadonlySet<string> {
    const changed = checkedChanges.get(id)

    if (changed === undefined) {
      return new Set(savedOf(id))
    }

    return changed
  }

  function namesOf(id: string): string[] {
    return uniqueNames([
      ...savedOf(id),
      ...(fileNames.get(id) ?? []),
      ...(addedNames.get(id) ?? [])
    ])
  }

  function setChecked(id: string, name: string, checked: boolean): void {
    const next = new Set(checkedOf(id))

    if (checked) {
      next.add(name)
    } else {
      next.delete(name)
    }

    setCheckedChanges(new Map(checkedChanges).set(id, next))
  }

  function addName(id: string, name: string): void {
    setAddedNames(appendName(addedNames, id, name))
    setChecked(id, name, true)
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''

    if (file === undefined) {
      return
    }

    const candidates = readCandidateFile(await file.text())

    if (candidates === null) {
      setFileInvalid(true)

      return
    }

    setFileInvalid(false)
    setFileNames(candidates)
  }

  function openFilePicker(): void {
    fileInput.current?.click()
  }

  function itemsOf(id: string): LabItem[] {
    const checked = checkedOf(id)

    return namesOf(id)
      .filter((name) => checked.has(name))
      .map((itemName) => {
        const cost = costOf(id, itemName)

        return { itemName, cost }
      })
  }

  const changedGroups = GROUPS.filter((group) => {
    const id = groupIdOf(group)
    const costChanged = itemsOf(id).some(
      ({ itemName, cost }) => !sameCost(cost, savedCostOf(id, itemName))
    )

    return costChanged || !sameNames(checkedOf(id), savedOf(id))
  })
  const hasInvalidCount = GROUPS.some((group) =>
    itemsOf(groupIdOf(group)).some(
      ({ cost }) => cost !== null && (!Number.isInteger(cost.count) || cost.count < 1)
    )
  )

  async function save(): Promise<void> {
    setSaving(true)
    setSaveFailed(false)

    try {
      for (const group of changedGroups) {
        const items = itemsOf(groupIdOf(group))
        await replaceLabItems.mutateAsync({ ...group, items })
      }

      setCheckedChanges(new Map())
      setCostChanges(new Map())
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="실험실 아이템" className={panelClasses.box}>
      <h2 className="section-title">실험실 아이템</h2>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="후보 파일"
          hidden
          onChange={handleFileChange}
        />
        <Button onClick={openFilePicker}>후보 파일</Button>
        <Button
          variant="primary"
          disabled={saving || hasInvalidCount || changedGroups.length === 0}
          onClick={save}
        >
          저장
        </Button>
      </div>
      {fileInvalid && (
        <p role="alert" className="state state-error">
          후보 파일 형식이 맞지 않습니다.
        </p>
      )}
      {saveFailed && (
        <p role="alert" className="state state-error">
          저장하지 못했습니다.
        </p>
      )}
      {labItems.isError && (
        <p role="alert" className="state state-error">
          실험실 아이템을 읽지 못했습니다.
        </p>
      )}
      {labItems.data !== undefined && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3 p-4">
          {GROUPS.map((group) => {
            const id = groupIdOf(group)

            return (
              <GroupRows
                key={id}
                id={id}
                title={titleOf(group)}
                names={namesOf(id)}
                checked={checkedOf(id)}
                currencies={currencies}
                costOf={costOf}
                onCheckedChange={setChecked}
                onCostChange={setCost}
                onAdd={addName}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
