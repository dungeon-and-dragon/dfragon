import { MISSING_VALUE } from '#shared/lib/missing-value'
import type { ListScore } from '#entities/character'

const integer = new Intl.NumberFormat('ko-KR')

const SCORE_LABELS: Record<NonNullable<ListScore>['calculator'], string> = {
  equipment: '장비',
  buff: '버프'
}
const SCORE_TONES: Record<NonNullable<ListScore>['calculator'], string> = {
  equipment: 'text-score-dealer',
  buff: 'text-score-buffer'
}

export function ScoreValue({ score }: { score: ListScore | undefined }): React.JSX.Element {
  if (score == null) {
    return <span className="num font-semibold text-fg-subtle">{MISSING_VALUE}</span>
  }

  return (
    <>
      <span className="mr-2 text-2xs text-fg-subtle">{SCORE_LABELS[score.calculator]}</span>
      <span className={`num font-semibold ${SCORE_TONES[score.calculator]}`}>
        {integer.format(score.value)}
      </span>
    </>
  )
}

// 명성 아래 줄에 둘 때는 열이 좁아 종류 글자 없이 색으로만 구분한다.
export function ScoreLine({ score }: { score: ListScore | undefined }): React.JSX.Element {
  if (score == null) {
    return <span className="num text-xs leading-4 text-fg-subtle">{MISSING_VALUE}</span>
  }

  return (
    <span className={`num text-xs leading-4 ${SCORE_TONES[score.calculator]}`}>
      {integer.format(score.value)}
    </span>
  )
}
