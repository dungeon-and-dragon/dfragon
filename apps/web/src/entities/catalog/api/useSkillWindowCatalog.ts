import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import {
  type SkillMarks,
  type SkillWindowCatalog,
  type SkillWindowIndex,
  type SkillWindowJob,
  skillWindowIndexSchema,
  skillWindowJobSchema
} from '#entities/catalog/model/skill-window'
import { type LoadedResult, useLoadedResult } from '#shared/lib/useLoadedResult'
import { absoluteUrl, fetchStaticJson, fetchUploadedStaticJson } from '#shared/lib/static-json'

// 스킬 창 데이터는 사이트 빌드에 넣지 않고 따로 올리며, edge nginx와 개발 서버가 같은 origin의 /skilltab/ 아래에 내준다.
export function skillWindowIndexUrl(): string {
  return `${window.location.origin}/skilltab/skilltab.v3.json`
}

function markUrlsOf(marks: SkillMarks, indexUrl: string): SkillMarks {
  const pair = ([first, second]: readonly [string, string]): [string, string] => [
    absoluteUrl(first, indexUrl),
    absoluteUrl(second, indexUrl)
  ]

  const evolution = pair(marks.evolution)
  const enhancement = pair(marks.enhancement)

  return { evolution, enhancement }
}

// 직업 파일과 그 안의 sprite 경로도 index처럼 /skilltab/ 기준이라, 모두 index 주소로 푼다.
async function requestSkillWindowIndex(): Promise<SkillWindowIndex | null> {
  const indexUrl = skillWindowIndexUrl()
  const json = await fetchUploadedStaticJson(indexUrl)
  if (json === null) {
    return null
  }

  const { marks, ...index } = skillWindowIndexSchema.parse(json)
  const jobs = index.jobs.map((job) => {
    const file = absoluteUrl(job.file, indexUrl)

    return { ...job, file }
  })
  const markUrls = markUrlsOf(marks, indexUrl)

  return { ...index, marks: markUrls, jobs }
}

async function requestSkillWindowJob(jobUrl: string): Promise<SkillWindowJob> {
  const job = skillWindowJobSchema.parse(await fetchStaticJson(jobUrl))
  const sprite = absoluteUrl(job.sprite, skillWindowIndexUrl())

  return { ...job, sprite }
}

// index와 직업 파일은 받은 뒤 페이지를 닫을 때까지 다시 받지 않고, 실패하면 캐시에 남지 않아 다음에 탭을 열 때 다시 받는다.
const KEEP_UNTIL_RELOAD = { staleTime: Infinity, gcTime: Infinity } as const

async function loadSkillWindowCatalog(
  queryClient: QueryClient,
  jobName: string
): Promise<SkillWindowCatalog | null> {
  const index = await queryClient.fetchQuery({
    queryKey: ['skill-window-index'],
    queryFn: requestSkillWindowIndex,
    ...KEEP_UNTIL_RELOAD
  })
  const entry = index?.jobs.find((job) => job.jobName === jobName)
  if (index === null || entry === undefined) {
    return null
  }

  const job = await queryClient.fetchQuery({
    queryKey: ['skill-window-job', entry.jobId],
    queryFn: () => requestSkillWindowJob(entry.file),
    ...KEEP_UNTIL_RELOAD
  })

  return { marks: index.marks, job }
}

export function useSkillWindowCatalog(
  jobName: string | null
): LoadedResult<SkillWindowCatalog | null> {
  const queryClient = useQueryClient()

  return useLoadedResult(['skill-window', jobName], async () => {
    if (jobName === null) {
      return null
    }

    return loadSkillWindowCatalog(queryClient, jobName)
  })
}
