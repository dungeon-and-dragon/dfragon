import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import type {
  ClearName,
  WeeklyCharacter
} from '@dfragon/client-core/shared/adventure/adventure-weekly'
import { CheckIcon } from '../../components/CheckIcon'
import { CharacterCell } from '../../components/table/CharacterCell'
import { styles as tableStyles } from '../../components/table/CharacterTable.style'
import { RankBadge } from '../../components/table/RankBadge'
import { styles } from './WeeklyScreen.style'

const integer = new Intl.NumberFormat('ko-KR')

const CLEAR_KINDS = [
  { kind: 'raid', label: '레이드' },
  { kind: 'legion', label: '레기온' }
] as const

function isCleared(character: WeeklyCharacter, clearName: ClearName): boolean {
  return character.weeklyClears.some(
    (clear) => clear.kind === clearName.kind && clear.name === clearName.name
  )
}

export function WeeklyClearTable({
  clearNames,
  rows,
  trailing
}: {
  clearNames: readonly ClearName[]
  rows: readonly WeeklyCharacter[]
  trailing?: ReactNode
}): React.JSX.Element {
  const groups = CLEAR_KINDS.map(({ kind, label }) => ({
    label,
    span: clearNames.filter((clearName) => clearName.kind === kind).length
  })).filter(({ span }) => span > 0)
  const headRows = clearNames.length > 0 ? 2 : 1

  return (
    <table {...stylex.props(tableStyles.table)}>
      <colgroup>
        <col {...stylex.props(tableStyles.rankColumn)} />
        <col />
        <col {...stylex.props(tableStyles.fameColumn)} />
        {clearNames.map(({ kind, name }) => (
          <col key={`${kind}/${name}`} {...stylex.props(styles.clearColumn)} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th
            scope="col"
            rowSpan={headRows}
            {...stylex.props(tableStyles.headCell, tableStyles.center)}
          >
            #
          </th>
          <th scope="col" rowSpan={headRows} {...stylex.props(tableStyles.headCell)}>
            캐릭터
          </th>
          <th
            scope="col"
            rowSpan={headRows}
            {...stylex.props(tableStyles.headCell, tableStyles.right)}
          >
            명성
          </th>
          {groups.map(({ label, span }) => (
            <th
              key={label}
              scope="colgroup"
              colSpan={span}
              {...stylex.props(tableStyles.headCell, tableStyles.center)}
            >
              {label}
            </th>
          ))}
        </tr>
        {clearNames.length > 0 && (
          <tr>
            {clearNames.map(({ kind, name }) => (
              <th
                key={`${kind}/${name}`}
                scope="col"
                {...stylex.props(tableStyles.headCell, tableStyles.center, styles.clearName)}
              >
                {name}
              </th>
            ))}
          </tr>
        )}
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.serverId}/${row.characterId}`}>
            <td {...stylex.props(tableStyles.cell, tableStyles.center)}>
              <RankBadge rank={index + 1} />
            </td>
            <td {...stylex.props(tableStyles.cell)}>
              <CharacterCell character={row} />
            </td>
            <td {...stylex.props(tableStyles.cell, tableStyles.right, tableStyles.fame)}>
              {row.fame != null ? integer.format(row.fame) : MISSING_VALUE}
            </td>
            {clearNames.map((clearName) => (
              <td
                key={`${clearName.kind}/${clearName.name}`}
                {...stylex.props(tableStyles.cell, tableStyles.center)}
              >
                <ClearMark cleared={isCleared(row, clearName)} />
              </td>
            ))}
          </tr>
        ))}
        {trailing}
      </tbody>
    </table>
  )
}

function ClearMark({ cleared }: { cleared: boolean }): React.JSX.Element {
  return (
    <>
      {cleared ? (
        <CheckIcon {...stylex.props(styles.check)} />
      ) : (
        <span aria-hidden="true" {...stylex.props(styles.blank)} />
      )}
      <span {...stylex.props(shapes.srOnly)}>{cleared ? '클리어' : '클리어 안 함'}</span>
    </>
  )
}
