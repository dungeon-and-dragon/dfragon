import type { CharacterIdentity } from '../../domain/character-identity.js'
import type { CharacterPayloads } from '../../domain/character-detail/index.js'
import type {
  CalculatedScore,
  ScoreCalculator,
  ScoreEngineInput,
  ScoreEngineResult
} from '../../domain/score/index.js'
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
  payloads: CharacterPayloads,
  fetchedAt: Date,
  score: Promise<CalculatedScore | null>
) => void
