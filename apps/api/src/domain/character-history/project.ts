import type {
  CharacterHistoryBasic,
  StoredCharacterHistory,
  StoredCharacterScoreHistory,
  TimelineEventRow
} from '@dfragon/database'
import { z } from 'zod'
import type { CharacterCardScore } from '@dfragon/server-core/domain/character-card/types.js'
import type { CharacterChangePoint } from './changes.js'

export const CHARACTER_NAME_CHANGE_CODES = { character: 102, adventure: 105 } as const

export type CharacterNameChangeKind = keyof typeof CHARACTER_NAME_CHANGE_CODES

export type CharacterNameChange = {
  kind: CharacterNameChangeKind
  at: string
  before: string
  after: string
}

export type CharacterHistoryBasicChange = CharacterHistoryBasic & { observedAt: string }

export type CharacterHistoryScoreChange = Pick<
  CharacterCardScore,
  'calculator' | 'value' | 'versions'
> & { observedAt: string }

export type CharacterHistory = {
  lastSeenAt: string | null
  basics: CharacterHistoryBasicChange[]
  scores: CharacterHistoryScoreChange[]
  sectionChanges: Record<string, string[]>
  nameChanges: CharacterNameChange[]
  changes: CharacterChangePoint[]
}

const nameChangeKinds = new Map<number, CharacterNameChangeKind>(
  Object.entries(CHARACTER_NAME_CHANGE_CODES).map(([kind, code]) => [
    code,
    kind as CharacterNameChangeKind
  ])
)

const nameChangeDataSchema = z.looseObject({ beforeName: z.string(), afterName: z.string() })

const calculatorSchema = z.enum(['equipment', 'buff'])

export function projectNameChanges(rows: readonly TimelineEventRow[]): CharacterNameChange[] {
  return rows.flatMap(({ code, occurredAt, data }) => {
    const kind = nameChangeKinds.get(code)
    const parsed = nameChangeDataSchema.safeParse(data)

    if (kind === undefined || !parsed.success) {
      return []
    }

    const { beforeName: before, afterName: after } = parsed.data
    const at = occurredAt.toISOString()

    return [{ kind, at, before, after }]
  })
}

// 점수 이력은 엔진이 낸 점수만 저장하므로 건너뛴 이유와 근사값이 없다.
export function projectHistoryScore(score: StoredCharacterScoreHistory): CharacterCardScore | null {
  const calculator = calculatorSchema.safeParse(score.kind)

  if (!calculator.success) {
    return null
  }

  return {
    calculator: calculator.data,
    value: score.score,
    skipped: null,
    approximate: null,
    versions: score.engine
  }
}

function projectScoreChange(score: StoredCharacterScoreHistory): CharacterHistoryScoreChange[] {
  const projected = projectHistoryScore(score)

  if (projected === null) {
    return []
  }

  const { calculator, value, versions } = projected
  const observedAt = score.observedAt.toISOString()

  return [{ observedAt, calculator, value, versions }]
}

export function projectCharacterHistory(
  stored: StoredCharacterHistory,
  nameChanges: CharacterNameChange[],
  changes: CharacterChangePoint[]
): CharacterHistory {
  const lastBasic = stored.basics.at(-1)
  const lastSeenAt = lastBasic?.lastSeenAt.toISOString() ?? null
  const basics = stored.basics.map(({ observedAt, lastSeenAt: _lastSeenAt, ...basic }) => {
    const at = observedAt.toISOString()

    return { ...basic, observedAt: at }
  })

  const scores = stored.scores.flatMap(projectScoreChange)
  const sectionChanges: Record<string, string[]> = {}

  for (const { section, observedAt } of stored.sectionChanges) {
    sectionChanges[section] ??= []
    sectionChanges[section].push(observedAt.toISOString())
  }

  return { lastSeenAt, basics, scores, sectionChanges, nameChanges, changes }
}
