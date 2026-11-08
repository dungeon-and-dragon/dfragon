import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { Link } from '@tanstack/react-router'
import type { ReactNode, Ref } from 'react'
import { MISSING_VALUE } from '#core/constants/cards'
import type { StoredCharacter } from '#core/shared/ranking/ranking-stats'
import { CharacterCell, type CharacterCellCharacter } from './CharacterCell'
import { styles } from './CharacterTable.style'
import { RankBadge } from './RankBadge'

const integer = new Intl.NumberFormat('ko-KR')

export type CharacterTableRow = CharacterCellCharacter &
  Pick<StoredCharacter, 'fame' | 'guildId' | 'guildName'> & {
    adventureName: string | null
    rank?: number
  }

export type CharacterTableAction = {
  name: string
  render: (row: CharacterTableRow) => ReactNode
}

export type Affiliation = 'adventure' | 'guild'

const ALL_AFFILIATIONS: readonly Affiliation[] = ['adventure', 'guild']
const AFFILIATION_HEADINGS: Record<Affiliation, string> = { adventure: '모험단', guild: '길드' }

export function CharacterTable({
  rows,
  ranked = true,
  action,
  trailing,
  affiliations = ALL_AFFILIATIONS,
  adventureBesideName = false
}: {
  rows: readonly CharacterTableRow[]
  ranked?: boolean
  action?: CharacterTableAction
  trailing?: ReactNode
  affiliations?: readonly Affiliation[]
  adventureBesideName?: boolean
}): React.JSX.Element {
  return (
    <table {...stylex.props(styles.table)}>
      <colgroup>
        {ranked && <col {...stylex.props(styles.rankColumn)} />}
        <col />
        <col {...stylex.props(styles.fameColumn)} />
        {affiliations.map((affiliation) => (
          <col key={affiliation} {...stylex.props(styles.affiliationColumn)} />
        ))}
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
          {affiliations.map((affiliation) => (
            <th key={affiliation} scope="col" {...stylex.props(styles.headCell, styles.center)}>
              {AFFILIATION_HEADINGS[affiliation]}
            </th>
          ))}
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
              <CharacterCell
                character={row}
                adventureName={adventureBesideName ? row.adventureName : null}
              />
            </td>
            <td {...stylex.props(styles.cell, styles.right, styles.fame)}>
              {row.fame != null ? integer.format(row.fame) : MISSING_VALUE}
            </td>
            {affiliations.map((affiliation) => (
              <td
                key={affiliation}
                {...stylex.props(styles.cell, styles.center, styles.affiliation)}
              >
                <AffiliationLink affiliation={affiliation} character={row} />
              </td>
            ))}
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

function AffiliationLink({
  affiliation,
  character
}: {
  affiliation: Affiliation
  character: CharacterTableRow
}): React.JSX.Element | string {
  if (affiliation === 'adventure') {
    if (character.adventureName == null) {
      return MISSING_VALUE
    }

    return (
      <Link
        to="/adventures/$adventureName"
        params={{ adventureName: character.adventureName }}
        {...stylex.props(styles.link)}
      >
        {character.adventureName}
      </Link>
    )
  }

  if (character.guildName == null) {
    return MISSING_VALUE
  }

  if (character.guildId == null) {
    return character.guildName
  }

  return (
    <Link
      to="/guilds/$guildId"
      params={{ guildId: character.guildId }}
      {...stylex.props(styles.link)}
    >
      {character.guildName}
    </Link>
  )
}

export function SkeletonRow({
  rowRef,
  ranked = true,
  affiliations = ALL_AFFILIATIONS
}: {
  rowRef?: Ref<HTMLTableRowElement>
  ranked?: boolean
  affiliations?: readonly Affiliation[]
}): React.JSX.Element {
  return (
    <tr ref={rowRef} aria-hidden="true">
      {ranked && (
        <td {...stylex.props(styles.cell, styles.center)}>
          <Bone width={24} height={20} />
        </td>
      )}
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
      {affiliations.map((affiliation) => (
        <td key={affiliation} {...stylex.props(styles.cell)} />
      ))}
    </tr>
  )
}

function Bone({ width, height }: { width: number; height: number }): React.JSX.Element {
  return <span {...stylex.props(styles.bone, styles.boneSize(width, height))} />
}
