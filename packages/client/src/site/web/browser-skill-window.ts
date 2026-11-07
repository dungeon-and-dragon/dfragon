import {
  type OathCatalog,
  oathCatalogSchema
} from '@dfragon/client-core/shared/search/oath-catalog'
import {
  type SkillMarks,
  type SkillWindowCatalog,
  skillWindowCatalogSchema
} from '@dfragon/client-core/shared/search/skill-window'

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

function readSkillWindowCatalog(json: unknown, catalogUrl: string): SkillWindowCatalog {
  const { marks, ...catalog } = skillWindowCatalogSchema.parse(json)
  const jobs = catalog.jobs.map((job) => ({ ...job, sprite: absoluteUrl(job.sprite, catalogUrl) }))
  if (marks === undefined) {
    return { ...catalog, jobs }
  }

  return { ...catalog, marks: markUrlsOf(marks, catalogUrl), jobs }
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

async function fetchCatalog<Catalog>(
  catalogUrl: string,
  read: (json: unknown, catalogUrl: string) => Catalog
): Promise<Catalog | null> {
  const response = await fetch(catalogUrl)
  // 스킬 창, 서약 데이터는 사이트 배포와 따로 올리므로, 아직 올리지 않은 곳은 실패가 아니라 데이터가 없는 상태다.
  if (response.status === NOT_UPLOADED_STATUS) {
    return null
  }

  if (!response.ok) {
    throw new Error(`게임 데이터를 받지 못했습니다(HTTP ${response.status}).`)
  }

  return read(await response.json(), catalogUrl)
}

function createCatalogSource<Catalog>(
  catalogUrl: string,
  read: (json: unknown, catalogUrl: string) => Catalog
): () => Promise<Catalog | null> {
  let request: Promise<Catalog | null> | null = null

  return () => {
    if (request === null) {
      const started = fetchCatalog(catalogUrl, read)
      request = started
      // 실패한 요청은 지워 다음에 탭을 열 때 다시 받는다.
      started.catch(() => {
        if (request === started) {
          request = null
        }
      })
    }

    return request
  }
}

export function createSkillWindowCatalogSource(
  catalogUrl: string
): () => Promise<SkillWindowCatalog | null> {
  return createCatalogSource(catalogUrl, readSkillWindowCatalog)
}

export function createOathCatalogSource(catalogUrl: string): () => Promise<OathCatalog | null> {
  return createCatalogSource(catalogUrl, readOathCatalog)
}
