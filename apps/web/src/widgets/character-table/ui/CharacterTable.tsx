import { ChevronDownIcon } from '@dfragon/ui'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { CharacterPage, ListScore } from '#entities/character'
import type { StoredCharacter } from '#entities/ranking'
import { CharacterCell, type CharacterCellCharacter } from './CharacterCell'
import { RankNumber } from './RankNumber'
import { ScoreLine, ScoreValue } from './ScoreValue'

const integer = new Intl.NumberFormat('ko-KR')

export type CharacterTableRow = CharacterCellCharacter &
  Pick<StoredCharacter, 'fame' | 'guildId' | 'guildName'> & {
    adventureName: string | null
    rank?: number
    score?: ListScore
  }

export type CharacterTableAction = {
  render: (row: CharacterTableRow) => ReactNode
}

export type Affiliation = 'adventure' | 'guild'

export type ScorePlacement = 'column' | 'belowFame'

export type SortedColumn = 'fame' | 'score'

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
// 종류 글자와 일곱 자리 점수(1,999,999)가 셀 여백 안에 들어가는 폭이다.
export const SCORE_COLUMN = 'w-[136px]'
// 모험단, 길드 이름도 캐릭터 이름처럼 12바이트 제한이라고 보고 한글 6자가 다 들어가게 잡는다.
const AFFILIATION_COLUMN = 'w-[128px]'
const DETAIL_COLUMN = 'w-[160px] max-sm:hidden'
// 두 줄 값도 행을 48px보다 높이지 않게 초상화 칸처럼 위아래 여백을 두지 않는다.
const DETAIL_CELL = 'py-0 max-sm:hidden'

// 600px 미만에서는 명성, 점수, 모험단, 길드 열을 숨기고 명성과 점수를 캐릭터 칸 둘째 줄에 둔다.
const WIDE_ONLY = 'max-sm:hidden'

const ALL_AFFILIATIONS: readonly Affiliation[] = ['adventure', 'guild']
const AFFILIATION_HEADINGS: Record<Affiliation, string> = { adventure: '모험단', guild: '길드' }

