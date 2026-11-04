import { stat } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import { type CollectionStore, type FetchCharacterBasic, collectCharacter } from './collect.js'
import { type EnqueueCharacters, importCollectedCharacters } from './import.js'

const COLLECTION_BATCH_SIZE = 100

export interface CollectorTiming {
  requestIntervalMs: number
  idleMs: number
  unavailablePauseMs: number
}

export interface CharacterCollectorDependencies {
  importFile: string
  enqueue: EnqueueCharacters
  fetchBasic: FetchCharacterBasic
  store: CollectionStore
  timing: CollectorTiming
  report: (code: string, details?: Record<string, number>) => void
  signal: AbortSignal
}

async function pause(ms: number, signal: AbortSignal): Promise<void> {
  try {
    await setTimeout(ms, undefined, { signal })
  } catch {
    // 종료 signal로 깨어난 것이다. 호출한 loop가 signal을 보고 끝낸다.
  }
}

async function modifiedTime(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).mtimeMs
  } catch {
    // 목록 파일이 아직 없을 수 있다.
    return undefined
  }
}

export async function runCharacterCollector({
  importFile,
  enqueue,
  fetchBasic,
  store,
  timing,
  report,
  signal
}: CharacterCollectorDependencies): Promise<void> {
  let importedAt: number | undefined
  while (!signal.aborted) {
    const exportedAt = await modifiedTime(importFile)
    if (exportedAt !== undefined && exportedAt !== importedAt) {
      const count = await importCollectedCharacters(importFile, enqueue)
      importedAt = exportedAt
      report('CHARACTER_IMPORT_DONE', { count })
    }
    const batch = await store.takeBatch(COLLECTION_BATCH_SIZE)
    if (batch.length === 0) {
      await pause(timing.idleMs, signal)
      continue
    }
    for (const character of batch) {
      if (signal.aborted) {
        return
      }
      const startedAt = performance.now()
      const result = await collectCharacter(character, fetchBasic, store)
      if (result === 'unavailable') {
        report('CHARACTER_NEOPLE_UNAVAILABLE')
        await pause(timing.unavailablePauseMs, signal)
        break
      }
      await pause(Math.max(0, timing.requestIntervalMs - (performance.now() - startedAt)), signal)
    }
  }
}
