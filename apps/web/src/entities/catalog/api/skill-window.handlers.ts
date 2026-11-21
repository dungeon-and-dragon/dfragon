import { HttpResponse, http } from 'msw'
import type { SkillWindowCatalog } from '#entities/catalog/model/skill-window'
import { skillWindowIndexUrl } from './useSkillWindowCatalog'

export const SKILL_WINDOW_INDEX_URL = skillWindowIndexUrl()

function skillWindowJobUrl(jobId: string): string {
  return new URL(`jobs/${jobId}.json`, SKILL_WINDOW_INDEX_URL).href
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
