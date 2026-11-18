import { projectCharacterCard } from '@dfragon/server-core/domain/character-card/project.js'
import { cardScoreCalculator } from '@dfragon/server-core/domain/character-card/score.js'
import { projectCharacterDetails } from '@dfragon/server-core/domain/character-detail/project.js'
import type {
  CharacterIdentity,
  FetchedCharacterPayloads
} from '@dfragon/server-core/domain/character-detail/sections.js'
import { toScoreEngineInput } from '@dfragon/server-core/domain/score/input.js'
import type { ScoreEngineResult } from '@dfragon/server-core/domain/score/result.js'
import {
  enrichCharacterDetails,
  hasUnavailableItemDetail
} from '@dfragon/server-core/application/character-catalog/enrich.js'
import type { CharacterCatalog } from '@dfragon/server-core/application/character-catalog/ports.js'
import type { CalculateScore } from '@dfragon/server-core/application/character-detail/ports.js'

export type CharacterScoreCalculation = {
  result: ScoreEngineResult | null
  /** 아이템 상세를 하나라도 받지 못해 그 아이템을 빼고 계산했다. */
  missingItems: boolean
}

/** 상세 응답과 같은 계산기, 같은 아이템 상세로 계산해 상세 조회의 점수와 같은 값을 낸다. */
export async function calculateCharacterScore(
  identity: CharacterIdentity,
  { payloads, fetchedAt }: FetchedCharacterPayloads,
  catalog: CharacterCatalog,
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
