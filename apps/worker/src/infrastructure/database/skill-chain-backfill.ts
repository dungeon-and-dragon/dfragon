import {
  type CharacterSkillStyleInput,
  type DatabaseClient,
  fillCharacterSkillStyleChain,
  readSkillStyleChainBackfillPage,
  type SkillStyleChainBackfillKey,
  type SkillStyleChainBackfillRow
} from '@dfragon/database'
import type { SkillChainBackfillRepository } from '#application/ranking-stats/repository.js'

export class DatabaseSkillChainBackfillRepository implements SkillChainBackfillRepository {
  constructor(private readonly client: DatabaseClient) {}

  readPage(page: {
    after: SkillStyleChainBackfillKey | null
    limit: number
  }): Promise<SkillStyleChainBackfillRow[]> {
    return readSkillStyleChainBackfillPage(this.client, page)
  }

  fillChain(style: CharacterSkillStyleInput): Promise<boolean> {
    return fillCharacterSkillStyleChain(this.client, style)
  }
}
