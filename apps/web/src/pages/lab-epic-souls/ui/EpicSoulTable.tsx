import { ChevronDownIcon, ChevronRightIcon, IconButton } from '@dfragon/ui'
import { useState } from 'react'
import type { StoredCharacter } from '#entities/ranking'
import { displayJobName, formatCount } from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import {
  type EpicSoulRecoveryResult,
  useEpicSoulRecoveries
} from '#pages/lab-epic-souls/api/useEpicSoulRecoveries'
import { EpicSoulSlotTable } from './EpicSoulSlotTable'

const EDGE_CELL = 'px-0'

export function EpicSoulTable({
  characters
}: {
  characters: readonly StoredCharacter[]
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
      <table className="table table-fixed">
        <colgroup>
          <col className="w-[36px]" />
          <col />
          <col className="w-[96px]" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={EDGE_CELL}>
              <span className="sr-only">펼치기</span>
            </th>
            <th scope="col">캐릭터</th>
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
              result={results[index] ?? { status: 'loading' }}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={EDGE_CELL} />
            <th scope="row">합계</th>
            <td className="table-num font-bold">{formatCount(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function CharacterRows({
  character,
  result
}: {
  character: StoredCharacter
  result: EpicSoulRecoveryResult
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { characterName } = character
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
              aria-label={`${characterName} 부위별 에픽 소울`}
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
        <td>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 font-semibold">{characterName}</span>
            <span className="min-w-0 truncate text-xs text-fg-muted">
              {displayJobName(character, character.role) ?? MISSING_VALUE}
            </span>
          </div>
        </td>
        <RecoveryCell result={result} />
      </tr>
      {expandable && expanded && (
        <tr>
          <td className={EDGE_CELL} />
          <td colSpan={2} className="h-auto bg-inset p-0">
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
      return <td className="table-num whitespace-normal text-fg-muted">계산하지 못했습니다.</td>
    case 'success':
      return <td className="table-num font-semibold">{formatCount(result.souls.total)}</td>
  }
}
