import { Link } from '@tanstack/react-router'
import type { ReactNode, Ref } from 'react'
import { MISSING_VALUE } from '#core/capture'
import type { StoredCharacter } from '#core/ranking'
import { CharacterCell, type CharacterCellCharacter } from './CharacterCell'
import { RankNumber } from './RankNumber'

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

export type CharacterTableDetail<Row> = {
  name: string
  render: (row: Row) => ReactNode
}

// 초상화가 셀 위아래 여백과 합쳐 행을 48px보다 높이지 않게 이 칸만 위아래 여백을 두지 않는다.
const PORTRAIT_CELL = 'py-0'
const FAME_CELL = 'table-num font-semibold text-game-fame'
// 순위는 여섯 자리(123456), 명성은 일곱 자리(1,999,999)까지 셀 여백 안에 들어가는 폭이다.
export const RANK_COLUMN = 'w-[76px]'
export const FAME_COLUMN = 'w-[96px]'
// 모험단, 길드 이름도 캐릭터 이름처럼 12바이트 제한이라고 보고 한글 6자가 다 들어가게 잡는다.
const AFFILIATION_COLUMN = 'w-[128px]'
const DETAIL_COLUMN = 'w-[160px] max-sm:hidden'
// 두 줄 값도 행을 48px보다 높이지 않게 초상화 칸처럼 위아래 여백을 두지 않는다.
const DETAIL_CELL = 'py-0 max-sm:hidden'

const ALL_AFFILIATIONS: readonly Affiliation[] = ['adventure', 'guild']
const AFFILIATION_HEADINGS: Record<Affiliation, string> = { adventure: '모험단', guild: '길드' }

export function CharacterTable<Row extends CharacterTableRow>({
  rows,
  ranked = true,
  detail,
  action,
  trailing,
  affiliations = ALL_AFFILIATIONS,
  adventureBesideName = false
}: {
  rows: readonly Row[]
  ranked?: boolean
  detail?: CharacterTableDetail<Row>
  action?: CharacterTableAction
  trailing?: ReactNode
  affiliations?: readonly Affiliation[]
  adventureBesideName?: boolean
}): React.JSX.Element {
  return (
    <div className="table-scroll">
      <table className={`table table-fixed${affiliations.length > 0 ? ' table-wide' : ''}`}>
        <colgroup>
          {ranked && <col className={RANK_COLUMN} />}
          <col />
          {detail != null && <col className={DETAIL_COLUMN} />}
          <col className={FAME_COLUMN} />
          {affiliations.map((affiliation) => (
            <col key={affiliation} className={AFFILIATION_COLUMN} />
          ))}
          {action != null && <col className="w-[56px]" />}
        </colgroup>
        <thead>
          <tr>
            {ranked && (
              <th scope="col" className="table-num">
                #
              </th>
            )}
            <th scope="col">캐릭터</th>
            {detail != null && (
              <th scope="col" className={DETAIL_CELL}>
                {detail.name}
              </th>
            )}
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
                <td className="table-num">{row.rank != null && <RankNumber rank={row.rank} />}</td>
              )}
              <td className={PORTRAIT_CELL}>
                <CharacterCell
                  character={row}
                  adventureName={adventureBesideName ? row.adventureName : null}
                />
              </td>
              {detail != null && <td className={DETAIL_CELL}>{detail.render(row)}</td>}
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
        className="link"
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
    <Link to="/guilds/$guildId" params={{ guildId: character.guildId }} className="link">
      {character.guildName}
    </Link>
  )
}

export function SkeletonRow({
  rowRef,
  ranked = true,
  detail = false,
  affiliations = ALL_AFFILIATIONS
}: {
  rowRef?: Ref<HTMLTableRowElement>
  ranked?: boolean
  detail?: boolean
  affiliations?: readonly Affiliation[]
}): React.JSX.Element {
  return (
    <tr ref={rowRef} aria-hidden="true">
      {ranked && (
        <td>
          <span className="skeleton-text ml-auto w-[12px]" />
        </td>
      )}
      <td className={PORTRAIT_CELL}>
        <div className="flex items-center gap-3">
          <span className="skeleton portrait-sm" />
          <span className="skeleton-text w-[88px]" />
        </div>
      </td>
      {detail && (
        <td className={DETAIL_CELL}>
          <span className="skeleton-text w-[56px]" />
        </td>
      )}
      <td>
        <span className="skeleton-text ml-auto w-[56px]" />
      </td>
      {affiliations.map((affiliation) => (
        <td key={affiliation}>
          <span className="skeleton-text mx-auto w-[56px]" />
        </td>
      ))}
    </tr>
  )
}
