import { CheckIcon } from '@dfragon/ui'
import type { ReactNode } from 'react'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { ClearName, WeeklyCharacter } from '#entities/adventure-guild'
import type { OathCatalog } from '#entities/catalog'
import {
  CharacterCell,
  FAME_COLUMN,
  NarrowStats,
  RANK_COLUMN,
  RankNumber,
  SCORE_COLUMN,
  ScoreValue
} from '#widgets/character-table'
import { RankingSetLines } from '#widgets/ranking-filter'
import { WIDE_STICKY_HEAD, WIDE_STICKY_HEAD_CELL } from './sticky-head'

const integer = new Intl.NumberFormat('ko-KR')

// 열이 좁아 레이드 이름을 줄여 쓴다. 클리어 판정은 API가 보낸 원래 이름으로 한다.
const SHORT_CLEAR_NAMES: Readonly<Record<string, string | undefined>> = {
  '디레지에 레이드': '디레지에',
  '무너진 성자 미카엘라': '미카엘라'
}

// 검색 화면의 세트 열과 같은 폭이다.
const SET_COLUMN = 'w-[160px] max-sm:hidden'
const SET_CELL = 'py-0 max-sm:hidden'

function clearLabel(name: string): string {
  const shortName = SHORT_CLEAR_NAMES[name]
  if (shortName !== undefined) {
    return shortName
  }

  return name
}

function isCleared(character: WeeklyCharacter, clearName: ClearName): boolean {
  return character.weeklyClears.some(
    (clear) => clear.kind === clearName.kind && clear.name === clearName.name
  )
}

export function WeeklyClearTable({
  clearNames,
  rows,
  catalog,
  trailing
}: {
  clearNames: readonly ClearName[]
  rows: readonly WeeklyCharacter[]
  catalog: OathCatalog | null
  trailing?: ReactNode
}): React.JSX.Element {
  return (
    <table className="table table-fixed table-wide">
      <colgroup>
        <col className={`${RANK_COLUMN} max-sm:hidden`} />
        <col />
        <col className={SET_COLUMN} />
        <col className={`${FAME_COLUMN} max-sm:hidden`} />
        <col className={`${SCORE_COLUMN} max-sm:hidden`} />
        {clearNames.map(({ kind, name }) => (
          <col key={`${kind}/${name}`} className="w-[96px]" />
        ))}
      </colgroup>
      <thead className={WIDE_STICKY_HEAD}>
        <tr>
          <th scope="col" className={`table-num max-sm:hidden ${WIDE_STICKY_HEAD_CELL}`}>
            #
          </th>
          <th scope="col" className={WIDE_STICKY_HEAD_CELL}>
            캐릭터
          </th>
          <th scope="col" className={`max-sm:hidden ${WIDE_STICKY_HEAD_CELL}`}>
            세트
          </th>
          <th scope="col" className={`table-num max-sm:hidden ${WIDE_STICKY_HEAD_CELL}`}>
            명성
          </th>
          <th scope="col" className={`table-num max-sm:hidden ${WIDE_STICKY_HEAD_CELL}`}>
            점수
          </th>
          {clearNames.map(({ kind, name }) => (
            <th
              key={`${kind}/${name}`}
              scope="col"
              className={`text-center ${WIDE_STICKY_HEAD_CELL}`}
            >
              {clearLabel(name)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.serverId}/${row.characterId}`}>
            <td className="table-num max-sm:hidden">
              <RankNumber rank={index + 1} />
            </td>
            {/* 초상화가 셀 위아래 여백과 합쳐 행을 48px보다 높이지 않게 이 칸만 위아래 여백을 두지 않는다. */}
            <td className="py-0">
              <CharacterCell
                character={row}
                narrowStats={<NarrowStats fame={row.fame} score={row.score} />}
              />
            </td>
            <td className={SET_CELL}>
              <RankingSetLines character={row} catalog={catalog} />
            </td>
            <td className="table-num font-semibold text-game-fame max-sm:hidden">
              {row.fame != null ? integer.format(row.fame) : MISSING_VALUE}
            </td>
            <td className="table-num max-sm:hidden">
              <ScoreValue score={row.score} />
            </td>
            {clearNames.map((clearName) => (
              <td key={`${clearName.kind}/${clearName.name}`} className="text-center">
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
        <CheckIcon className="inline-block size-icon-sm align-middle text-fg-success" />
      ) : (
        <span
          aria-hidden="true"
          className="box-border inline-block size-4 rounded-control border border-dashed border-line-input align-middle"
        />
      )}
      <span className="sr-only">{cleared ? '클리어' : '클리어 안 함'}</span>
    </>
  )
}
