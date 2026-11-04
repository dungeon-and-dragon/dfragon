import type { DatabaseClient } from './client.js'

export type CharacterInput = {
  serverId: string
  characterId: string
  characterName: string
  adventureName: string
}

// timeline.ts의 캐릭터 lock(1175)과 다른 namespace다.
const adventureLockNamespace = 1176

export async function recordCharacter(
  client: DatabaseClient,
  character: CharacterInput
): Promise<void> {
  const { serverId, characterId, characterName, adventureName } = character

  await client.$transaction(async (transaction) => {
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
        data: { characterName }
      })

      return
    }
    const adventure =
      (await transaction.adventure.findFirst({
        where: { name: adventureName },
        orderBy: { id: 'desc' },
        select: { id: true }
      })) ?? (await transaction.adventure.create({ data: { name: adventureName } }))
    await transaction.character.create({
      data: { serverId, characterId, characterName, adventureId: adventure.id }
    })
  })
}
