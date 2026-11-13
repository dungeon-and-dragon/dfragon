import type { CollectedCharacter } from '@dfragon/database'
import { collectCharacter } from './collect.js'
import type {
  CollectionStore,
  FetchCharacterBasic,
  EnqueueCharacters,
  ReadModifiedTime,
  ImportCharacters,
  Pause
} from './ports.js'

const COLLECTION_BATCH_SIZE = 1024
const IDLE_MS = 60_000
const UNAVAILABLE_PAUSE_MS = 60_000

export interface CollectionPassDependencies {
  importFiles: readonly string[]
  importedAt: ReadonlyMap<string, number>
  enqueue: EnqueueCharacters
  readModifiedTime: ReadModifiedTime
  importCharacters: ImportCharacters
  fetchBasic: FetchCharacterBasic
  store: CollectionStore
  readConcurrency: () => number
  report: (code: string, details?: Record<string, number>) => void
}

export interface CollectionPassResult {
  importedAt: ReadonlyMap<string, number>
  outcome: 'drained' | 'unavailable'
}

type ImportDependencies = Pick<
  CollectionPassDependencies,
  'importFiles' | 'importedAt' | 'enqueue' | 'readModifiedTime' | 'importCharacters' | 'report'
>

type BatchCollectionDependencies = Pick<
  CollectionPassDependencies,
  'fetchBasic' | 'store' | 'readConcurrency'
>

async function importChangedFiles({
  importFiles,
  importedAt,
  enqueue,
  readModifiedTime,
  importCharacters,
  report
}: ImportDependencies): Promise<ReadonlyMap<string, number>> {
  const imported = new Map(importedAt)
  for (const importFile of importFiles) {
    const listedAt = await readModifiedTime(importFile)
    if (listedAt === undefined || listedAt === importedAt.get(importFile)) {
      continue
    }
    const count = await importCharacters(importFile, enqueue)
    report('CHARACTER_IMPORT_DONE', { count })
    imported.set(importFile, listedAt)
  }

  return imported
}

async function collectBatch(
  batch: readonly CollectedCharacter[],
  { fetchBasic, store, readConcurrency }: BatchCollectionDependencies
): Promise<'collected' | 'unavailable'> {
  let start = 0

  while (start < batch.length) {
    const group = batch.slice(start, start + readConcurrency())
    const results = await Promise.all(
      group.map((character) => collectCharacter(character, fetchBasic, store))
    )
    if (results.includes('unavailable')) {
      return 'unavailable'
    }

    start += group.length
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

export async function runCharacterCollector(
  dependencies: Omit<CollectionPassDependencies, 'importedAt'> & { pause: Pause }
): Promise<never> {
  let importedAt: ReadonlyMap<string, number> = new Map()
  for (;;) {
    const pass = await runCollectionPass({ ...dependencies, importedAt })
    importedAt = pass.importedAt
    await dependencies.pause(pass.outcome === 'unavailable' ? UNAVAILABLE_PAUSE_MS : IDLE_MS)
  }
}
