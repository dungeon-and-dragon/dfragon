import { Button } from '@dfragon/ui'
import type { LabCandidateExclusion } from '#ops-api/ops-schemas'
import { formatDateSecond } from '#ops-app/format'
import { useIncludeLabCandidate, useLabCandidateExclusions } from '#ops-app/ops-queries'
import { panelClasses } from './panel-classes'

function ExclusionRow({
  exclusion,
  locked,
  onInclude
}: {
  exclusion: LabCandidateExclusion
  locked: boolean
  onInclude: (itemName: string) => void
}): React.JSX.Element {
  const { itemName, excludedAt } = exclusion

  function handleClick(): void {
    onInclude(itemName)
  }

  return (
    <tr>
      <td className="font-semibold">{itemName}</td>
      <td className="num text-fg-muted">{formatDateSecond(excludedAt)}</td>
      <td className="table-num">
        <Button size="sm" disabled={locked} aria-label={`${itemName} 해제`} onClick={handleClick}>
          해제
        </Button>
      </td>
    </tr>
  )
}

export function LabCandidateExclusionPanel(): React.JSX.Element {
  const exclusions = useLabCandidateExclusions()
  const include = useIncludeLabCandidate()

  function handleInclude(itemName: string): void {
    include.mutate(itemName)
  }

  function body(): React.JSX.Element {
    if (exclusions.isError) {
      return (
        <p role="alert" className="state state-error">
          제외한 후보를 읽지 못했습니다.
        </p>
      )
    }

    if (exclusions.data === undefined) {
      return (
        <div role="status" className="state state-pending">
          <span aria-hidden="true" className="loading-line">
            <span />
          </span>
        </div>
      )
    }

    if (exclusions.data.exclusions.length === 0) {
      return <p className="state">제외한 후보가 없습니다.</p>
    }

    return (
      <table className="table">
        <thead>
          <tr>
            <th scope="col">이름</th>
            <th scope="col">제외 시각</th>
            <th scope="col" className="table-num" />
          </tr>
        </thead>
        <tbody>
          {exclusions.data.exclusions.map((exclusion) => (
            <ExclusionRow
              key={exclusion.itemName}
              exclusion={exclusion}
              locked={include.isPending}
              onInclude={handleInclude}
            />
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <section aria-label="제외한 후보" className={panelClasses.box}>
      <h2 className="section-title">제외한 후보</h2>
      {include.isError && (
        <p role="alert" className="state state-error">
          해제하지 못했습니다.
        </p>
      )}
      {body()}
    </section>
  )
}
