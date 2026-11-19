import { CheckIcon } from '@dfragon/ui'
import type { ReactNode } from 'react'
import { MISSING_VALUE } from '#features/capture-search'
import type { ClearName, WeeklyCharacter } from '#entities/adventure-guild'
import { CharacterCell } from '#components/table/CharacterCell'
import { FAME_COLUMN, RANK_COLUMN } from '#components/table/CharacterTable'
import { RankNumber } from '#components/table/RankNumber'

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
    <table className="table table-fixed table-wide">
      <colgroup>
        <col className={RANK_COLUMN} />
        <col />
        <col className={FAME_COLUMN} />
        {clearNames.map(({ kind, name }) => (
          <col key={`${kind}/${name}`} className="w-[96px]" />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th scope="col" rowSpan={headRows} className="table-num">
            #
          </th>
          <th scope="col" rowSpan={headRows}>
            캐릭터
          </th>
          <th scope="col" rowSpan={headRows} className="table-num">
            명성
          </th>
          {groups.map(({ label, span }) => (
            <th key={label} scope="colgroup" colSpan={span} className="text-center">
              {label}
            </th>
          ))}
        </tr>
        {clearNames.length > 0 && (
          <tr>
            {clearNames.map(({ kind, name }) => (
              <th key={`${kind}/${name}`} scope="col" className="text-center">
                {name}
              </th>
            ))}
          </tr>
        )}
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.serverId}/${row.characterId}`}>
            <td className="table-num">
              <RankNumber rank={index + 1} />
            </td>
            {/* 초상화가 셀 위아래 여백과 합쳐 행을 48px보다 높이지 않게 이 칸만 위아래 여백을 두지 않는다. */}
            <td className="py-0">
              <CharacterCell character={row} />
            </td>
            <td className="table-num font-semibold text-game-fame">
              {row.fame != null ? integer.format(row.fame) : MISSING_VALUE}
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
