import type { CharacterIdentity } from '../../domain/character-identity.js'
import type { CharacterPayloads } from '../../domain/character-detail/sections.js'
import type { CalculatedScore } from '../../domain/score/calculated.js'
import type { ScoreCalculator, ScoreEngineInput } from '../../domain/score/input.js'
import type { ScoreEngineResult } from '../../domain/score/result.js'
import type { RecordNeopleStage } from './neople-stages.js'

export type FetchCharacterDetails = (
  identity: CharacterIdentity,
  signal: AbortSignal,
  recordStage: RecordNeopleStage
) => Promise<CharacterPayloads>

export type CalculateScore = (
  input: ScoreEngineInput,
  calculator: ScoreCalculator,
  signal: AbortSignal
) => Promise<ScoreEngineResult | null>

export type PublishCharacterFetched = (
  identity: CharacterIdentity,
  payloads: Pick<CharacterPayloads, 'basic' | 'skill_style'>,
  fetchedAt: Date,
  score: Promise<CalculatedScore | null>
) => void
