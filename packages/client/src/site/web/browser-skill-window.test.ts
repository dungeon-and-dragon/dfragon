// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { createOathCatalogSource, createSkillWindowCatalogSource } from './browser-skill-window'

const INDEX_URL = 'https://site.example.test/skilltab/skilltab.v3.json'
const PRIEST_FILE_URL = 'https://site.example.test/skilltab/1d9658f7/jobs/priest.521c797c.json'
const MAGE_FILE_URL = 'https://site.example.test/skilltab/1d9658f7/jobs/mage.0f3e2d1c.json'

const INDEX_JSON = {
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
    { jobId: 'priest', jobName: '프리스트(남)', file: '1d9658f7/jobs/priest.521c797c.json' },
    { jobId: 'mage', jobName: '마법사(여)', file: '1d9658f7/jobs/mage.0f3e2d1c.json' }
  ]
}

function jobJson(jobId: string, jobName: string) {
  return {
    jobId,
    jobName,
    sprite: `1d9658f7/sprites/${jobId}.521c797c.png`,
    advancements: [],
    skills: {
      1: {
        name: '공참타',
        kind: 'active',
        requiredLevel: 1,
        maxLevel: 20,
        icon: { x: 0, y: 0 },
        stage: false
      }
    }
  }
}

const RESPONSES: Readonly<Record<string, () => Response>> = {
  [INDEX_URL]: () => Response.json(INDEX_JSON),
  [PRIEST_FILE_URL]: () => Response.json(jobJson('priest', '프리스트(남)')),
  [MAGE_FILE_URL]: () => Response.json(jobJson('mage', '마법사(여)'))
}

function stubSkillTab(overrides: Readonly<Record<string, () => Response>> = {}) {
  const fetch = vi.fn(async (url: string) => {
    const respond = overrides[url] ?? RESPONSES[url]
    if (respond === undefined) {
      throw new Error(`예상하지 않은 요청: ${url}`)
    }

    return respond()
  })
  vi.stubGlobal('fetch', fetch)

  return fetch
}

function requestedUrls(fetch: ReturnType<typeof stubSkillTab>): string[] {
  return fetch.mock.calls.map(([url]) => url)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('직업 파일, sprite, 개화와 강화 표식 경로를 skilltab.v3.json 주소 기준의 절대 주소로 바꾼다', async () => {
  stubSkillTab()

  const catalog = await createSkillWindowCatalogSource(INDEX_URL)('프리스트(남)')

  expect(catalog?.job.sprite).toBe(
    'https://site.example.test/skilltab/1d9658f7/sprites/priest.521c797c.png'
  )
  expect(catalog?.marks.evolution[1]).toBe(
    'https://site.example.test/skilltab/1d9658f7/marks/evolution-2.b314323a.png'
  )
  expect(catalog?.marks.enhancement[0]).toBe(
    'https://site.example.test/skilltab/1d9658f7/marks/enhancement-1.77cf8f9d.png'
  )
})

it('index는 한 번만 받고, 같은 직업은 직업 파일을 다시 받지 않으며 다른 직업은 그 직업 파일만 받는다', async () => {
  const fetch = stubSkillTab()
  const load = createSkillWindowCatalogSource(INDEX_URL)

  const [first, second] = await Promise.all([load('프리스트(남)'), load('프리스트(남)')])
  const mage = await load('마법사(여)')

  expect(second?.job).toBe(first?.job)
  expect(mage?.job.jobId).toBe('mage')
  expect(requestedUrls(fetch)).toEqual([INDEX_URL, PRIEST_FILE_URL, MAGE_FILE_URL])
})

it('index를 아직 올리지 않아 404면 직업 파일을 요청하지 않고 데이터 없음으로 돌려준다', async () => {
  const fetch = stubSkillTab({ [INDEX_URL]: () => new Response(null, { status: 404 }) })

  await expect(createSkillWindowCatalogSource(INDEX_URL)('프리스트(남)')).resolves.toBeNull()
  expect(requestedUrls(fetch)).toEqual([INDEX_URL])
})

it('index에 그 직업이 없으면 직업 파일을 요청하지 않고 데이터 없음으로 돌려준다', async () => {
  const fetch = stubSkillTab()

  await expect(createSkillWindowCatalogSource(INDEX_URL)('총검사')).resolves.toBeNull()
  expect(requestedUrls(fetch)).toEqual([INDEX_URL])
})

it('index를 받지 못하면 실패를 알리고 다음 요청에서 다시 받는다', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json(INDEX_JSON))
    .mockResolvedValueOnce(Response.json(jobJson('priest', '프리스트(남)')))
  vi.stubGlobal('fetch', fetch)
  const load = createSkillWindowCatalogSource(INDEX_URL)

  await expect(load('프리스트(남)')).rejects.toThrow('HTTP 503')
  await expect(load('프리스트(남)')).resolves.toMatchObject({ job: { jobId: 'priest' } })
  expect(fetch).toHaveBeenCalledTimes(3)
})

it('직업 파일을 받지 못하면 실패를 알리고 다음 요청에서 그 직업 파일만 다시 받는다', async () => {
  let failed = false
  const fetch = stubSkillTab({
    [PRIEST_FILE_URL]: () => {
      if (!failed) {
        failed = true

        return new Response(null, { status: 503 })
      }

      return Response.json(jobJson('priest', '프리스트(남)'))
    }
  })
  const load = createSkillWindowCatalogSource(INDEX_URL)

  await expect(load('프리스트(남)')).rejects.toThrow('HTTP 503')
  await expect(load('프리스트(남)')).resolves.toMatchObject({ job: { jobId: 'priest' } })
  expect(requestedUrls(fetch)).toEqual([INDEX_URL, PRIEST_FILE_URL, PRIEST_FILE_URL])
})

it('단계 스킬 여부가 없는 직업 파일은 받지 않는다', async () => {
  const { skills, ...job } = jobJson('priest', '프리스트(남)')
  const { stage: _stage, ...skill } = skills[1]
  stubSkillTab({ [PRIEST_FILE_URL]: () => Response.json({ ...job, skills: { 1: skill } }) })

  await expect(createSkillWindowCatalogSource(INDEX_URL)('프리스트(남)')).rejects.toBeInstanceOf(
    ZodError
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
