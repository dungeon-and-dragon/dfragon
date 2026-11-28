import { projectCharacterCard } from '@dfragon/server-core/domain/character-card/index.js'
import {
  characterDetailSections,
  projectCharacterDetails,
  projectCharacterFreshness
} from '@dfragon/server-core/domain/character-detail/index.js'
import { CharacterDetailFailure } from '@dfragon/server-core/domain/character-failure.js'
import {
  CHANGE_SECTIONS,
  type CharacterHistory,
  projectCharacterChanges,
  projectCharacterHistory,
  projectHistoryScore,
  projectNameChanges
} from '#domain/character-history/index.js'
import {
  restoreCharacterPayloads,
  toCharacterHeader
} from '@dfragon/server-core/domain/character-history/index.js'
import type { CharacterIdentity } from '@dfragon/server-core/domain/character-identity.js'
import { enrichCharacterDetails } from '@dfragon/server-core/application/character-catalog/index.js'
import type { CharacterCatalog } from '@dfragon/server-core/application/character-catalog/ports.js'
import type { CharacterScoreSource } from '#application/character-detail/index.js'
import type { CharacterHistoryRepository } from './repository.js'

const storedSections = characterDetailSections.filter((section) => section !== 'basic')

export class CharacterHistoryService {
  constructor(
    private readonly repository: CharacterHistoryRepository,
    private readonly catalog: CharacterCatalog
  ) {}

  // 저장한 값만 읽고 타임라인 동기화를 걸거나 기다리지 않는다.
  async readHistory(character: CharacterIdentity): Promise<CharacterHistory> {
    const [stored, events, sections] = await Promise.all([
      this.repository.readHistory(character),
      this.repository.readNameChangeEvents(character),
      this.repository.readSections(character, CHANGE_SECTIONS)
    ])

    const nameChanges = projectNameChanges(events)
    const firstObservedAt = stored.basics[0]?.observedAt ?? null
    const changes = projectCharacterChanges(firstObservedAt, sections)

    return projectCharacterHistory(stored, nameChanges, changes)
  }

  /** 그 시각의 상세를 지금 상세 조회와 같은 투영, 공용 아이템 상세 연결로 만들고, 점수는 다시 계산하지 않는다. */
  async readSnapshot(character: CharacterIdentity, at: Date, signal: AbortSignal) {
    const snapshot = await this.repository.readSnapshot(character, at)

    if (snapshot === null) {
      throw new CharacterDetailFailure('notFound')
    }

    const { observedAt, basic, score, sections } = snapshot
    const header = toCharacterHeader(character, basic)
    const payloads = restoreCharacterPayloads(header, sections)
    const projected = projectCharacterDetails(character, payloads, observedAt)
    const { details } = await enrichCharacterDetails(projected, this.catalog, signal)
    const freshness = projectCharacterFreshness(observedAt)
    const unscored = projectCharacterCard(projected)
    const cardScore = score !== null ? projectHistoryScore(score) : null
    const card = { ...unscored, score: cardScore }

    return { ...details, freshness, card }
  }

  /** 가장 최근에 저장한 원문으로 점수 입력 재료를 만들고, 섹션이 하나라도 없으면 null이다. Neople을 부르지 않는다. */
  async readScoreSource(
    character: CharacterIdentity,
    signal: AbortSignal
  ): Promise<CharacterScoreSource | null> {
    const snapshot = await this.repository.readSnapshot(character, new Date())

    if (snapshot === null) {
      return null
    }

    const { observedAt, basic, sections } = snapshot

    if (!storedSections.every((section) => Object.hasOwn(sections, section))) {
      return null
    }

    const header = toCharacterHeader(character, basic)
    const payloads = restoreCharacterPayloads(header, sections)
    const projected = projectCharacterDetails(character, payloads, observedAt)
    const { items } = await enrichCharacterDetails(projected, this.catalog, signal)
    const { role } = projectCharacterCard(projected)

    return { payloads, role, items }
  }
}
