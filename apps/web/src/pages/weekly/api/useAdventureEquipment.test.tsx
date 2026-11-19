// @vitest-environment jsdom
import { delay, HttpResponse, http, type JsonBodyType } from 'msw'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdventureEquipment } from '#entities/adventure-guild'
import { API_BASE_URL } from '#shared/api/dfragon-api'
import type { LoadedResult } from '#shared/lib/useLoadedResult'
import { server } from '#testing/test-support/msw-server'
import { TestQueryClient } from '#testing/test-support/test-query-client'
import type { EquipmentSearch } from '#pages/weekly/equipment-search'
import { ADVENTURE_EQUIPMENT_URL } from './adventure.handlers'
import { useAdventureEquipment } from './useAdventureEquipment'

const INVALID_RESPONSE = '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.'

let container: HTMLDivElement
let root: Root
let result: LoadedResult<AdventureEquipment>
let requested: string[]

beforeEach(() => {
  result = { status: 'loading' }
  requested = []
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function Harness({
  adventureName,
  search
}: {
  adventureName: string
  search: EquipmentSearch
}): null {
  const value = useAdventureEquipment(adventureName, search)
  useEffect(() => {
    result = value
  })

  return null
}

function respond(body: JsonBodyType): void {
  server.use(
    http.get(ADVENTURE_EQUIPMENT_URL, ({ request }) => {
      requested.push(request.url)

      return HttpResponse.json(body)
    })
  )
}

async function settle(
  adventureName: string,
  search: EquipmentSearch = {}
): Promise<LoadedResult<AdventureEquipment>> {
  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness adventureName={adventureName} search={search} />
      </TestQueryClient>
    )
  )
  await vi.waitFor(() => expect(result.status).not.toBe('loading'))

  return result
}

const holding = {
  setItemId: 'set-a',
  rarity: '태초',
  itemId: 'item-1',
  itemName: '합성 상의',
  count: 1
}

const equipment: AdventureEquipment = {
  adventureName: '합성 모험단',
  sets: [{ setItemId: 'set-a', setItemName: '합성 세트' }],
  servers: [
    {
      serverId: 'cain',
      characters: [
        {
          serverId: 'cain',
          characterId: 'character-1',
          characterName: '합성 캐릭터',
          adventureName: '합성 모험단',
          level: 115,
          jobId: 'job-1',
          jobGrowId: 'grow-1',
          jobName: '합성 직업',
          jobGrowName: '眞 합성 전직',
          fame: 80123,
          guildId: null,
          guildName: null,
          role: null,
          equipment: [{ ...holding, slot: '상의' }],
          oaths: [{ ...holding, kind: 'crystal', itemName: '합성 결정', count: 3 }]
        }
      ]
    }
  ],
  selected: { serverId: 'cain', setItemId: 'set-a' }
}

it('모험단 이름을 encode해 한 경로 조각으로 담아 장비 보유 응답을 읽는다', async () => {
  respond(equipment)

  await expect(settle('합성 모험단/1')).resolves.toEqual({ status: 'success', value: equipment })
  expect(requested).toEqual([
    `${API_BASE_URL}/adventures/${encodeURIComponent('합성 모험단/1')}/equipment`
  ])
})

it('서버와 세트를 query로 담아 요청한다', async () => {
  respond(equipment)

  await settle('합성 모험단', { server: 'cain', set: 'set-a' })
  expect(requested).toEqual([
    `${API_BASE_URL}/adventures/${encodeURIComponent('합성 모험단')}/equipment?server=cain&set=set-a`
  ])
})

it('같은 모험단의 서버, 세트를 바꾸면 받는 동안 앞선 응답을 보이고, 다른 모험단으로 바꾸면 보이지 않는다', async () => {
  respond(equipment)
  await settle('합성 모험단')
  server.use(http.get(ADVENTURE_EQUIPMENT_URL, () => delay('infinite')))

  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness adventureName="합성 모험단" search={{ server: 'cain', set: 'set-b' }} />
      </TestQueryClient>
    )
  )
  expect(result).toEqual({ status: 'success', value: equipment })

  await act(async () =>
    root.render(
      <TestQueryClient>
        <Harness adventureName="다른 모험단" search={{ server: 'cain', set: 'set-b' }} />
      </TestQueryClient>
    )
  )
  expect(result).toEqual({ status: 'loading' })
})

it('캐릭터가 없는 응답도 읽는다', async () => {
  const empty = { adventureName: '없는 모험단', sets: [], servers: [], selected: null }
  respond(empty)

  await expect(settle('없는 모험단')).resolves.toEqual({ status: 'success', value: empty })
})

const character = equipment.servers[0]!.characters[0]!

it.each([
  [
    '모르는 서약 종류',
    { ...character, oaths: [{ ...holding, kind: 'stone', itemName: '합성 돌' }] }
  ],
  ['개수가 0인 칸', { ...character, equipment: [{ ...holding, slot: '상의', count: 0 }] }],
  ['oaths가 없는 캐릭터', { ...character, oaths: undefined }]
])('%s가 있는 응답은 응답 확인 실패 문구로 거부한다', async (_name, broken) => {
  respond({ ...equipment, servers: [{ serverId: 'cain', characters: [broken] }] })

  await expect(settle('합성 모험단')).resolves.toEqual({
    status: 'error',
    message: INVALID_RESPONSE
  })
})
