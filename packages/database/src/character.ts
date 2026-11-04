import type { DatabaseClient } from './client.js'
import type { Prisma } from './generated/prisma/client.js'

export type CharacterInput = {
  serverId: string
  characterId: string
  characterName: string
  adventureName: string
}

export type CharacterBasicInput = CharacterInput & {
  level: number
  jobId: string
  jobGrowId: string
  jobName: string
  jobGrowName: string
  fame: number | null
  guildId: string | null
  guildName: string | null
}

type CharacterDetails = Omit<
  Prisma.CharacterUncheckedCreateInput,
  'serverId' | 'characterId' | 'adventureId'
>

// timeline.ts의 캐릭터 lock(1175)과 다른 namespace다.
const adventureLockNamespace = 1176

export async function writeCharacter(
  transaction: Prisma.TransactionClient,
  { serverId, characterId, adventureName }: CharacterInput,
  details: CharacterDetails
): Promise<void> {
  // 같은 모험단의 처음 보는 캐릭터 두 개가 겹치면 모험단 행이 두 개 생기므로 이름으로 찾기 전에 잡는다.
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${adventureLockNamespace}::int, hashtext(${adventureName}))`
  const stored = await transaction.character.findUnique({
    where: { serverId_characterId: { serverId, characterId } },
    select: { adventureId: true }
  })
  if (stored !== null) {
    // 캐릭터는 모험단을 옮기지 못하므로 모험단 이름이 다르면 그 모험단의 이름이 바뀐 것이다.
    await transaction.adventure.update({
      where: { id: stored.adventureId },
      data: { name: adventureName }
    })
    await transaction.character.update({
      where: { serverId_characterId: { serverId, characterId } },
      data: details
    })

    return
  }
  const adventureId = await findOrCreateAdventureId(transaction, adventureName)
  await transaction.character.create({
    data: { ...details, serverId, characterId, adventureId }
  })
}

async function findOrCreateAdventureId(
  transaction: Prisma.TransactionClient,
  name: string
): Promise<bigint> {
  // 이름이 바뀐 모험단의 예전 이름을 다른 모험단이 쓸 수 있어 같은 이름이 여럿이면 가장 나중 행을 쓴다.
  const latest = await transaction.adventure.findFirst({
    where: { name },
    orderBy: { id: 'desc' },
    select: { id: true }
  })
  if (latest !== null) {
    return latest.id
  }
  const created = await transaction.adventure.create({ data: { name }, select: { id: true } })

  return created.id
}

export async function recordCharacter(
  client: DatabaseClient,
  character: CharacterInput
): Promise<void> {
  await client.$transaction((transaction) =>
    writeCharacter(transaction, character, { characterName: character.characterName })
  )
}
