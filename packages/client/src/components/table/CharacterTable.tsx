import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode, Ref } from 'react'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import type { StoredCharacter } from '@dfragon/client-core/shared/ranking/ranking-stats'
import { CharacterCell, type CharacterCellCharacter } from './CharacterCell'
import { styles } from './CharacterTable.style'
import { RankBadge } from './RankBadge'

const integer = new Intl.NumberFormat('ko-KR')

export type CharacterTableRow = CharacterCellCharacter &
  Pick<StoredCharacter, 'fame' | 'guildName'> & {
    adventureName: string | null
    rank?: number
  }

export type CharacterTableAction = {
  name: string
  render: (row: CharacterTableRow) => ReactNode
}

export function CharacterTable({
  rows,
  ranked = true,
  action,
  trailing
}: {
  rows: readonly CharacterTableRow[]
  ranked?: boolean
  action?: CharacterTableAction
  trailing?: ReactNode
}): React.JSX.Element {
  return (
    <table {...stylex.props(styles.table)}>
      <colgroup>
        {ranked && <col {...stylex.props(styles.rankColumn)} />}
        <col />
        <col {...stylex.props(styles.fameColumn)} />
        <col {...stylex.props(styles.affiliationColumn)} />
        <col {...stylex.props(styles.affiliationColumn)} />
        {action != null && <col {...stylex.props(styles.actionColumn)} />}
      </colgroup>
      <thead>
        <tr>
          {ranked && (
            <th scope="col" {...stylex.props(styles.headCell, styles.center)}>
              #
            </th>
          )}
          <th scope="col" {...stylex.props(styles.headCell)}>
            캐릭터
          </th>
          <th scope="col" {...stylex.props(styles.headCell, styles.right)}>
            명성
          </th>
          <th scope="col" {...stylex.props(styles.headCell, styles.center)}>
            모험단
          </th>
          <th scope="col" {...stylex.props(styles.headCell, styles.center)}>
            길드
          </th>
          {action != null && (
            <th scope="col" {...stylex.props(styles.headCell)}>
              <span {...stylex.props(shapes.srOnly)}>{action.name}</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.serverId}/${row.characterId}`}>
            {ranked && (
              <td {...stylex.props(styles.cell, styles.center)}>
                {row.rank != null && <RankBadge rank={row.rank} />}
              </td>
            )}
            <td {...stylex.props(styles.cell)}>
              <CharacterCell character={row} />
            </td>
            <td {...stylex.props(styles.cell, styles.right, styles.fame)}>
              {row.fame != null ? integer.format(row.fame) : MISSING_VALUE}
            </td>
            <td {...stylex.props(styles.cell, styles.center, styles.affiliation)}>
              {row.adventureName ?? MISSING_VALUE}
            </td>
            <td {...stylex.props(styles.cell, styles.center, styles.affiliation)}>
              {row.guildName ?? MISSING_VALUE}
            </td>
            {action != null && (
              <td {...stylex.props(styles.cell, styles.center)}>{action.render(row)}</td>
            )}
          </tr>
        ))}
        {trailing}
      </tbody>
    </table>
  )
}

export function SkeletonRow({ rowRef }: { rowRef?: Ref<HTMLTableRowElement> }): React.JSX.Element {
  return (
    <tr ref={rowRef} aria-hidden="true">
      <td {...stylex.props(styles.cell, styles.center)}>
        <Bone width={24} height={20} />
      </td>
      <td {...stylex.props(styles.cell)}>
        <div {...stylex.props(styles.boneCharacter)}>
          <Bone width={40} height={48} />
          <div {...stylex.props(styles.boneLines)}>
            <Bone width={140} height={14} />
            <Bone width={96} height={12} />
          </div>
        </div>
      </td>
      <td {...stylex.props(styles.cell)}>
        <Bone width={64} height={14} />
      </td>
      <td {...stylex.props(styles.cell)} />
      <td {...stylex.props(styles.cell)} />
    </tr>
  )
}

function Bone({ width, height }: { width: number; height: number }): React.JSX.Element {
  return <span {...stylex.props(styles.bone, styles.boneSize(width, height))} />
}
