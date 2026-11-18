import { itemRarityOfGrade } from '#core/character/character-item'
import {
  ARTIFACT_PART,
  type HistoryChangeItem,
  type HistoryFieldChange,
  type HistoryNameChange,
  type HistoryPoint,
  SET_PART
} from '#core/character/character-history'
import { formatSeoulFullDateTime } from '#core/time-format'
import { itemTableClasses } from '../equipment/item-classes'
import { ItemName } from '../equipment/item-parts'
import { FIELD_LABELS, formatFieldValue, NAME_CHANGE_LABELS } from './history-format'

const AFTER_TONES: Partial<Record<HistoryFieldChange['field'], string>> = {
  reinforce: 'text-game-enhance',
  amplify: 'text-game-amplify',
  refine: 'text-game-refine',
  enchant: 'text-game-enchant'
}

const BEFORE = 'text-fg-subtle tabular-nums'
const AFTER = 'font-semibold tabular-nums'
const CHANGES = 'm-0 list-none p-0'
const CHANGE = 'flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-4 py-3'
const CHANGE_SLOT = 'w-[56px] shrink-0 text-fg-subtle'
const BADGE = 'badge bg-inset text-fg-muted'

export function Heading({ title, count }: { title: string; count?: number }): React.JSX.Element {
  return (
    <h2 className={itemTableClasses.heading}>
      {title}
      {count !== undefined && <span className={itemTableClasses.count}>{count}</span>}
    </h2>
  )
}

function Arrow(): React.JSX.Element {
  return (
    <span aria-label="에서" className="mx-1 text-fg-subtle">
      →
    </span>
  )
}

function FieldChange({ change }: { change: HistoryFieldChange }): React.JSX.Element {
  const { field, name, before, after } = change

  return (
    <>
      <span className="ms-2 text-fg-subtle">{FIELD_LABELS[field]}</span>
      {name !== null && <span className="text-fg-muted">{name}</span>}
      <span className={BEFORE}>{formatFieldValue(field, before)}</span>
      <Arrow />
      <span className={`${AFTER} ${AFTER_TONES[field] ?? ''}`}>
        {formatFieldValue(field, after)}
      </span>
    </>
  )
}

function ReplacedItem({
  replaced,
  itemName,
  itemRarity
}: {
  replaced: Readonly<{ itemName: string; itemRarity: string | null }> | null
  itemName: string | null
  itemRarity: string | null
}): React.JSX.Element {
  return (
    <>
      {replaced !== null && (
        <>
          <span className={BEFORE}>{replaced.itemName}</span>
          <Arrow />
        </>
      )}
      <ItemName name={itemName} rarity={itemRarityOfGrade(itemRarity)} />
    </>
  )
}

function ChangeLine({ item }: { item: HistoryChangeItem }): React.JSX.Element {
  switch (item.kind) {
    case 'equipment':
      return (
        <li className={CHANGE}>
          <span className={CHANGE_SLOT}>{item.slotName}</span>
          {item.fields.length === 0 ? (
            <ReplacedItem {...item} />
          ) : (
            <>
              <ItemName name={item.itemName} rarity={itemRarityOfGrade(item.itemRarity)} />
              {item.fields.map((change) => (
                <FieldChange key={`${change.field}-${change.name}`} change={change} />
              ))}
            </>
          )}
        </li>
      )
    case 'artifact':
      return (
        <li className={CHANGE}>
          <span className={CHANGE_SLOT}>{ARTIFACT_PART}</span>
          <ReplacedItem {...item} />
        </li>
      )
    case 'set':
      return (
        <li className={CHANGE}>
          <span className={CHANGE_SLOT}>{SET_PART}</span>
          <b className={AFTER}>{item.setItemName}</b>
          {item.fields.map((change) => (
            <FieldChange key={change.field} change={change} />
          ))}
        </li>
      )
  }
}

function changeKey(item: HistoryChangeItem): string {
  switch (item.kind) {
    case 'equipment':
      return `equipment-${item.slotId}`
    case 'artifact':
      return `artifact-${item.slotColor}`
    case 'set':
      return `set-${item.setItemId}`
  }
}

export function HistoryChanges({ point }: { point: HistoryPoint }): React.JSX.Element {
  if (point.first) {
    return (
      <>
        <Heading title="변경점" count={1} />
        <ul className={CHANGES}>
          <li className={`${CHANGE} text-fg-subtle`}>첫 기록</li>
        </ul>
      </>
    )
  }

  return (
    <>
      <Heading title="변경점" count={point.items.length} />
      <ul className={CHANGES}>
        {point.items.map((item) => (
          <ChangeLine key={changeKey(item)} item={item} />
        ))}
      </ul>
      {point.unchanged.length > 0 && (
        <>
          <Heading title="그대로" />
          <ul className="m-0 flex list-none flex-wrap gap-1 px-4 py-3">
            {point.unchanged.map((label) => (
              <li key={label} className={BADGE}>
                {label}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export function NameChanges({
  changes
}: {
  changes: readonly HistoryNameChange[]
}): React.JSX.Element | null {
  if (changes.length === 0) {
    return null
  }

  return (
    <section aria-label="이름 변경">
      <Heading title="이름 변경" count={changes.length} />
      <table className="table table-wrap">
        <thead>
          <tr>
            <th scope="col" className="w-[160px]">
              일시
            </th>
            <th scope="col" className="w-[96px]">
              종류
            </th>
            <th scope="col">이름</th>
          </tr>
        </thead>
        <tbody>
          {changes.toReversed().map(({ kind, at, before, after }, index) => (
            <tr key={`${index}-${kind}-${at}`}>
              <td className="font-mono text-xs whitespace-nowrap text-fg-subtle tabular-nums">
                {formatSeoulFullDateTime(at)}
              </td>
              <td>
                <span className={BADGE}>{NAME_CHANGE_LABELS[kind]}</span>
              </td>
              <td>
                <span className="text-fg-subtle">{before}</span>
                <span aria-label="에서" className="mx-2 text-fg-subtle">
                  →
                </span>
                <span className={`font-semibold ${kind === 'adventure' ? 'text-fg-muted' : ''}`}>
                  {after}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
