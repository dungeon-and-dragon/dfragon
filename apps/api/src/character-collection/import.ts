import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import type { CollectedCharacter } from '@dfragon/database'
import { z } from 'zod'

const IMPORT_BATCH_SIZE = 1000

// 캐릭터 목록 파일의 한 줄이다. server, key가 Neople serverId, characterId다.
const exportedCharacterSchema = z.object({
  server: z.string().min(1),
  key: z.string().min(1)
})

export type EnqueueCharacters = (characters: readonly CollectedCharacter[]) => Promise<void>

export async function importCollectedCharacters(
  path: string,
  enqueue: EnqueueCharacters
): Promise<number> {
  const lines = createInterface({
    input: createReadStream(path),
    crlfDelay: Number.POSITIVE_INFINITY
  })
  let batch: CollectedCharacter[] = []
  let count = 0
  for await (const line of lines) {
    if (line.trim() === '') {
      continue
    }
    const { server, key } = exportedCharacterSchema.parse(JSON.parse(line))
    batch.push({ serverId: server, characterId: key })
    count++
    if (batch.length === IMPORT_BATCH_SIZE) {
      await enqueue(batch)
      batch = []
    }
  }
  if (batch.length > 0) {
    await enqueue(batch)
  }

  return count
}
