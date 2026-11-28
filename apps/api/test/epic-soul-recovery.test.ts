import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { findEquipmentVariant, findWeaponVariant } from '@dfragon/lib/equipment-variants'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import { toSectionBodies } from '@dfragon/server-core/domain/character-history/index.js'
import {
  payloadsFromEngineInput,
  readEngineInput
} from '@dfragon/server-core/test/score-fixtures.js'
import type { CharacterHistoryRepository } from '../src/application/character-history/repository.js'
import { type ApiHttpAppOptions, createApiHttpApp } from '../src/runtime/api-app.js'

type Item = Record<string, unknown>

const EPIC_GREATSWORD = '49d73ddb4974cc8ee23c0da2e253cf2a'
const LEGENDARY_GREATSWORD = 'd978ce202804d10c1970bab4b46accd8'
const PURIFICATION_EPIC_JACKET = 'd51d0071c181d4fe99b04e19f2fd6a82'
const PURIFICATION_LEGENDARY_RING = '3c98b0a19cfc20b86099795425547710'
const PURIFICATION_LEGENDARY_MAGIC_STONE = '132a45d427142eb39845eb85272e062d'

function variantItemOf(itemId: string): Item {
  const equipment = findEquipmentVariant(itemId)

  if (equipment !== null) {
    return { ...equipment.variant.item }
  }

  const weapon = findWeaponVariant(itemId)
  assert.notEqual(weapon, null, itemId)

  return { ...weapon!.variant.item }
}

/** 착용 아이템을 선택지 목록의 아이템과 조율 단계로 바꾼다. */
function wear(items: Item[], slotId: string, itemId: string, tune: number): Item[] {
  return items.map((item) => {
    if (item.slotId !== slotId) {
      return item
    }

    const [first] = item.tune as Item[]

    return { ...item, ...variantItemOf(itemId), tune: [{ ...first, level: tune }] }
  })
}

/** 3조율 에픽 무기와 2조율 에픽 상의만 에픽이다. */
function epicWeaponAndJacket(items: Item[]): Item[] {
  let worn = wear(items, 'WEAPON', EPIC_GREATSWORD, 3)
  worn = wear(worn, 'JACKET', PURIFICATION_EPIC_JACKET, 2)
  worn = wear(worn, 'RING', PURIFICATION_LEGENDARY_RING, 0)

  return wear(worn, 'MAGIC_STON', PURIFICATION_LEGENDARY_MAGIC_STONE, 0)
}

function noEpic(items: Item[]): Item[] {
  let worn = wear(items, 'WEAPON', LEGENDARY_GREATSWORD, 0)
  worn = wear(worn, 'RING', PURIFICATION_LEGENDARY_RING, 0)

  return wear(worn, 'MAGIC_STON', PURIFICATION_LEGENDARY_MAGIC_STONE, 0)
}

function fixture(edit: (items: Item[]) => Item[]) {
  const payloads: CharacterPayloads = payloadsFromEngineInput(readEngineInput('dealer-blade'))
  const equipment = payloads.equipment.equipment as Item[]
  payloads.equipment = { ...payloads.equipment, equipment: edit(structuredClone(equipment)) }
  const { characterId } = payloads.basic as Record<string, string>
  let fetches = 0
  const details: ApiHttpAppOptions['details'] = {
    fetchDetails: async () => {
      fetches++

      return payloads
    },
    catalog: new CatalogService(async () => new Map())
  }

  return {
    payloads,
    details,
    path: `/characters/siroco/${characterId}/epic-soul-recovery`,
    fetches: () => fetches
  }
}

function storedEquipment(payloads: CharacterPayloads): CharacterHistoryRepository {
  const { equipment } = toSectionBodies(payloads)

  return {
    readHistory: async () => assert.fail('이력을 부르면 안 된다'),
    readSnapshot: async () => assert.fail('스냅샷을 부르면 안 된다'),
    readNameChangeEvents: async () => assert.fail('이름 변경을 부르면 안 된다'),
    readSections: async (_character, sections) => {
      assert.deepEqual(sections, ['equipment'])

      return [
        { section: 'equipment', observedAt: new Date('2026-11-27T00:00:00Z'), data: equipment }
      ]
    }
  }
}

async function listen(t: TestContext, options: Partial<ApiHttpAppOptions>) {
  const { app } = await createApiHttpApp({
    search: { searchCharacters: async () => assert.fail('검색을 부르면 안 된다') },
    details: {
      fetchDetails: async () => assert.fail('상세 조회를 부르면 안 된다'),
      catalog: new CatalogService(async () => new Map())
    },
    todayGrade: { fetchShopGrade: async () => assert.fail('오늘의 등급을 부르면 안 된다') },
    writeAccessLog: () => undefined,
    ...options
  })
  t.after(() => app.close())
  await app.listen(0, '127.0.0.1')

  return await app.getUrl()
}

async function get(origin: string, path: string) {
  const response = await fetch(new URL(path, origin))

  return { status: response.status, body: await response.json() }
}

const epicWeaponAndJacketSouls = {
  total: 67,
  slots: [
    {
      slotId: 'WEAPON',
      itemId: EPIC_GREATSWORD,
      itemName: '제2형 - 수식, 방어의 운검',
      itemRarity: '에픽',
      tune: 3,
      souls: 46
    },
    {
      slotId: 'JACKET',
      itemId: PURIFICATION_EPIC_JACKET,
      itemName: '칠흑의 정화 상의',
      itemRarity: '에픽',
      tune: 2,
      souls: 21
    }
  ]
}

test('저장한 장비 원문이 없으면 상세를 받아 3조율 에픽 무기와 2조율 에픽 상의의 67개를 부위별로 준다', async (t) => {
  const { details, path, fetches } = fixture(epicWeaponAndJacket)
  const origin = await listen(t, { details })

  const response = await get(origin, path)

  assert.deepEqual(response, { status: 200, body: epicWeaponAndJacketSouls })
  assert.equal(fetches(), 1)
})

test('저장한 장비 원문이 있으면 Neople 상세를 받지 않고 그 원문으로 센다', async (t) => {
  const { payloads, details, path, fetches } = fixture(epicWeaponAndJacket)
  const origin = await listen(t, { details, characterHistory: storedEquipment(payloads) })

  const response = await get(origin, path)

  assert.deepEqual(response, { status: 200, body: epicWeaponAndJacketSouls })
  assert.equal(fetches(), 0)
})

test('에픽 부위가 없으면 회수량 0과 빈 부위 목록을 준다', async (t) => {
  const { details, path } = fixture(noEpic)
  const origin = await listen(t, { details })

  const response = await get(origin, path)

  assert.deepEqual(response, { status: 200, body: { total: 0, slots: [] } })
})
