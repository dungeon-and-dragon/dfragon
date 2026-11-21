// @vitest-environment jsdom
import { HttpResponse, http } from 'msw'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { OathCatalog } from '#entities/catalog/model/oath-catalog'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import { OATH_CATALOG_URL } from './oath-catalog.handlers'
import { useOathCatalog } from './useOathCatalog'

const SKILLTAB_URL = `${window.location.origin}/skilltab`

const EFFECTS = {
  rare: null,
  unique: null,
  legendary: null,
  epic: null,
  primitive: [[{ text: '효과', tone: 'rarity-primordial' }]]
}

const CATALOG_JSON = {
  version: 'synthetic',
  sets: [
    {
      setId: 16204,
      name: '야망의 용투 서약',
      icon: '1d9658f7/oath-set/16204.0a1b2c3d.png',
      options: [
        {
          name: '용투 : 세계를 태우는 불꽃',
          icon: '1d9658f7/oath/9.4e5f6a7b.png',
          effects: EFFECTS
        }
      ]
    },
    { setId: 50000, name: '안개 서약', icon: null, options: [] }
  ],
  items: [
    {
      name: '세계를 태우는 용투 서약',
      rarity: '태초',
      icon: '1d9658f7/oath-item/100610081.5d6e7f80.webp'
    }
  ]
}

let container: HTMLDivElement
let root: Root
let requests: number

beforeEach(() => {
  requests = 0
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function respondOathCatalog(respond: () => Response): void {
  server.use(
    http.get(OATH_CATALOG_URL, () => {
      requests += 1

      return respond()
    })
  )
}

type CatalogResult = LoadedResult<OathCatalog | null>

function Harness(): React.JSX.Element {
  return <output>{JSON.stringify(useOathCatalog())}</output>
}

// 같은 root에 다시 그리면 TestQueryClient가 남아 있어, hook만 다시 mount해도 같은 캐시를 쓴다.
async function render(mounted = true): Promise<CatalogResult | null> {
  await act(async () => root.render(<TestQueryClient>{mounted && <Harness />}</TestQueryClient>))
  if (!mounted) {
    return null
  }

  return vi.waitFor(() => {
    const result: CatalogResult = JSON.parse(container.querySelector('output')?.textContent ?? '')
    expect(result.status).not.toBe('loading')

    return result
  })
}

it('서약 세트, 선택지, 서약 아이템 아이콘 경로를 oath.v2.json 주소 기준의 절대 주소로 바꾼다', async () => {
  respondOathCatalog(() => HttpResponse.json(CATALOG_JSON))

  const result = await render()

  expect(result).toMatchObject({
    status: 'success',
    value: {
      sets: [
        {
          icon: `${SKILLTAB_URL}/1d9658f7/oath-set/16204.0a1b2c3d.png`,
          options: [{ icon: `${SKILLTAB_URL}/1d9658f7/oath/9.4e5f6a7b.png` }]
        },
        { setId: 50000, icon: null }
      ],
      items: [
        {
          name: '세계를 태우는 용투 서약',
          rarity: '태초',
          icon: `${SKILLTAB_URL}/1d9658f7/oath-item/100610081.5d6e7f80.webp`
        }
      ]
    }
  })
})

it('문구가 줄 목록이 아닌 서약 데이터는 받지 않는다', async () => {
  const [set] = CATALOG_JSON.sets
  const options = [{ ...set?.options[0], effects: { ...EFFECTS, primitive: '효과' } }]
  respondOathCatalog(() => HttpResponse.json({ ...CATALOG_JSON, sets: [{ ...set, options }] }))

  const result = await render()

  expect(result).toEqual({ status: 'error', message: expect.stringContaining('primitive') })
})

it('서약 데이터를 아직 올리지 않아 404면 데이터 없음으로 돌려준다', async () => {
  respondOathCatalog(() => new HttpResponse(null, { status: 404 }))

  expect(await render()).toEqual({ status: 'success', value: null })
})

it('서약 데이터를 한 번 받으면 다시 mount해도 다시 받지 않는다', async () => {
  respondOathCatalog(() => HttpResponse.json(CATALOG_JSON))

  const first = await render()
  await render(false)
  const second = await render()

  expect(second).toEqual(first)
  expect(requests).toBe(1)
})

it('서약 데이터를 받지 못하면 실패를 알리고 다시 mount하면 다시 받는다', async () => {
  let failed = false
  respondOathCatalog(() => {
    if (!failed) {
      failed = true

      return new HttpResponse(null, { status: 503 })
    }

    return HttpResponse.json(CATALOG_JSON)
  })

  const failure = await render()
  await render(false)
  const retried = await render()

  expect(failure).toEqual({ status: 'error', message: expect.stringContaining('HTTP 503') })
  expect(retried).toMatchObject({ status: 'success', value: { version: 'synthetic' } })
  expect(requests).toBe(2)
})
