import { CheckIcon } from '@dfragon/ui'
import type { ReactNode } from 'react'
import { MISSING_VALUE } from '#core/capture/cards'
import type { ClearName, WeeklyCharacter } from '#core/adventure-guild/adventure-weekly'
import { CharacterCell } from '../../components/table/CharacterCell'
import { tableClasses } from '../../components/table/table-classes'
import { RankBadge } from '../../components/table/RankBadge'

const { headCell, cell } = tableClasses

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
    <table className={`${tableClasses.table} ${tableClasses.wideTable}`}>
      <colgroup>
        <col className={tableClasses.rankColumn} />
        <col />
        <col className={tableClasses.fameColumn} />
        {clearNames.map(({ kind, name }) => (
          <col key={`${kind}/${name}`} className="w-[96px]" />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th scope="col" rowSpan={headRows} className={`${headCell} text-center`}>
            #
          </th>
          <th scope="col" rowSpan={headRows} className={`${headCell} text-left`}>
            캐릭터
          </th>
          <th scope="col" rowSpan={headRows} className={`${headCell} text-right`}>
            명성
          </th>
          {groups.map(({ label, span }) => (
            <th key={label} scope="colgroup" colSpan={span} className={`${headCell} text-center`}>
              {label}
            </th>
          ))}
        </tr>
        {clearNames.length > 0 && (
          <tr>
            {clearNames.map(({ kind, name }) => (
              <th key={`${kind}/${name}`} scope="col" className={`${headCell} text-center`}>
                {name}
              </th>
            ))}
          </tr>
        )}
      </thead>
      <tbody className={tableClasses.body}>
        {rows.map((row, index) => (
          <tr key={`${row.serverId}/${row.characterId}`} className={tableClasses.row}>
            <td className={`${cell} text-center`}>
              <RankBadge rank={index + 1} />
            </td>
            <td className={cell}>
              <CharacterCell character={row} />
            </td>
            <td className={`${cell} ${tableClasses.fame}`}>
              {row.fame != null ? integer.format(row.fame) : MISSING_VALUE}
            </td>
            {clearNames.map((clearName) => (
              <td key={`${clearName.kind}/${clearName.name}`} className={`${cell} text-center`}>
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
