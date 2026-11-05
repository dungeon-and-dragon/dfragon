import {
  type SkillWindowCatalog,
  skillWindowCatalogSchema
} from '@dfragon/client-core/shared/search/skill-window'

// sprite 경로는 skilltab.json 기준의 상대 경로라, 화면이 데이터 위치를 몰라도 되게 절대 주소로 바꿔 둔다.
function withSpriteUrls(catalog: SkillWindowCatalog, catalogUrl: string): SkillWindowCatalog {
  const jobs = catalog.jobs.map((job) => ({ ...job, sprite: new URL(job.sprite, catalogUrl).href }))

  return { ...catalog, jobs }
}

const NOT_UPLOADED_STATUS = 404

async function fetchCatalog(catalogUrl: string): Promise<SkillWindowCatalog | null> {
  const response = await fetch(catalogUrl)
  // 스킬 창 데이터는 사이트 배포와 따로 올리므로, 아직 올리지 않은 곳은 실패가 아니라 데이터가 없는 상태다.
  if (response.status === NOT_UPLOADED_STATUS) {
    return null
  }

  if (!response.ok) {
    throw new Error(`스킬 창 데이터를 받지 못했습니다(HTTP ${response.status}).`)
  }

  return withSpriteUrls(skillWindowCatalogSchema.parse(await response.json()), catalogUrl)
}

export function createSkillWindowCatalogSource(
  catalogUrl: string
): () => Promise<SkillWindowCatalog | null> {
  let request: Promise<SkillWindowCatalog | null> | null = null

  return () => {
    if (request === null) {
      const started = fetchCatalog(catalogUrl)
      request = started
      // 실패한 요청은 지워 다음에 스킬 탭을 열 때 다시 받는다.
      started.catch(() => {
        if (request === started) {
          request = null
        }
      })
    }

    return request
  }
}
