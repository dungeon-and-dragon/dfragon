import {
  type CharacterStats,
  type CharacterStatsSnapshot,
  type DatabaseClient,
  type JobSkillAdoption,
  type JobSkillAdoptionQuery,
  type JobSkillAdoptionSnapshot,
  type SetAdoptionReplacement,
  type SkillStyleSampleJob,
  deleteJobSkillAdoptionComputedBefore,
  readCharacterStats,
  readFamedJobGrows,
  readJobSkillAdoption,
  replaceItemAdoption,
  replaceSetAdoption,
  saveCharacterStats,
  saveJobSkillAdoption
} from '@dfragon/database'
import type { StatsJobRepository } from '#application/ranking-stats/repository.js'

export class DatabaseStatsJobRepository implements StatsJobRepository {
  constructor(private readonly client: DatabaseClient) {}

  readCharacterStats(): Promise<CharacterStats> {
    return readCharacterStats(this.client)
  }

  saveCharacterStats(snapshot: CharacterStatsSnapshot): Promise<void> {
    return saveCharacterStats(this.client, snapshot)
  }

  readFamedJobGrows(): Promise<SkillStyleSampleJob[]> {
    return readFamedJobGrows(this.client)
  }

  readJobSkillAdoption(job: JobSkillAdoptionQuery): Promise<JobSkillAdoption> {
    return readJobSkillAdoption(this.client, job)
  }

  saveJobSkillAdoption(snapshot: JobSkillAdoptionSnapshot): Promise<void> {
    return saveJobSkillAdoption(this.client, snapshot)
  }

  deleteJobSkillAdoptionComputedBefore(before: Date): Promise<number> {
    return deleteJobSkillAdoptionComputedBefore(this.client, before)
  }

  replaceSetAdoption(replacement: SetAdoptionReplacement): Promise<number> {
    return replaceSetAdoption(this.client, replacement)
  }

  replaceItemAdoption(replacement: SetAdoptionReplacement): Promise<number> {
    return replaceItemAdoption(this.client, replacement)
  }
}
