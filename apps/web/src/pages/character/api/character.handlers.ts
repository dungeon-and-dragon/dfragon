import { HttpResponse, http } from 'msw'
import type { CharacterDetailView, CharacterHistory, CharacterIdentity } from '#entities/character'
import {
  characterUrl,
  loadingResponse
} from '#entities/character-detail/api/character-detail.handlers'
import {
  storyBuffSkillWindowCatalog,
  storyCharacterDetail,
  storyHistory,
  storySkillWindowCatalog
} from './character.fixture'
import { skillWindowHandlers } from '#entities/catalog/api/skill-window.handlers'
import { SKILL_STATS_URL } from '#entities/ranking/api/skill-stats.handlers'

function identityOf({ character }: CharacterDetailView): CharacterIdentity {
  return { serverId: character.serverId, characterId: character.characterId }
}

export function characterDetailHandlers(
  detail: CharacterDetailView,
  history: CharacterHistory = storyHistory
) {
  const identity = identityOf(detail)

  return [
    http.get(characterUrl(identity), () => HttpResponse.json(detail)),
    http.get(characterUrl(identity, '/history'), () => HttpResponse.json(history)),
    http.get(characterUrl(identity, '/history/snapshot'), () => HttpResponse.json(detail)),
    http.get(SKILL_STATS_URL, loadingResponse),
    ...skillWindowHandlers([storySkillWindowCatalog, storyBuffSkillWindowCatalog])
  ]
}

export function characterDetailLoadingHandlers(role: 'dealer' | 'buffer') {
  const identity = identityOf(storyCharacterDetail(role))

  return [http.get(characterUrl(identity), loadingResponse)]
}
