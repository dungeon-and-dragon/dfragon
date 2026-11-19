import { delay, HttpResponse, http } from 'msw'
import type { SkillWindowCatalog } from '#entities/catalog'
import type { CharacterDetailView, CharacterHistory, CharacterIdentity } from '#entities/character'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import { characterPath } from './character-api'
import {
  storyBuffSkillWindowCatalog,
  storyCharacterDetail,
  storyHistory,
  storySkillWindowCatalog,
  storyTimeline
} from './character.fixture'
import { SKILL_WINDOW_INDEX_URL } from './useSkillWindowCatalog'

export const SKILL_STATS_URL = `${API_BASE_URL}/stats/skills`

export function characterUrl(identity: CharacterIdentity, path = ''): string {
  return `${API_BASE_URL}${characterPath(identity)}${path}`
}

function identityOf({ character }: CharacterDetailView): CharacterIdentity {
  return { serverId: character.serverId, characterId: character.characterId }
}

function skillWindowJobUrl(jobId: string): string {
  return new URL(`jobs/${jobId}.json`, SKILL_WINDOW_INDEX_URL).href
}

export function apiFailure(status: number, code: string, message: string): HttpResponse<object> {
  return HttpResponse.json({ error: { code, message } }, { status })
}

export async function loadingResponse(): Promise<void> {
  await delay('infinite')
}

export function skillWindowHandlers(catalogs: readonly SkillWindowCatalog[]) {
  const [first] = catalogs

  return [
    http.get(SKILL_WINDOW_INDEX_URL, () => {
      if (first === undefined) {
        return new HttpResponse(null, { status: 404 })
      }

      const jobs = catalogs.map(({ job }) => {
        const file = skillWindowJobUrl(job.jobId)

        return { jobId: job.jobId, jobName: job.jobName, file }
      })

      return HttpResponse.json({ version: 'fixture', marks: first.marks, jobs })
    }),
    ...catalogs.map(({ job }) =>
      http.get(skillWindowJobUrl(job.jobId), () => HttpResponse.json(job))
    )
  ]
}

export function characterDetailHandlers(
  detail: CharacterDetailView,
  history: CharacterHistory = storyHistory
) {
  const identity = identityOf(detail)

  return [
    http.get(characterUrl(identity), () => HttpResponse.json(detail)),
    http.get(characterUrl(identity, '/timeline'), () => HttpResponse.json(storyTimeline)),
    http.get(characterUrl(identity, '/timeline/enhancements'), loadingResponse),
    http.get(characterUrl(identity, '/timeline/acquisitions'), loadingResponse),
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
