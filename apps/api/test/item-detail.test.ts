import assert from 'node:assert/strict'
import test from 'node:test'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import type { FetchCatalog } from '@dfragon/server-core/application/character-catalog/ports.js'
import { createApiHttpApp } from '../src/runtime/api-app.js'
import { projectItemDetail } from '../src/domain/item-detail/project.js'

const bladeId = '49d73ddb4974cc8ee23c0da2e253cf2a'
// Neople 아이템 상세 응답에서 툴팁에 쓰지 않는 필드 일부를 남긴 사본이다.
const bladeRow = {
  itemId: bladeId,
  itemName: '제2형 - 수식, 방어의 운검',
  itemRarity: '에픽',
  itemType: '무기',
  itemTypeId: 'weapon',
  itemTypeDetail: '대검',
  itemTypeDetailId: 'bigsword',
  itemAvailableLevel: 115,
  fame: 8500,
  itemStatus: [
    { name: '모험가 명성', value: 8500 },
    { name: '물리 공격력', value: 1683 },
    { name: '적중률', value: '15%' }
  ],
  itemExplain: '[호위무사의 혼]장착 시 호위무사의 혼이 착용자를 보호합니다.',
  itemExplainDetail: '[호위무사의 혼]\n장착 시 호위무사의 혼이 착용자를 보호합니다.',
  itemFlavorText: '방어는 최선의 공격이지',
  setItemId: null
}

async function startItemApp(t: test.TestContext, fetchCatalog: FetchCatalog) {
  const unusedProvider = async (): Promise<never> => {
    throw new Error('item detail test must not call character providers')
  }
  const { app } = await createApiHttpApp({
    search: { searchCharacters: unusedProvider },
    details: { fetchDetails: unusedProvider, catalog: new CatalogService(fetchCatalog) },
    todayGrade: { fetchShopGrade: async () => 85 },
    writeAccessLog: () => undefined
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')

  return app.getUrl()
}

function recordingCatalog(rows: Record<string, unknown>[]) {
  const calls: string[][] = []
  const fetchCatalog: FetchCatalog = async (itemIds) => {
    calls.push(itemIds)

    return new Map(rows.map((row) => [row.itemId as string, row]))
  }

  return { calls, fetchCatalog }
}

test('GET /items/:itemId는 Neople 아이템 상세를 툴팁 필드로 좁히고 능력치 값을 문자열로 준다', async (t) => {
  const { fetchCatalog } = recordingCatalog([bladeRow])
  const origin = await startItemApp(t, fetchCatalog)

  const response = await fetch(`${origin}/items/${bladeId}`)

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'public, max-age=86400')
  assert.deepEqual(await response.json(), {
    itemId: bladeId,
    name: '제2형 - 수식, 방어의 운검',
    rarity: '에픽',
    itemType: '무기',
    typeDetail: '대검',
    availableLevel: 115,
    fame: 8500,
    status: [
      { name: '모험가 명성', value: '8500' },
      { name: '물리 공격력', value: '1683' },
      { name: '적중률', value: '15%' }
    ],
    explain: '[호위무사의 혼]\n장착 시 호위무사의 혼이 착용자를 보호합니다.',
    flavorText: '방어는 최선의 공격이지',
    card: null
  })
})

test('상세 설명이 없거나 비어 있으면 짧은 설명을 쓰고, 없는 선택 필드는 null로 준다', () => {
  const { itemExplainDetail: _detail, ...withoutDetail } = bladeRow
  assert.equal(projectItemDetail(bladeId, withoutDetail)?.explain, bladeRow.itemExplain)
  assert.equal(
    projectItemDetail(bladeId, { ...bladeRow, itemExplainDetail: '' })?.explain,
    bladeRow.itemExplain
  )

  assert.deepEqual(projectItemDetail(bladeId, { itemId: bladeId, itemName: '이름만' }), {
    itemId: bladeId,
    name: '이름만',
    rarity: null,
    itemType: null,
    typeDetail: null,
    availableLevel: null,
    fame: null,
    status: [],
    explain: null,
    flavorText: null,
    card: null
  })
})

// 카드 이름과 부위는 지어낸 값이고, cardInfo 모양과 숫자, 문자열이 섞인 옵션 값은 Neople 실제 응답을 따랐다.
const cardId = '0239b1478c2a8214e70eac57581cddd2'
const cardRow = {
  itemId: cardId,
  itemName: '합성 버퍼 카드',
  itemRarity: '레전더리',
  itemType: '카드',
  itemStatus: [{ name: '모험가 명성', value: 210 }],
  cardInfo: {
    slots: [
      { slotId: 'JACKET', slotName: '상의' },
      { slotId: 'PANTS', slotName: '하의' }
    ],
    enchant: [
      {
        upgrade: 1,
        status: [
          { name: '힘', value: 105 },
          { name: '캐스트속도', value: '6%' },
          { name: '모험가 명성', value: 196 }
        ]
      },
      {
        upgrade: 0,
        status: [
          { name: '힘', value: 100 },
          { name: '캐스트속도', value: '5%' },
          { name: '모험가 명성', value: 196 }
        ]
      }
    ]
  }
}

test('카드는 부여 부위 이름과 강화 단계별 옵션을 낮은 단계부터 주고, 옵션 값은 숫자도 문자열로 준다', async (t) => {
  const { fetchCatalog } = recordingCatalog([cardRow])
  const origin = await startItemApp(t, fetchCatalog)

  const response = await fetch(`${origin}/items/${cardId}`)
  const { card } = (await response.json()) as { card: unknown }

  assert.deepEqual(card, {
    slots: ['상의', '하의'],
    enchants: [
      {
        upgrade: 0,
        status: [
          { name: '힘', value: '100' },
          { name: '캐스트속도', value: '5%' },
          { name: '모험가 명성', value: '196' }
        ],
        reinforceSkill: []
      },
      {
        upgrade: 1,
        status: [
          { name: '힘', value: '105' },
          { name: '캐스트속도', value: '6%' },
          { name: '모험가 명성', value: '196' }
        ],
        reinforceSkill: []
      }
    ]
  })
})

test('버프 스킬을 올리는 카드는 단계마다 직업별 스킬 이름과 값을 문자열로 준다', async (t) => {
  // 카드 이름과 직업, 스킬 이름은 지어낸 값이고, reinforceSkill 모양은 Neople 실제 응답을 따랐다.
  const buffCardId = 'synthetic-buff-card'
  const { fetchCatalog } = recordingCatalog([
    {
      itemId: buffCardId,
      itemName: '합성 버프 카드',
      itemType: '카드',
      cardInfo: {
        slots: [{ slotId: 'JACKET', slotName: '상의' }],
        enchant: [
          {
            upgrade: 0,
            status: [{ name: '힘', value: 105 }],
            reinforceSkill: [
              {
                jobId: 'synthetic-job',
                jobName: '합성 직업',
                skills: [{ skillId: 'synthetic-skill', name: '합성 버프', value: 4 }]
              }
            ]
          }
        ]
      }
    }
  ])
  const origin = await startItemApp(t, fetchCatalog)

  const response = await fetch(`${origin}/items/${buffCardId}`)
  const { card } = (await response.json()) as { card: { enchants: unknown[] } }

  assert.deepEqual(card.enchants, [
    {
      upgrade: 0,
      status: [{ name: '힘', value: '105' }],
      reinforceSkill: [{ jobName: '합성 직업', skills: [{ name: '합성 버프', value: '4' }] }]
    }
  ])
})

test('GET /items/:itemId는 형식이 잘못된 itemId를 Neople에 묻지 않고 400으로 거절한다', async (t) => {
  const { calls, fetchCatalog } = recordingCatalog([bladeRow])
  const origin = await startItemApp(t, fetchCatalog)

  const response = await fetch(`${origin}/items/bad.item`)

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    error: { code: 'INVALID_ITEM_QUERY', message: '아이템 ID를 확인해 주세요.' }
  })
  assert.deepEqual(calls, [])
})

