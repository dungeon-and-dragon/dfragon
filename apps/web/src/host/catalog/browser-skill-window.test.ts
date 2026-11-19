// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { createOathCatalogSource } from './browser-skill-window'

afterEach(() => {
  vi.unstubAllGlobals()
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
