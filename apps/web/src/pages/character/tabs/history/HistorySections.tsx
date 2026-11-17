import * as stylex from '@stylexjs/stylex'
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
import { ItemName } from '../equipment/item-parts'
import { FIELD_LABELS, formatFieldValue, NAME_CHANGE_LABELS } from './history-format'
import { styles } from './HistoryTab.style'

const AFTER_TONES: Partial<Record<HistoryFieldChange['field'], stylex.StyleXStyles>> = {
  reinforce: styles.enhance,
  amplify: styles.amplify,
  refine: styles.refine,
  enchant: styles.enchant
}

export function Heading({ title, count }: { title: string; count?: number }): React.JSX.Element {
  return (
    <h2 {...stylex.props(styles.heading)}>
      {title}
      {count !== undefined && <span {...stylex.props(styles.headingCount)}>{count}</span>}
    </h2>
  )
}

function Arrow(): React.JSX.Element {
  return (
    <span aria-label="에서" {...stylex.props(styles.arrow)}>
      →
    </span>
  )
}

function FieldChange({ change }: { change: HistoryFieldChange }): React.JSX.Element {
  const { field, name, before, after } = change

  return (
    <>
      <span {...stylex.props(styles.changeField)}>{FIELD_LABELS[field]}</span>
      {name !== null && <span {...stylex.props(styles.changeOption)}>{name}</span>}
      <span {...stylex.props(styles.before)}>{formatFieldValue(field, before)}</span>
      <Arrow />
      <span {...stylex.props(styles.after, AFTER_TONES[field])}>
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
          <span {...stylex.props(styles.before)}>{replaced.itemName}</span>
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
        <li {...stylex.props(styles.change)}>
          <span {...stylex.props(styles.changeSlot)}>{item.slotName}</span>
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
        <li {...stylex.props(styles.change)}>
          <span {...stylex.props(styles.changeSlot)}>{ARTIFACT_PART}</span>
          <ReplacedItem {...item} />
        </li>
      )
    case 'set':
      return (
        <li {...stylex.props(styles.change)}>
          <span {...stylex.props(styles.changeSlot)}>{SET_PART}</span>
          <b {...stylex.props(styles.after)}>{item.setItemName}</b>
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
        <ul {...stylex.props(styles.changes)}>
          <li {...stylex.props(styles.change, styles.first)}>첫 기록</li>
        </ul>
      </>
    )
  }

  return (
    <>
      <Heading title="변경점" count={point.items.length} />
      <ul {...stylex.props(styles.changes)}>
        {point.items.map((item) => (
          <ChangeLine key={changeKey(item)} item={item} />
        ))}
      </ul>
      {point.unchanged.length > 0 && (
        <>
          <Heading title="그대로" />
          <ul {...stylex.props(styles.unchanged)}>
            {point.unchanged.map((label) => (
              <li key={label} {...stylex.props(styles.chip)}>
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
      <table {...stylex.props(styles.table)}>
        <thead>
          <tr>
            <th scope="col" {...stylex.props(styles.th, styles.thTime)}>
              일시
            </th>
            <th scope="col" {...stylex.props(styles.th, styles.thKind)}>
              종류
            </th>
            <th scope="col" {...stylex.props(styles.th, styles.tdName)}>
              이름
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.toReversed().map(({ kind, at, before, after }, index) => (
            <tr key={`${index}-${kind}-${at}`} {...stylex.props(styles.row)}>
              <td {...stylex.props(styles.td, styles.tdTime)}>{formatSeoulFullDateTime(at)}</td>
              <td {...stylex.props(styles.td)}>
                <span {...stylex.props(styles.kind)}>{NAME_CHANGE_LABELS[kind]}</span>
              </td>
              <td {...stylex.props(styles.td, styles.tdName)}>
                <span {...stylex.props(styles.nameBefore)}>{before}</span>
                <span aria-label="에서" {...stylex.props(styles.nameArrow)}>
                  →
                </span>
                <span
                  {...stylex.props(styles.nameAfter, kind === 'adventure' && styles.adventureAfter)}
                >
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