export function CharacterTable<Row extends CharacterTableRow>({
  rows,
  ranked = true,
  rankOnNarrow = true,
  detail,
  action,
  trailing,
  affiliations = ALL_AFFILIATIONS,
  adventureBesideName = false,
  scorePlacement,
  sortedBy,
  characterPage
}: {
  rows: readonly Row[]
  ranked?: boolean
  rankOnNarrow?: boolean
  scorePlacement?: ScorePlacement
  sortedBy?: SortedColumn
  detail?: CharacterTableDetail<Row>
  action?: CharacterTableAction
  trailing?: ReactNode
  affiliations?: readonly Affiliation[]
  adventureBesideName?: boolean
  characterPage?: CharacterPage
}): React.JSX.Element {
  const rankClass = rankOnNarrow ? '' : WIDE_ONLY

  return (
    <div className="table-scroll">
      <table
        className={`table table-fixed${affiliations.length > 0 ? ' table-wide max-sm:min-w-0' : ''}`}
      >
        <colgroup>
          {ranked && <col className={`${RANK_COLUMN} ${rankClass}`} />}
          <col />
          {detail != null && <col className={DETAIL_COLUMN} />}
          <col className={`${FAME_COLUMN} ${WIDE_ONLY}`} />
          {scorePlacement === 'column' && <col className={`${SCORE_COLUMN} ${WIDE_ONLY}`} />}
          {affiliations.map((affiliation) => (
            <col key={affiliation} className={`${AFFILIATION_COLUMN} ${WIDE_ONLY}`} />
          ))}
          {action != null && <col className="w-[56px]" />}
        </colgroup>
        <thead>
          <tr>
            {ranked && (
              <th scope="col" className={`table-num ${rankClass}`}>
                #
              </th>
            )}
            <th scope="col">캐릭터</th>
            {detail != null && (
              <th scope="col" className={DETAIL_CELL}>
                {detail.name}
              </th>
            )}
            <NumberHeading label="명성" sorted={sortedBy === 'fame'} className={WIDE_ONLY} />
            {scorePlacement === 'column' && (
              <NumberHeading label="점수" sorted={sortedBy === 'score'} className={WIDE_ONLY} />
            )}
            {affiliations.map((affiliation) => (
              <th key={affiliation} scope="col" className={`text-center ${WIDE_ONLY}`}>
                {AFFILIATION_HEADINGS[affiliation]}
              </th>
            ))}
            {action != null && <th scope="col" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.serverId}/${row.characterId}`}>
              {ranked && (
                <td className={`table-num ${rankClass}`}>
                  {row.rank != null && <RankNumber rank={row.rank} />}
                </td>
              )}
              <td className={PORTRAIT_CELL}>
                <CharacterCell
                  character={row}
                  adventureName={adventureBesideName ? row.adventureName : null}
                  characterPage={characterPage}
                  narrowStats={
                    <NarrowStats
                      fame={row.fame}
                      score={row.score}
                      showsScore={scorePlacement != null}
                      adventure={
                        affiliations.includes('adventure') && !adventureBesideName ? row : undefined
                      }
                    />
                  }
                />
              </td>
              {detail != null && <td className={DETAIL_CELL}>{detail.render(row)}</td>}
              {scorePlacement === 'belowFame' ? (
                <td className={`table-num py-0 ${WIDE_ONLY}`}>
                  <span className="flex flex-col items-end">
                    <span className="num font-semibold leading-4 text-game-fame">
                      {row.fame != null ? integer.format(row.fame) : MISSING_VALUE}
                    </span>
                    <ScoreLine score={row.score} />
                  </span>
                </td>
              ) : (
                <td className={`${FAME_CELL} ${WIDE_ONLY}`}>
                  {row.fame != null ? integer.format(row.fame) : MISSING_VALUE}
                </td>
              )}
              {scorePlacement === 'column' && (
                <td className={`table-num ${WIDE_ONLY}`}>
                  <ScoreValue score={row.score} />
                </td>
              )}
              {affiliations.map((affiliation) => (
                <td key={affiliation} className={`text-center text-fg-adventure ${WIDE_ONLY}`}>
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

function NumberHeading({
  label,
  sorted,
  className = ''
}: {
  label: string
  sorted: boolean
  className?: string
}): React.JSX.Element {
  if (!sorted) {
    return (
      <th scope="col" className={`table-num ${className}`}>
        {label}
      </th>
    )
  }

  return (
    <th scope="col" aria-sort="descending" className={`table-num ${className}`}>
      <span className="inline-flex items-center gap-1 text-fg">
        {label}
        <ChevronDownIcon className="size-icon-sm" />
      </span>
    </th>
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
  ranked = true,
  rankOnNarrow = true,
  detail = false,
  scorePlacement,
  affiliations = ALL_AFFILIATIONS
}: {
  ranked?: boolean
  rankOnNarrow?: boolean
  detail?: boolean
  scorePlacement?: ScorePlacement
  affiliations?: readonly Affiliation[]
}): React.JSX.Element {
  return (
    <tr aria-hidden="true">
      {ranked && (
        <td className={rankOnNarrow ? undefined : WIDE_ONLY}>
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
      <td className={WIDE_ONLY}>
        <span className="skeleton-text ml-auto w-[56px]" />
        {scorePlacement === 'belowFame' && <span className="skeleton-text mt-1 ml-auto w-[48px]" />}
      </td>
      {scorePlacement === 'column' && (
        <td className={WIDE_ONLY}>
          <span className="skeleton-text ml-auto w-[88px]" />
        </td>
      )}
      {affiliations.map((affiliation) => (
        <td key={affiliation} className={WIDE_ONLY}>
          <span className="skeleton-text mx-auto w-[56px]" />
        </td>
      ))}
    </tr>
  )
}

// 600px 미만에서 캐릭터 칸 둘째 줄에 두는 명성, 점수, 모험단이다. 점수는 색으로 장비, 버프를 구분한다.
export function NarrowStats({
  fame,
  score,
  showsScore = true,
  adventure
}: {
  fame: number | null
  score?: ListScore
  showsScore?: boolean
  adventure?: CharacterTableRow
}): React.JSX.Element {
  return (
    <>
      <span className="num font-semibold text-game-fame">
        {fame != null ? integer.format(fame) : MISSING_VALUE}
      </span>
      {showsScore && (
        <>
          <span aria-hidden="true" className="h-[10px] w-px bg-line-strong" />
          <ScoreLine score={score} />
        </>
      )}
      {adventure !== undefined && (
        <>
          <span aria-hidden="true" className="h-[10px] w-px bg-line-strong" />
          <span className="min-w-0 truncate text-fg-adventure">
            <AffiliationLink affiliation="adventure" character={adventure} />
          </span>
        </>
      )}
    </>
  )
}
