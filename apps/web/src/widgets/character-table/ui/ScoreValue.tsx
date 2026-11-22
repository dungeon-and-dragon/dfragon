import { MISSING_VALUE } from '#shared/lib/missing-value'
import { approximateScoreNote, formatApproximateScore, type ListScore } from '#entities/character'

const integer = new Intl.NumberFormat('ko-KR')

const SCORE_LABELS: Record<NonNullable<ListScore>['calculator'], string> = {
  equipment: '장비',
  buff: '버프'
}
const SCORE_TONES: Record<NonNullable<ListScore>['calculator'], string> = {
  equipment: 'text-score-dealer',
  buff: 'text-score-buffer'
}
const SCORE_NOTE_LABELS = { equipment: '장비 점수', buff: '버프 점수' } as const
const APPROXIMATE_CLASS = 'border-b border-dotted border-fg-subtle'

function ScoreNumber({
  score,
  className
}: {
  score: NonNullable<ListScore>
  className: string
}): React.JSX.Element {
  const tone = SCORE_TONES[score.calculator]

  if (score.approximate === null) {
    return <span className={`${className} ${tone}`}>{integer.format(score.value)}</span>
  }

  const note = approximateScoreNote(score.approximate.source, SCORE_NOTE_LABELS[score.calculator])

  return (
    <span title={`근사값. ${note}`} className={`${className} ${tone} ${APPROXIMATE_CLASS}`}>
      {formatApproximateScore(score.value)}
    </span>
  )
}

export function ScoreValue({ score }: { score: ListScore | undefined }): React.JSX.Element {
  if (score == null) {
    return <span className="num font-semibold text-fg-subtle">{MISSING_VALUE}</span>
  }

  return (
    <>
      <span className="mr-2 text-2xs text-fg-subtle">{SCORE_LABELS[score.calculator]}</span>
      <ScoreNumber score={score} className="num font-semibold" />
    </>
  )
}

// 명성 아래 줄에 둘 때는 열이 좁아 종류 글자 없이 색으로만 구분한다.
export function ScoreLine({ score }: { score: ListScore | undefined }): React.JSX.Element {
  if (score == null) {
    return <span className="num text-xs leading-4 text-fg-subtle">{MISSING_VALUE}</span>
  }

  return <ScoreNumber score={score} className="num text-xs leading-4" />
}