test('GET /items/:itemId는 Neople에서 아이템을 받지 못하면 502를 준다', async (t) => {
  const failures: [string, FetchCatalog][] = [
    [
      'Neople 조회 실패',
      async () => {
        throw new Error('Catalog lookup failed')
      }
    ],
    ['응답에 없는 itemId', async () => new Map()],
    [
      '능력치 형태가 다른 응답',
      async () => new Map([[bladeId, { ...bladeRow, itemStatus: [{ name: '힘' }] }]])
    ]
  ]
  for (const [name, fetchCatalog] of failures) {
    const origin = await startItemApp(t, fetchCatalog)

    const response = await fetch(`${origin}/items/${bladeId}`)

    assert.equal(response.status, 502, name)
    assert.equal(response.headers.get('cache-control'), 'no-store', name)
    assert.deepEqual(
      await response.json(),
      { error: { code: 'NEOPLE_API_ERROR', message: '아이템 정보 조회 중 오류가 발생했습니다.' } },
      name
    )
  }
})

test('GET /items/today-grade는 아이템 상세 경로가 붙어도 오늘의 등급을 준다', async (t) => {
  const { calls, fetchCatalog } = recordingCatalog([bladeRow])
  const origin = await startItemApp(t, fetchCatalog)

  const response = await fetch(`${origin}/items/today-grade`)

  assert.equal(response.status, 200)
  const body = (await response.json()) as { percent: unknown }
  assert.equal(body.percent, 85)
  assert.deepEqual(calls, [])
})
