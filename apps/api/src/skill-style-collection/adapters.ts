import {
  type DatabaseClient,
  deleteCharacterSkillStyle,
  readSkillStyleSampleJobs,
  recordCharacterBasicAndSkillStyle,
  takeSkillStyleRefreshBatch
} from '@dfragon/database'
import type { NeopleClient } from '@dfragon/neople'
import type { FetchSkillStyle, SkillStyleStore } from './collect.js'

export function createNeopleSkillStyle(neople: NeopleClient): FetchSkillStyle {
  return (character) => neople.characterSkillStyle(character)
}

export function createDatabaseSkillStyleStore(client: DatabaseClient): SkillStyleStore {
  return {
    readJobs: () => readSkillStyleSampleJobs(client),
    takeBatch: (job, fetchedBefore, skipped, limit) =>
      takeSkillStyleRefreshBatch(client, job, fetchedBefore, skipped, limit),
    record: (basic, style) => recordCharacterBasicAndSkillStyle(client, basic, style),
    deleteSkillStyle: (character) => deleteCharacterSkillStyle(client, character)
  }
}
