import { stat } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import type { CollectedCharacter } from '@dfragon/database'
import { type CollectionStore, type FetchCharacterBasic, collectCharacter } from './collect.js'
import { type EnqueueCharacters, importCollectedCharacters } from './import.js'

const COLLECTION_BATCH_SIZE = 100

export interface CollectionPassDependencies {
  importFile: string
  importedAt: number | undefined
  enqueue: EnqueueCharacters
  fetchBasic: FetchCharacterBasic
  store: CollectionStore
  requestIntervalMs: number
  report: (code: string, details?: Record<string, number>) => void
}

export interface CollectionPassResult {
  importedAt: number | undefined
  outcome: 'drained' | 'unavailable'
}

type ImportDependencies = Pick<
  CollectionPassDependencies,
  'importFile' | 'importedAt' | 'enqueue' | 'report'
>

type BatchCollectionDependencies = Pick<
  CollectionPassDependencies,
  'fetchBasic' | 'store' | 'requestIntervalMs'
>

async function modifiedTime(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).mtimeMs
  } catch {
    // 목록 파일이 아직 없을 수 있다.
    return undefined
  }
}

async function importIfChanged({
  importFile,
  importedAt,
  enqueue,
  report
}: ImportDependencies): Promise<number | undefined> {
  const listedAt = await modifiedTime(importFile)
  if (listedAt === undefined || listedAt === importedAt) {
    return importedAt
  }
  const count = await importCollectedCharacters(importFile, enqueue)
  report('CHARACTER_IMPORT_DONE', { count })

  return listedAt
}

async function collectBatch(
  batch: readonly CollectedCharacter[],
  { fetchBasic, store, requestIntervalMs }: BatchCollectionDependencies
): Promise<'collected' | 'unavailable'> {
  for (const character of batch) {
    const result = await collectCharacter(character, fetchBasic, store)
    if (result === 'unavailable') {
      return 'unavailable'
    }
    await setTimeout(requestIntervalMs)
  }

  return 'collected'
}

async function drainQueue(
  dependencies: BatchCollectionDependencies & Pick<CollectionPassDependencies, 'report'>
): Promise<CollectionPassResult['outcome']> {
  for (;;) {
    const batch = await dependencies.store.takeBatch(COLLECTION_BATCH_SIZE)
    if (batch.length === 0) {
      return 'drained'
    }

    if ((await collectBatch(batch, dependencies)) === 'unavailable') {
      dependencies.report('CHARACTER_NEOPLE_UNAVAILABLE')

      return 'unavailable'
    }
  }
}

export async function runCollectionPass(
  dependencies: CollectionPassDependencies
): Promise<CollectionPassResult> {
  const importedAt = await importIfChanged(dependencies)
  const outcome = await drainQueue(dependencies)

  return { importedAt, outcome }
}
