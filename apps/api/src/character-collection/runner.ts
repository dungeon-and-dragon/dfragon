import { stat } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import type { CollectedCharacter } from '@dfragon/database'
import { type CollectionStore, type FetchCharacterBasic, collectCharacter } from './collect.js'
import { type EnqueueCharacters, importCollectedCharacters } from './import.js'

const COLLECTION_BATCH_SIZE = 100

export interface CollectionPassDependencies {
  importFiles: readonly string[]
  importedAt: ReadonlyMap<string, number>
  enqueue: EnqueueCharacters
  fetchBasic: FetchCharacterBasic
  store: CollectionStore
  requestIntervalMs: number
  concurrency: number
  report: (code: string, details?: Record<string, number>) => void
}

export interface CollectionPassResult {
  importedAt: ReadonlyMap<string, number>
  outcome: 'drained' | 'unavailable'
}

type ImportDependencies = Pick<
  CollectionPassDependencies,
  'importFiles' | 'importedAt' | 'enqueue' | 'report'
>

type BatchCollectionDependencies = Pick<
  CollectionPassDependencies,
  'fetchBasic' | 'store' | 'requestIntervalMs' | 'concurrency'
>

async function modifiedTime(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).mtimeMs
  } catch {
    // 목록 파일이 아직 없을 수 있다.
    return undefined
  }
}

async function importChangedFiles({
  importFiles,
  importedAt,
  enqueue,
  report
}: ImportDependencies): Promise<ReadonlyMap<string, number>> {
  const imported = new Map(importedAt)
  for (const importFile of importFiles) {
    const listedAt = await modifiedTime(importFile)
    if (listedAt === undefined || listedAt === importedAt.get(importFile)) {
      continue
    }
    const count = await importCollectedCharacters(importFile, enqueue)
    report('CHARACTER_IMPORT_DONE', { count })
    imported.set(importFile, listedAt)
  }

  return imported
}

async function collectBatch(
  batch: readonly CollectedCharacter[],
  { fetchBasic, store, requestIntervalMs, concurrency }: BatchCollectionDependencies
): Promise<'collected' | 'unavailable'> {
  for (let start = 0; start < batch.length; start += concurrency) {
    const group = batch.slice(start, start + concurrency)
    const startedAt = performance.now()
    const results = await Promise.all(
      group.map((character) => collectCharacter(character, fetchBasic, store))
    )
    if (results.includes('unavailable')) {
      return 'unavailable'
    }
    // 묶음마다 요청 수만큼의 간격을 채워 평균 속도가 초당 상한을 넘지 않게 한다.
    const remainingMs = group.length * requestIntervalMs - (performance.now() - startedAt)
    await setTimeout(Math.max(0, remainingMs))
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
  const importedAt = await importChangedFiles(dependencies)
  const outcome = await drainQueue(dependencies)

  return { importedAt, outcome }
}
