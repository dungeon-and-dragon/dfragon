import { type OathCatalog, oathCatalogSchema } from '#core/shared/search/oath-catalog'
import {
  type SkillMarks,
  type SkillWindowCatalog,
  type SkillWindowIndex,
  type SkillWindowJob,
  skillWindowIndexSchema,
  skillWindowJobSchema
} from '#core/shared/search/skill-window'

// 그림 경로는 데이터 파일 기준의 상대 경로라, 화면이 데이터 위치를 몰라도 되게 절대 주소로 바꿔 둔다.
function absoluteUrl(path: string, catalogUrl: string): string {
  return new URL(path, catalogUrl).href
}

function markUrlsOf(marks: SkillMarks, catalogUrl: string): SkillMarks {
  const pair = ([first, second]: readonly [string, string]): [string, string] => [
    absoluteUrl(first, catalogUrl),
    absoluteUrl(second, catalogUrl)
  ]

  return { evolution: pair(marks.evolution), enhancement: pair(marks.enhancement) }
}

// 직업 파일과 그 안의 sprite 경로도 index처럼 /skilltab/ 기준이라, 모두 index 주소로 푼다.
function readSkillWindowIndex(json: unknown, indexUrl: string): SkillWindowIndex {
  const { marks, ...index } = skillWindowIndexSchema.parse(json)
  const jobs = index.jobs.map((job) => ({ ...job, file: absoluteUrl(job.file, indexUrl) }))
  const markUrls = markUrlsOf(marks, indexUrl)

  return { ...index, marks: markUrls, jobs }
}

function readSkillWindowJob(json: unknown, indexUrl: string): SkillWindowJob {
  const job = skillWindowJobSchema.parse(json)
  const sprite = absoluteUrl(job.sprite, indexUrl)

  return { ...job, sprite }
}

function readOathCatalog(json: unknown, catalogUrl: string): OathCatalog {
  const catalog = oathCatalogSchema.parse(json)
  const sets = catalog.sets.map((set) => {
    const icon = set.icon !== null ? absoluteUrl(set.icon, catalogUrl) : null
    const options = set.options.map((option) => ({
      ...option,
      icon: absoluteUrl(option.icon, catalogUrl)
    }))

    return { ...set, icon, options }
  })
  const items = catalog.items.map((item) => ({ ...item, icon: absoluteUrl(item.icon, catalogUrl) }))

  return { ...catalog, sets, items }
}

const NOT_UPLOADED_STATUS = 404

async function jsonOf(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`게임 데이터를 받지 못했습니다(HTTP ${response.status}).`)
  }

  return response.json()
}

async function fetchCatalog<Catalog>(
  catalogUrl: string,
  read: (json: unknown, catalogUrl: string) => Catalog
): Promise<Catalog | null> {
  const response = await fetch(catalogUrl)
  // 스킬 창, 서약 데이터는 사이트 배포와 따로 올리므로, 아직 올리지 않은 곳은 실패가 아니라 데이터가 없는 상태다.
  if (response.status === NOT_UPLOADED_STATUS) {
    return null
  }

  return read(await jsonOf(response), catalogUrl)
}

function createRequestCache<Value>(): (key: string, start: () => Promise<Value>) => Promise<Value> {
  const requests = new Map<string, Promise<Value>>()

  return (key, start) => {
    const remembered = requests.get(key)
    if (remembered !== undefined) {
      return remembered
    }
    const started = start()
    requests.set(key, started)
    // 실패한 요청은 지워 다음에 탭을 열 때 다시 받는다.
    started.catch(() => {
      if (requests.get(key) === started) {
        requests.delete(key)
      }
    })

    return started
  }
}

function createCatalogSource<Catalog>(
  catalogUrl: string,
  read: (json: unknown, catalogUrl: string) => Catalog
): () => Promise<Catalog | null> {
  const remember = createRequestCache<Catalog | null>()

  return () => remember(catalogUrl, () => fetchCatalog(catalogUrl, read))
}

async function fetchSkillWindowJob(jobUrl: string, indexUrl: string): Promise<SkillWindowJob> {
  const response = await fetch(jobUrl)

  return readSkillWindowJob(await jsonOf(response), indexUrl)
}

export function createSkillWindowCatalogSource(
  indexUrl: string
): (jobName: string) => Promise<SkillWindowCatalog | null> {
  const loadIndex = createCatalogSource(indexUrl, readSkillWindowIndex)
  const rememberJob = createRequestCache<SkillWindowJob>()

  return async (jobName) => {
    const index = await loadIndex()
    const entry = index?.jobs.find((job) => job.jobName === jobName)
    if (index === null || entry === undefined) {
      return null
    }
    const job = await rememberJob(entry.jobId, () => fetchSkillWindowJob(entry.file, indexUrl))

    return { marks: index.marks, job }
  }
}

export function createOathCatalogSource(catalogUrl: string): () => Promise<OathCatalog | null> {
  return createCatalogSource(catalogUrl, readOathCatalog)
}
