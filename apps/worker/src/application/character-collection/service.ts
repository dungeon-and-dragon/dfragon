import type { CollectedCharacter } from '@dfragon/database'
import { collectCharacter } from './collect.js'
import type { CharacterCollectionPorts } from './ports.js'
import type { CollectionRepository } from './repository.js'

const COLLECTION_BATCH_SIZE = 1024
const IDLE_MS = 60_000
const UNAVAILABLE_PAUSE_MS = 60_000

export interface CollectionPassResult {
  importedAt: ReadonlyMap<string, number>
  outcome: 'drained' | 'unavailable'
}

export class CharacterCollectionService {
  constructor(
    private readonly repository: CollectionRepository,
    private readonly ports: CharacterCollectionPorts
  ) {}

  async runPass(importedAt: ReadonlyMap<string, number>): Promise<CollectionPassResult> {
    const imported = await this.importChangedFiles(importedAt)
    const outcome = await this.drainQueue()

    return { importedAt: imported, outcome }
  }

  async run(): Promise<never> {
    let importedAt: ReadonlyMap<string, number> = new Map()

    for (;;) {
      const pass = await this.runPass(importedAt)
      const pauseMs = pass.outcome === 'unavailable' ? UNAVAILABLE_PAUSE_MS : IDLE_MS

      importedAt = pass.importedAt
      await this.ports.pause(pauseMs)
    }
  }

  private async importChangedFiles(
    importedAt: ReadonlyMap<string, number>
  ): Promise<ReadonlyMap<string, number>> {
    const { importFiles, readModifiedTime, importCharacters, report } = this.ports
    const imported = new Map(importedAt)

    for (const importFile of importFiles) {
      const listedAt = await readModifiedTime(importFile)
      if (listedAt === undefined || listedAt === importedAt.get(importFile)) {
        continue
      }

      const count = await importCharacters(importFile, (characters) =>
        this.repository.enqueue(characters)
      )
      report('CHARACTER_IMPORT_DONE', { count })
      imported.set(importFile, listedAt)
    }

    return imported
  }

  private async collectBatch(
    batch: readonly CollectedCharacter[]
  ): Promise<'collected' | 'unavailable'> {
    const { fetchBasic, readConcurrency } = this.ports
    let start = 0

    while (start < batch.length) {
      const group = batch.slice(start, start + readConcurrency())
      const results = await Promise.all(
        group.map((character) => collectCharacter(character, fetchBasic, this.repository))
      )

      if (results.includes('unavailable')) {
        return 'unavailable'
      }

      start += group.length
    }

    return 'collected'
  }

  private async drainQueue(): Promise<CollectionPassResult['outcome']> {
    for (;;) {
      const batch = await this.repository.takeBatch(COLLECTION_BATCH_SIZE)
      if (batch.length === 0) {
        return 'drained'
      }

      if ((await this.collectBatch(batch)) === 'unavailable') {
        this.ports.report('CHARACTER_NEOPLE_UNAVAILABLE')

        return 'unavailable'
      }
    }
  }
}
