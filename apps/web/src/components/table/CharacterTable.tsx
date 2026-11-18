import { Link } from '@tanstack/react-router'
import type { ReactNode, Ref } from 'react'
import { MISSING_VALUE } from '#core/capture/cards'
import type { StoredCharacter } from '#core/ranking/ranking-stats'
import { CharacterCell, type CharacterCellCharacter } from './CharacterCell'
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

const link = 'text-inherit no-underline hover:underline'
// 초상화(36px)가 셀 위아래 여백과 합쳐 행을 48px보다 높이지 않게 이 칸만 위아래 여백을 두지 않는다.
const PORTRAIT_CELL = 'py-0'
const FAME_CELL = 'table-num font-semibold text-game-fame'

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
    <div className="table-scroll">
      <table className={`table table-fixed${affiliations.length > 0 ? ' table-wide' : ''}`}>
        <colgroup>
          {ranked && <col className="w-16" />}
          <col />
          <col className="w-[120px]" />
          {affiliations.map((affiliation) => (
            <col key={affiliation} className="w-[160px]" />
          ))}
          {action != null && <col className="w-[56px]" />}
        </colgroup>
        <thead>
          <tr>
            {ranked && (
              <th scope="col" className="text-center">
                #
              </th>
            )}
            <th scope="col">캐릭터</th>
            <th scope="col" className="table-num">
              명성
            </th>
            {affiliations.map((affiliation) => (
              <th key={affiliation} scope="col" className="text-center">
                {AFFILIATION_HEADINGS[affiliation]}
              </th>
            ))}
            {action != null && (
              <th scope="col">
                <span className="sr-only">{action.name}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.serverId}/${row.characterId}`}>
              {ranked && (
                <td className="text-center">{row.rank != null && <RankBadge rank={row.rank} />}</td>
              )}
              <td className={PORTRAIT_CELL}>
                <CharacterCell
                  character={row}
                  adventureName={adventureBesideName ? row.adventureName : null}
                />
              </td>
              <td className={FAME_CELL}>
                {row.fame != null ? integer.format(row.fame) : MISSING_VALUE}
              </td>
              {affiliations.map((affiliation) => (
                <td key={affiliation} className="text-center text-fg-adventure">
                  <AffiliationLink affiliation={affiliation} character={row} />
                </td>
              ))}
              {action != null && <td className="text-center">{action.render(row)}</td>}
            </tr>
          ))}
          {trailing}
        </tbody>
      </table>
    </div>
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
        className={link}
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
    <Link to="/guilds/$guildId" params={{ guildId: character.guildId }} className={link}>
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
        <td className="text-center">
          <Bone width={24} height={20} />
        </td>
      )}
      <td className={PORTRAIT_CELL}>
        <div className="flex items-center gap-3">
          <Bone width={32} height={36} />
          <div className="flex flex-col gap-2">
            <Bone width={140} height={14} />
            <Bone width={96} height={12} />
          </div>
        </div>
      </td>
      <td>
        <Bone width={64} height={14} />
      </td>
      {affiliations.map((affiliation) => (
        <td key={affiliation} />
      ))}
    </tr>
  )
}

function Bone({ width, height }: { width: number; height: number }): React.JSX.Element {
  return <span className="block rounded-control bg-inset" style={{ width, height }} />
}
