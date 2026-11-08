// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { createOathCatalogSource, createSkillWindowCatalogSource } from './browser-skill-window'

const CATALOG_URL = 'https://site.example.test/skilltab/skilltab.v2.json'

const CATALOG_JSON = {
  version: 'synthetic',
  marks: {
    evolution: [
      '1d9658f7/marks/evolution-1.8df0e8da.png',
      '1d9658f7/marks/evolution-2.b314323a.png'
    ],
    enhancement: [
      '1d9658f7/marks/enhancement-1.77cf8f9d.png',
      '1d9658f7/marks/enhancement-2.5be2681f.png'
    ]
  },
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

it('sprite 경로를 skilltab.v2.json 주소 기준의 절대 주소로 바꾸고 한 번만 받는다', async () => {
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

it('개화, 강화 표식 경로도 skilltab.v2.json 주소 기준의 절대 주소로 바꾼다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(CATALOG_JSON))
  )

  const catalog = await createSkillWindowCatalogSource(CATALOG_URL)()

  expect(catalog?.marks.evolution[1]).toBe(
    'https://site.example.test/skilltab/1d9658f7/marks/evolution-2.b314323a.png'
  )
  expect(catalog?.marks.enhancement[0]).toBe(
    'https://site.example.test/skilltab/1d9658f7/marks/enhancement-1.77cf8f9d.png'
  )
})

it('서약 세트, 선택지 아이콘 경로를 oath.v2.json 주소 기준의 절대 주소로 바꾼다', async () => {
  const effects = {
    rare: null,
    unique: null,
    legendary: null,
    epic: null,
    primitive: [[{ text: '효과', tone: 'rarity-primordial' }]]
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        version: 'synthetic',
        sets: [
          {
            setId: 16204,
            name: '야망의 용투 서약',
            icon: '1d9658f7/oath-set/16204.0a1b2c3d.png',
            options: [
              { name: '용투 : 세계를 태우는 불꽃', icon: '1d9658f7/oath/9.4e5f6a7b.png', effects }
            ]
          },
          { setId: 50000, name: '안개 서약', icon: null, options: [] }
        ],
        items: []
      })
    )
  )

  const catalog = await createOathCatalogSource('https://site.example.test/skilltab/oath.v2.json')()

  expect(catalog?.sets[0]?.icon).toBe(
    'https://site.example.test/skilltab/1d9658f7/oath-set/16204.0a1b2c3d.png'
  )
  expect(catalog?.sets[0]?.options[0]?.icon).toBe(
    'https://site.example.test/skilltab/1d9658f7/oath/9.4e5f6a7b.png'
  )
  expect(catalog?.sets[1]?.icon).toBeNull()
})

it('문구가 줄 목록이 아닌 서약 데이터는 받지 않는다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        version: 'synthetic',
        sets: [
          {
            setId: 16204,
            name: '야망의 용투 서약',
            icon: null,
            options: [
              {
                name: '용투 : 세계를 태우는 불꽃',
                icon: '1d9658f7/oath/9.4e5f6a7b.png',
                effects: {
                  rare: null,
                  unique: null,
                  legendary: null,
                  epic: null,
                  primitive: '효과'
                }
              }
            ]
          }
        ],
        items: []
      })
    )
  )

  await expect(
    createOathCatalogSource('https://site.example.test/skilltab/oath.v2.json')()
  ).rejects.toBeInstanceOf(ZodError)
})

it('서약 아이템 아이콘 경로도 oath.v2.json 주소 기준의 절대 주소로 바꾼다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        version: 'synthetic',
        sets: [],
        items: [
          {
            name: '세계를 태우는 용투 서약',
            rarity: '태초',
            icon: '1d9658f7/oath-item/100610081.5d6e7f80.webp'
          }
        ]
      })
    )
  )

  const catalog = await createOathCatalogSource('https://site.example.test/skilltab/oath.v2.json')()

  expect(catalog?.items).toEqual([
    {
      name: '세계를 태우는 용투 서약',
      rarity: '태초',
      icon: 'https://site.example.test/skilltab/1d9658f7/oath-item/100610081.5d6e7f80.webp'
    }
  ])
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
  await expect(load()).resolves.toMatchObject({ version: 'synthetic' })
  expect(fetch).toHaveBeenCalledTimes(2)
})
