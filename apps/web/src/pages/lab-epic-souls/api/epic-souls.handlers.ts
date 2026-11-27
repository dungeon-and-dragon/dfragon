import { delay, HttpResponse, http } from 'msw'
import { z } from 'zod'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { storyAdventureCharacters, storyRecoveries } from './epic-souls.fixture'

export const ADVENTURE_CHARACTERS_URL = `${API_BASE_URL}/adventures/:adventureName/characters`
export const EPIC_SOUL_RECOVERY_URL = `${API_BASE_URL}/characters/:serverId/:characterId/epic-soul-recovery`

const STORY_CHARACTER_PREFIX = 'story-character-'

function failure(message: string) {
  return HttpResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message } }, { status: 500 })
}

const recoveryBodySchema = z.object({ includePrimordial: z.boolean() })

async function includePrimordialOf(request: Request): Promise<boolean> {
  const { includePrimordial } = recoveryBodySchema.parse(await request.json())

  return includePrimordial
}

export const epicSoulsHandlers = {
  characters: http.get(ADVENTURE_CHARACTERS_URL, () =>
    HttpResponse.json(storyAdventureCharacters())
  ),
  noAdventure: http.get(ADVENTURE_CHARACTERS_URL, ({ params }) => {
    const adventureName = String(params.adventureName)

    return HttpResponse.json({ adventureName, characters: [] })
  }),
  charactersLoading: http.get(ADVENTURE_CHARACTERS_URL, async () => {
    await delay('infinite')
  }),
  charactersFailure: http.get(ADVENTURE_CHARACTERS_URL, () =>
    failure('모험단 캐릭터를 받지 못했습니다.')
  ),
  /** 캐릭터 순서대로 합성 응답을 주고, 응답이 없는 캐릭터는 실패로 답한다. */
  recoveries: http.post(EPIC_SOUL_RECOVERY_URL, async ({ params, request }) => {
    const number = Number(String(params.characterId).replace(STORY_CHARACTER_PREFIX, ''))
    const recovery = storyRecoveries(await includePrimordialOf(request))[number - 1]

    if (recovery == null) {
      return failure('계산하지 못했습니다.')
    }

    return HttpResponse.json(recovery)
  }),
  recoveriesLoading: http.post(EPIC_SOUL_RECOVERY_URL, async () => {
    await delay('infinite')
  })
}
