import { LAB_ITEM_RARITIES } from '@dfragon/lib/lab-items'
import { Button, Checkbox } from '@dfragon/ui'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { OpsRequestFailure } from '#ops-api/ops-client'
import type { LabItemDetail } from '#ops-api/ops-schemas'
import {
  useLabItemDetails,
  useLabItemIconUrl,
  useLabItems,
  useSaveLabItemDetail
} from '#ops-app/ops-queries'
import { DescriptionInput, ICON_SIZE, IconInput } from './lab-fields'
import { uniqueNames } from './lab-item-candidates'
import { FIELD_INPUT, panelClasses } from './panel-classes'

const NEOPLE_RARITY = ''

function failureMessage(error: Error | null): string | undefined {
  if (error === null) {
    return undefined
  }

  if (error instanceof OpsRequestFailure && error.status === 400) {
    return '아이콘은 64KB 이하의 PNG, JPEG, GIF, WebP 파일이어야 합니다.'
  }

  return '저장하지 못했습니다.'
}

function DetailIcon({
  itemName,
  detail,
  removing
}: {
  itemName: string
  detail: LabItemDetail | undefined
  removing: boolean
}): React.JSX.Element {
  const iconUrl = useLabItemIconUrl()

  if (detail === undefined || !detail.hasIcon || removing) {
    return <span aria-hidden="true" className="inline-block size-[28px] border border-line" />
  }

  return (
    <img src={iconUrl(itemName, detail.updatedAt)} alt="" width={ICON_SIZE} height={ICON_SIZE} />
  )
}

function ItemDetailRow({
  itemName,
  detail
}: {
  itemName: string
  detail: LabItemDetail | undefined
}): React.JSX.Element {
  const saveDetail = useSaveLabItemDetail()
  const savedDescription = detail?.description ?? ''
  const savedRarity = detail?.itemRarity ?? NEOPLE_RARITY
  const [description, setDescription] = useState(savedDescription)
  const [rarity, setRarity] = useState(savedRarity)
  const [icon, setIcon] = useState<string>()
  const [removing, setRemoving] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const message = failureMessage(saveDetail.error)
  const changed =
    description.trim() !== savedDescription ||
    rarity !== savedRarity ||
    icon !== undefined ||
    removing

  function handleDescriptionChange(next: string): void {
    setDescription(next)
    saveDetail.reset()
  }

  function handleRarityChange(event: ChangeEvent<HTMLSelectElement>): void {
    setRarity(event.currentTarget.value)
    saveDetail.reset()
  }

  function handleIconChange(next: string | undefined): void {
    setIcon(next)
    setRemoving(false)
    saveDetail.reset()
  }

  function handleRemovingChange(next: boolean): void {
    setRemoving(next)
    saveDetail.reset()
  }

  function clearIcon(): void {
    setDescription(description.trim())
    setIcon(undefined)
    setRemoving(false)
    setFormKey((key) => key + 1)
  }

  function iconChange(): string | null | undefined {
    if (removing) {
      return null
    }

    return icon
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (!changed) {
      return
    }

    const itemRarity = rarity === NEOPLE_RARITY ? null : rarity
    const changedIcon = iconChange()
    const draft = { itemName, description, itemRarity, icon: changedIcon }

    saveDetail.mutate(draft, { onSuccess: clearIcon })
  }

  return (
    <li>
      <form
        key={formKey}
        aria-label={`${itemName} 상세`}
        onSubmit={handleSubmit}
        className="m-0 flex flex-wrap items-center gap-3"
      >
        <DetailIcon itemName={itemName} detail={detail} removing={removing} />
        <span className="w-[240px] shrink-0 truncate font-semibold">{itemName}</span>
        <div className="w-[112px] shrink-0">
          <select
            aria-label={`${itemName} 등급`}
            value={rarity}
            onChange={handleRarityChange}
            className={`${FIELD_INPUT} field-box-sm`}
          >
            <option value={NEOPLE_RARITY}>Neople</option>
            {LAB_ITEM_RARITIES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <DescriptionInput
          label={`${itemName} 설명`}
          value={description}
          onChange={handleDescriptionChange}
        />
        <IconInput label={`${itemName} 아이콘`} onChange={handleIconChange} />
        {detail?.hasIcon === true && (
          <label className="flex items-center gap-2">
            <Checkbox
              aria-label={`${itemName} 아이콘 지우기`}
              checked={removing}
              onCheckedChange={handleRemovingChange}
            />
            아이콘 지우기
          </label>
        )}
        <Button type="submit" size="sm" disabled={saveDetail.isPending || !changed}>
          저장
        </Button>
        {message !== undefined && (
          <p role="alert" className="field-error m-0">
            {message}
          </p>
        )}
      </form>
    </li>
  )
}

export function LabItemDetailPanel(): React.JSX.Element {
  const labItems = useLabItems()
  const labItemDetails = useLabItemDetails()
  const itemNames = uniqueNames(
    labItems.data?.groups.flatMap(({ items }) => items.map(({ itemName }) => itemName)) ?? []
  )
  const details = new Map(
    labItemDetails.data?.details.map((detail) => [detail.itemName, detail]) ?? []
  )

  return (
    <section aria-label="실험실 아이템 상세" className={panelClasses.box}>
      <h2 className="section-title">실험실 아이템 상세</h2>
      {labItemDetails.isError && (
        <p role="alert" className="state state-error">
          아이템 상세를 읽지 못했습니다.
        </p>
      )}
      {labItemDetails.data !== undefined && (
        <ul className="m-0 flex list-none flex-col gap-2 p-4">
          {itemNames.map((itemName) => (
            <ItemDetailRow key={itemName} itemName={itemName} detail={details.get(itemName)} />
          ))}
        </ul>
      )}
    </section>
  )
}
