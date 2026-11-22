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
const ROW = 'flex items-baseline justify-between gap-4'
const VALUE = 'stat-value'

type Role = CharacterCard['role']

function scoreViewOf(role: Role, score: CharacterCardScore | null): ScoreView {
  return toScoreView({ role, score })
}

export function ScorePanel({
  role,
  result
}: {
  role: Role
  result: EquipmentSimulationResult
}): React.JSX.Element {
  const { label } = scoreViewOf(role, null)
  const calculating = result.status === 'success' && result.calculating

  return (
    <section aria-label={label} aria-busy={calculating || undefined} className="flex flex-col">
      <div className="section-title">
        <h2>{label}</h2>
        {calculating && (
          <span className="section-title-actions">
            <LoadingLine short />
          </span>
        )}
      </div>
      <ScoreBody role={role} result={result} />
    </section>
  )
}

function ScoreBody({
  role,
  result
}: {
  role: Role
  result: EquipmentSimulationResult
}): React.JSX.Element {
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" className="state state-pending">
          <LoadingLine />
          <span role="status">점수를 계산하는 중입니다.</span>
        </div>
      )
    case 'error':
      return (
        <p role="alert" className="state state-error">
          점수를 계산하지 못했습니다.
        </p>
      )
    case 'success': {
      const { baseline, simulated } = result.simulation

      if (baseline === null && simulated === null) {
        return <p className="state">점수를 계산할 수 없습니다.</p>
      }

      const before = scoreViewOf(role, baseline)
      const after = scoreViewOf(role, simulated)

      return (
        <dl className="flex flex-col gap-4 px-4 py-6">
          <ScoreRow label="현재" view={before} />
          <ScoreRow label="변경 후" view={after} />
          <DifferenceRow before={before} after={after} />
        </dl>
      )
    }
  }
}

function ScoreRow({ label, view }: { label: string; view: ScoreView }): React.JSX.Element {
  const { tone, value, approximate, description } = view
  const note = description !== undefined && <span className="sr-only">{description}</span>
  const toneClass = tone !== null ? SCORE_TONES[tone] : ''

  return (
    <div className={ROW}>
      <dt className="stat-label">{label}</dt>
      {value != null ? (
        <dd
          title={description}
          className={`${VALUE} ${toneClass} ${approximate ? APPROXIMATE_CLASS : ''}`}
        >
          {approximate ? formatApproximateScore(value) : integer.format(value)}
          {note}
        </dd>
      ) : (
        <dd className={`${VALUE} text-fg-subtle`}>
          {MISSING_VALUE}
          {note}
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
  after
}: {
  before: ScoreView
  after: ScoreView
}): React.JSX.Element {
  if (before.value == null || after.value == null) {
    return (
      <div className={ROW}>
        <dt className="stat-label">차이</dt>
        <dd className={`${VALUE} text-fg-subtle`}>{MISSING_VALUE}</dd>
      </div>
    )
  }

  const difference = after.value - before.value
  const approximate = before.approximate || after.approximate
  const text = signedInteger.format(difference)

  return (
    <div className={ROW}>
      <dt className="stat-label">차이</dt>
      <dd className={`${VALUE} ${differenceTone(difference)}`}>
        {approximate ? `≈${text}` : text}
      </dd>
    </div>
  )
}
