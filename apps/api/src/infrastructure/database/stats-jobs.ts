import {
  type DatabaseClient,
  deleteJobSkillAdoptionComputedBefore,
  readCharacterStats,
  readFamedJobGrows,
  readJobSkillAdoption,
  saveCharacterStats,
  saveJobSkillAdoption
} from '@dfragon/database'
import type { StatsJobStore } from '../../application/ranking-stats/ports.js'

export function createDatabaseStatsJobStore(client: DatabaseClient): StatsJobStore {
  return {
    readCharacterStats: () => readCharacterStats(client),
    saveCharacterStats: (snapshot) => saveCharacterStats(client, snapshot),
    readFamedJobGrows: () => readFamedJobGrows(client),
    readJobSkillAdoption: (job) => readJobSkillAdoption(client, job),
    saveJobSkillAdoption: (snapshot) => saveJobSkillAdoption(client, snapshot),
    deleteJobSkillAdoptionComputedBefore: (before) =>
      deleteJobSkillAdoptionComputedBefore(client, before)
  }
}
