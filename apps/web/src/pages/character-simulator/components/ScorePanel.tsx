import {
  type CharacterCard,
  type CharacterCardScore,
  formatApproximateScore,
  type ScoreView,
  toScoreView
} from '#entities/character'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import { LoadingLine } from '#shared/ui/LoadingLine'
import type { EquipmentSimulationResult } from '#pages/character-simulator/api/useEquipmentSimulation'

const integer = new Intl.NumberFormat('ko-KR')
const signedInteger = new Intl.NumberFormat('ko-KR', { signDisplay: 'exceptZero' })

const SCORE_TONES = { dealer: 'text-score-dealer', buffer: 'text-score-buffer' } as const
const APPROXIMATE_CLASS = 'border-b border-dotted border-fg-subtle'
const LAYOUTS = {
  stacked: {
    section: 'flex min-w-0 flex-col gap-2',
    list: 'flex flex-wrap gap-x-8 gap-y-2 max-sm:gap-x-6',
    row: 'stat min-w-0 max-sm:[&_.stat-value]:text-sm'
  },
  inline: {
    section: 'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1',
    list: 'flex flex-wrap items-baseline gap-x-4 gap-y-1',
    row: 'flex min-w-0 items-baseline gap-2 [&_.stat-value]:text-sm'
  }
} as const
const VALUE = 'stat-value'
const NOTE = 'm-0 text-sm text-fg-muted'

type Role = CharacterCard['role']
type Layout = (typeof LAYOUTS)[keyof typeof LAYOUTS]

function scoreViewOf(role: Role, score: CharacterCardScore | null): ScoreView {
  return toScoreView({ role, score })
}

export function ScorePanel({
  role,
  result,
  inline = false
}: {
  role: Role
  result: EquipmentSimulationResult
  inline?: boolean
}): React.JSX.Element {
  const { label } = scoreViewOf(role, null)
  const layout = inline ? LAYOUTS.inline : LAYOUTS.stacked
  const calculating = result.status === 'success' && result.calculating

  return (
    <section aria-label={label} aria-busy={calculating || undefined} className={layout.section}>
      <div className="flex items-center gap-2">
        <h2 className="stat-label">{label}</h2>
        {calculating && <LoadingLine short />}
      </div>
      <ScoreBody role={role} result={result} layout={layout} />
    </section>
  )
}

function ScoreBody({
  role,
  result,
  layout
}: {
  role: Role
  result: EquipmentSimulationResult
  layout: Layout
}): React.JSX.Element {
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" className={`flex items-center gap-2 ${NOTE}`}>
          <LoadingLine short />
          <span role="status">점수를 계산하는 중입니다.</span>
        </div>
      )
    case 'error':
      return (
        <p role="alert" className="m-0 text-sm text-fg-danger">
          점수를 계산하지 못했습니다.
        </p>
      )
    case 'success': {
      const { baseline, simulated } = result.simulation

      if (baseline === null && simulated === null) {
        return <p className={NOTE}>점수를 계산할 수 없습니다.</p>
      }

      const before = scoreViewOf(role, baseline)
      const after = scoreViewOf(role, simulated)

      return (
        <dl className={layout.list}>
          <ScoreRow label="현재" view={before} row={layout.row} />
          <ScoreRow label="변경 후" view={after} row={layout.row} />
          <DifferenceRow before={before} after={after} row={layout.row} />
        </dl>
      )
    }
  }
}

function ScoreRow({
  label,
  view,
  row
}: {
  label: string
  view: ScoreView
  row: string
}): React.JSX.Element {
  const { tone, value, approximate, description } = view
  const toneClass = tone !== null ? SCORE_TONES[tone] : ''

  return (
    <div className={row}>
      <dt className="stat-label">{label}</dt>
      {value != null ? (
        <dd
          title={description}
          className={`${VALUE} ${toneClass} ${approximate ? APPROXIMATE_CLASS : ''}`}
        >
          {approximate ? formatApproximateScore(value) : integer.format(value)}
        </dd>
      ) : (
        <dd title={description} className={`${VALUE} text-fg-subtle`}>
          {MISSING_VALUE}
        </dd>
      )}
    </div>
  )
}

function differenceTone(difference: number): string {
  if (difference > 0) {
    return 'text-fg-success'
  }

  if (difference < 0) {
    return 'text-fg-danger'
  }

  return 'text-fg-muted'
}

function DifferenceRow({
  before,
  after,
  row
}: {
  before: ScoreView
  after: ScoreView
  row: string
}): React.JSX.Element {
  if (before.value == null || after.value == null) {
    return (
      <div className={row}>
        <dt className="stat-label">차이</dt>
        <dd className={`${VALUE} text-fg-subtle`}>{MISSING_VALUE}</dd>
      </div>
    )
  }

  const difference = after.value - before.value
  const approximate = before.approximate || after.approximate
  const text = signedInteger.format(difference)

  return (
    <div className={row}>
      <dt className="stat-label">차이</dt>
      <dd className={`${VALUE} ${differenceTone(difference)}`}>
        {approximate ? `≈${text}` : text}
      </dd>
    </div>
  )
}
