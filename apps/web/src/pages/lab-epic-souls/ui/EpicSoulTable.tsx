import { ChevronDownIcon, ChevronRightIcon, IconButton } from '@dfragon/ui'
import { useState } from 'react'
import type { AdventureCharacter } from '#entities/adventure-guild'
import type { OathCatalog } from '#entities/catalog'
import { formatCount } from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import {
  CharacterCell,
  FAME_COLUMN,
  NarrowStats,
  SCORE_COLUMN,
  ScoreValue
} from '#widgets/character-table'
import { RankingSetLines } from '#widgets/ranking-filter'
import {
  type EpicSoulRecoveryResult,
  useEpicSoulRecoveries
} from '#pages/lab-epic-souls/api/useEpicSoulRecoveries'
import { EpicSoulSlotTable } from './EpicSoulSlotTable'

const EDGE_CELL = 'px-0'
// 검색 화면의 세트 열과 같은 폭이다.
const SET_COLUMN = 'w-[160px] max-sm:hidden'
const SET_CELL = 'py-0 max-sm:hidden'
// 600px 미만에서는 세트, 명성, 점수 열을 숨기고 명성과 점수를 캐릭터 칸 둘째 줄에 둔다.
const WIDE_ONLY = 'max-sm:hidden'
const SPANNED_COLUMNS = 5

export function EpicSoulTable({
  characters,
  catalog
}: {
  characters: readonly AdventureCharacter[]
  catalog: OathCatalog | null
}): React.JSX.Element {
  const results = useEpicSoulRecoveries(characters)
  const total = results.reduce((sum, result) => {
    if (result.status !== 'success') {
      return sum
    }

    return sum + result.souls.total
  }, 0)

  return (
    <div className="table-scroll">
      <table className="table table-fixed table-wide max-sm:min-w-0">
        <colgroup>
          <col className="w-[36px]" />
          <col />
          <col className={SET_COLUMN} />
          <col className={`${FAME_COLUMN} ${WIDE_ONLY}`} />
          <col className={`${SCORE_COLUMN} ${WIDE_ONLY}`} />
          <col className={SCORE_COLUMN} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={EDGE_CELL}>
              <span className="sr-only">펼치기</span>
            </th>
            <th scope="col">캐릭터</th>
            <th scope="col" className={WIDE_ONLY}>
              세트
            </th>
            <th scope="col" className={`table-num ${WIDE_ONLY}`}>
              명성
            </th>
            <th scope="col" className={`table-num ${WIDE_ONLY}`}>
              점수
            </th>
            <th scope="col" className="table-num">
              에픽 소울
            </th>
          </tr>
        </thead>
        <tbody>
          {characters.map((character, index) => (
            <CharacterRows
              key={`${character.serverId}/${character.characterId}`}
              character={character}
              catalog={catalog}
              result={results[index] ?? { status: 'loading' }}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={EDGE_CELL} />
            <th scope="row">합계</th>
            <td className={WIDE_ONLY} />
            <td className={WIDE_ONLY} />
            <td className={WIDE_ONLY} />
            <td className="table-num font-bold">{formatCount(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function CharacterRows({
  character,
  catalog,
  result
}: {
  character: AdventureCharacter
  catalog: OathCatalog | null
  result: EpicSoulRecoveryResult
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const slots = result.status === 'success' ? result.souls.slots : []
  const expandable = slots.length > 0

  function toggle(): void {
    setExpanded((value) => !value)
  }

  return (
    <>
      <tr>
        <td className={`${EDGE_CELL} text-center`}>
          {expandable && (
            <IconButton
              size="sm"
              aria-expanded={expanded}
              aria-label={`${character.characterName} 부위별 에픽 소울`}
              icon={
                expanded ? (
                  <ChevronDownIcon className="size-icon-sm" />
                ) : (
                  <ChevronRightIcon className="size-icon-sm" />
                )
              }
              onClick={toggle}
            />
          )}
        </td>
        {/* 초상화가 셀 위아래 여백과 합쳐 행을 48px보다 높이지 않게 이 칸만 위아래 여백을 두지 않는다. */}
        <td className="py-0">
          <CharacterCell
            character={character}
            narrowStats={<NarrowStats fame={character.fame} score={character.score} />}
          />
        </td>
        <td className={SET_CELL}>
          <RankingSetLines character={character} catalog={catalog} />
        </td>
        <td className={`table-num font-semibold text-game-fame ${WIDE_ONLY}`}>
          {character.fame != null ? formatCount(character.fame) : MISSING_VALUE}
        </td>
        <td className={`table-num ${WIDE_ONLY}`}>
          <ScoreValue score={character.score} />
        </td>
        <RecoveryCell result={result} />
      </tr>
      {expandable && expanded && (
        <tr>
          <td className={EDGE_CELL} />
          <td colSpan={SPANNED_COLUMNS} className="h-auto bg-inset p-0">
            <EpicSoulSlotTable slots={slots} />
          </td>
        </tr>
      )}
    </>
  )
}

function RecoveryCell({ result }: { result: EpicSoulRecoveryResult }): React.JSX.Element {
  switch (result.status) {
    case 'loading':
      return (
        <td>
          <span aria-label="받는 중" className="skeleton h-[14px]" />
        </td>
      )
    case 'error':
      return <td className="table-num text-fg-muted">계산하지 못했습니다.</td>
    case 'success':
      return <td className="table-num font-semibold">{formatCount(result.souls.total)}</td>
  }
}
