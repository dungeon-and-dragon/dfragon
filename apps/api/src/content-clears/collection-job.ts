import { setTimeout } from 'node:timers/promises'
import {
  type DatabaseClient,
  finishContentClearCollection,
  readClearPopulation,
  readContentClearCollection,
  readContentClearPopulations,
  recordContentClearCollectionProgress,
  recordContentClearPopulation,
  recordContentClears,
  startContentClearCollection
} from '@dfragon/database'
import { z } from 'zod'
import { defineJob } from '../jobs/definition.js'
import {
  type ClearCollectionDependencies,
  type ClearCollectionStore,
  collectContentClears
} from './collection.js'

// 명성 상위 10만 명을 초당 5건으로 받으면 다른 요청 없이도 5시간 반이 걸린다.
const DELAY_MINUTES = 12 * 60

export type ClearCollectionJobDependencies = Pick<
  ClearCollectionDependencies,
  'neople' | 'concurrency' | 'report'
>

export function createDatabaseClearCollectionStore(client: DatabaseClient): ClearCollectionStore {
  return {
    readPopulation: () => readClearPopulation(client),
    readPopulations: () => readContentClearPopulations(client),
    readProgress: () => readContentClearCollection(client),
    startProgress: (startedAt) => startContentClearCollection(client, startedAt),
    recordProgress: (progress) => recordContentClearCollectionProgress(client, progress),
    recordClears: (clears) => recordContentClears(client, clears),
    recordPopulation: (population) => recordContentClearPopulation(client, population),
    finishProgress: (startedAt) => finishContentClearCollection(client, startedAt)
  }
}

export function createContentClearCollectionJob(
  store: ClearCollectionStore,
  { neople, concurrency, report }: ClearCollectionJobDependencies
) {
  return defineJob({
    name: 'content-clear-collection',
    displayName: '클리어 기록 수집',
    description:
      '명성 상위 10만 캐릭터의 클리어 기록을 Neople에서 받아 저장합니다. 다른 수집과 Neople 요청 속도 상한을 나눠 씁니다.',
    schedule: '0 6 * * *',
    argsSchema: z.object({}),
    delayMinutes: DELAY_MINUTES,
    run: (_args, { reportProgress }) =>
      collectContentClears({
        store,
        neople,
        concurrency,
        now: () => new Date(),
        pause: (ms) => setTimeout(ms),
        report,
        reportProgress
      })
  })
}
