// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createSkillWindowCatalogSource } from './browser-skill-window'

const CATALOG_URL = 'https://site.example.test/skilltab/skilltab.json'

const CATALOG_JSON = {
  pvfSha256: 'synthetic',
  jobs: [
    {
      jobId: 'priest',
      jobName: '프리스트(남)',
      sprite: '1d9658f7/sprites/priest.521c797c.png',
      advancements: [],
      skills: {
        1: { name: '공참타', kind: 'active', requiredLevel: 1, maxLevel: 20, icon: { x: 0, y: 0 } }
      }
    }
  ]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('sprite 경로를 skilltab.json 주소 기준의 절대 주소로 바꾸고 한 번만 받는다', async () => {
  const fetch = vi.fn(async () => Response.json(CATALOG_JSON))
  vi.stubGlobal('fetch', fetch)
  const load = createSkillWindowCatalogSource(CATALOG_URL)

  const [first, second] = await Promise.all([load(), load()])

  expect(first?.jobs[0]?.sprite).toBe(
    'https://site.example.test/skilltab/1d9658f7/sprites/priest.521c797c.png'
  )
  expect(second).toBe(first)
  expect(fetch).toHaveBeenCalledOnce()
})

it('아직 올리지 않아 404면 실패가 아니라 데이터 없음으로 돌려준다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 404 }))
  )

  await expect(createSkillWindowCatalogSource(CATALOG_URL)()).resolves.toBeNull()
})

it('받지 못하면 실패를 알리고 다음 요청에서 다시 받는다', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json(CATALOG_JSON))
  vi.stubGlobal('fetch', fetch)
  const load = createSkillWindowCatalogSource(CATALOG_URL)

  await expect(load()).rejects.toThrow('HTTP 503')
  await expect(load()).resolves.toMatchObject({ pvfSha256: 'synthetic' })
  expect(fetch).toHaveBeenCalledTimes(2)
})
