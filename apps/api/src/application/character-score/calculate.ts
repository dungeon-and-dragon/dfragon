import { projectCharacterCard } from '../../domain/character-card/project.js'
import { cardScoreCalculator } from '../../domain/character-card/score.js'
import { projectCharacterDetails } from '../../domain/character-detail/project.js'
import type {
  CharacterIdentity,
  FetchedCharacterPayloads
} from '../../domain/character-detail/sections.js'
import { toScoreEngineInput } from '../../domain/score/input.js'
import type { ScoreEngineResult } from '../../domain/score/result.js'
import { enrichCharacterDetails, hasUnavailableItemDetail } from '../character-catalog/enrich.js'
import type { CatalogService } from '../character-catalog/service.js'
import type { CalculateScore } from '../character-detail/ports.js'

export type CharacterScoreCalculation = {
  result: ScoreEngineResult | null
  /** 아이템 상세를 하나라도 받지 못해 그 아이템을 빼고 계산했다. */
  missingItems: boolean
}

/** 상세 응답과 같은 계산기, 같은 아이템 상세로 계산해 상세 조회의 점수와 같은 값을 낸다. */
export async function calculateCharacterScore(
  identity: CharacterIdentity,
  { payloads, fetchedAt }: FetchedCharacterPayloads,
  catalog: CatalogService,
  calculateScore: CalculateScore,
  signal: AbortSignal
): Promise<CharacterScoreCalculation> {
  const projected = projectCharacterDetails(identity, payloads, fetchedAt)
  const { details, items } = await enrichCharacterDetails(projected, catalog, signal)
  const { role } = projectCharacterCard(projected)
  const result = await calculateScore(
    toScoreEngineInput(payloads, items),
    cardScoreCalculator(role),
    signal
  )

  return { result, missingItems: hasUnavailableItemDetail(details) }
}
