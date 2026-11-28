import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test, { type TestContext } from 'node:test'
import {
  equipmentSets,
  equipmentVariantsOf,
  EQUIPMENT_VARIANT_SLOTS,
  findEquipmentVariant,
  findWeaponVariant,
  weaponVariantsOf
} from '@dfragon/lib/equipment-variants'
import { CatalogService } from '@dfragon/server-core/application/character-catalog/index.js'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import type {
  ScoreCalculator,
  ScoreEngineInput,
  ScoreEngineResult
} from '@dfragon/server-core/domain/score/index.js'
import {
  type ScoreWorker,
  type ScoreWorkerMessage,
  type ScoreWorkerRequest,
  openNativeScore
} from '@dfragon/server-core/infrastructure/score/index.js'
import {
  REAL_SCORE_LIBRARY_PATH,
  payloadsFromEngineInput,
  readEngineInput
} from '@dfragon/server-core/test/score-fixtures.js'
import { supportsSimulation } from '../src/domain/equipment-simulation/index.js'
import { type ApiHttpAppOptions, createApiHttpApp } from '../src/runtime/api-app.js'

type Item = Record<string, unknown>

const SYNTHETIC_LIBRARY_PATH = '/synthetic/libdnfscore.so'
const ENGINE = 'dnfscore-native 0.17.2'
const GOLDEN_SET = '7f788a703a87d783079b41d0fe6448c9'
const EPIC_GREATSWORD = '49d73ddb4974cc8ee23c0da2e253cf2a'
const LEGENDARY_GREATSWORD = 'd978ce202804d10c1970bab4b46accd8'
const STAR_LEGENDARY_GREATSWORD = '8215605516a956285743aff73aeb28ca'
const PURIFICATION_EPIC_JACKET = 'd51d0071c181d4fe99b04e19f2fd6a82'
const PURIFICATION_EPIC_AMULET = '0eb5d7cad40b1aeaad80c8997cc7fc99'
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

// 실제 상세 대신 선택지 목록의 이름, 등급, 세트로 만든 합성 아이템 상세다.
// 엔진은 itemStatus가 빈 상세를 상세가 없다고 보고 교체를 거절하므로 스탯 변화가 없는 줄 하나를 둔다.
const SYNTHETIC_ITEM_STATUS = [{ name: '모험가 명성', value: 0 }]

function syntheticDetails(): Map<string, Item> {
  const details = new Map<string, Item>()

  for (const { setItemId, setItemName } of equipmentSets()) {
    for (const slotId of EQUIPMENT_VARIANT_SLOTS) {
      for (const { item } of equipmentVariantsOf(setItemId, slotId)) {
        details.set(item.itemId, {
          ...item,
          setItemId,
          setItemName,
          itemAvailableLevel: 115,
          itemStatus: SYNTHETIC_ITEM_STATUS
        })
      }
    }
  }

  for (const { item } of weaponVariantsOf('대검')) {
    details.set(item.itemId, {
      ...item,
      itemType: '무기',
      itemTypeDetail: '대검',
      itemAvailableLevel: 115,
      itemStatus: SYNTHETIC_ITEM_STATUS
    })
  }

  return details
}

function fixture(edit: (items: Item[]) => Item[]) {
  const original = readEngineInput('dealer-blade')
  const payloads: CharacterPayloads = payloadsFromEngineInput(original)
  const equipment = payloads.equipment.equipment as Item[]
  payloads.equipment = { ...payloads.equipment, equipment: edit(structuredClone(equipment)) }
  const { characterId } = payloads.basic as Record<string, string>
  const synthetic = syntheticDetails()
  const catalogRequests: string[] = []
  let fetches = 0
  const details: ApiHttpAppOptions['details'] = {
    fetchDetails: async () => {
      fetches++

      return payloads
    },
    catalog: new CatalogService(async (itemIds) => {
      catalogRequests.push(...itemIds)
      const found = itemIds.flatMap((itemId) => {
        const data = original.items[itemId] ?? synthetic.get(itemId)

        if (data === undefined) {
          return []
        }

        return [[itemId, data] as const]
      })

      return new Map(found)
    })
  }

  return {
    payloads,
    details,
    catalogRequests,
    path: `/characters/siroco/${characterId}`,
    fetches: () => fetches
  }
}

function setOf(input: ScoreEngineInput): string {
  const entries = (input.simulation?.equipment ?? []) as Item[]

  for (const { itemId } of entries) {
    const setItemId = findEquipmentVariant(itemId as string)?.setItemId

    if (setItemId != null) {
      return setItemId
    }
  }

  return assert.fail('세트를 옮긴 장비가 요청에 없다')
}

function weaponLineOf(input: ScoreEngineInput): string | null {
  const entries = (input.simulation?.equipment ?? []) as Item[]
  const weapon = entries.find(({ slotId }) => slotId === 'WEAPON')

  if (weapon === undefined) {
    return null
  }

  const match = findWeaponVariant(weapon.itemId as string)
  assert.notEqual(match, null)

  return match!.variant.line
}

/** 황금향 세트가 가장 높고, 같은 세트면 태초의 별이 레거시보다 높은 합성 점수다. */
function fakeScore(input: ScoreEngineInput): number {
  const setIndex = equipmentSets().findIndex(({ setItemId }) => setItemId === setOf(input))
  const setBonus = setOf(input) === GOLDEN_SET ? 300 : setIndex
  const lineBonus = weaponLineOf(input) === '태초의 별' ? 20 : 0

  return 2000 + setBonus + lineBonus
}

function engineResult(calculator: ScoreCalculator, input: ScoreEngineInput): ScoreEngineResult {
  const result: ScoreEngineResult = {
    calculator,
    score: 1741,
    skipped: null,
    approximate_score: null,
    approximate_source: null,
    warning: null,
    versions: { package: ENGINE, rules_rev: 'rev16', bundle_id: 'phase32-rev16c' },
    display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null, mainStat: '힘' }
  }

  if (input.simulation === undefined) {
    return result
  }

  return {
    ...result,
    simulation: {
      score: fakeScore(input),
      skipped: null,
      approximate_score: null,
      approximate_source: null,
      warning: null,
      display: { buff30: null, buff50: null }
    }
  }
}

function cardScore(value: number) {
  const versions = { package: ENGINE, rulesRev: 'rev16', bundleId: 'phase32-rev16c' }

  return { calculator: 'equipment', value, skipped: null, approximate: null, versions }
}

// 엔진 worker의 메시지만 흉내 내고 받은 요청을 남긴다.
function scoring() {
  const requests: ScoreWorkerRequest[] = []
  const spawnScoreWorker = (): ScoreWorker => {
    const events = new EventEmitter()
    const answer = ({ id, calculator, input }: ScoreWorkerRequest): ScoreWorkerMessage => {
      const text = JSON.stringify(engineResult(calculator, input))

      return { kind: 'result', id, text }
    }

    return {
      postMessage: (request) => {
        requests.push(request)
        queueMicrotask(() => events.emit('message', answer(request)))
      },
      on: events.on.bind(events),
      terminate: async () => undefined
    }
  }

  return { requests, options: { scoreLibraryPath: SYNTHETIC_LIBRARY_PATH, spawnScoreWorker } }
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

async function post(origin: string, path: string, body: unknown) {
  const response = await fetch(new URL(path, origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  return { status: response.status, body: await response.json() }
}

function recover(origin: string, path: string, includePrimordial: boolean) {
  return post(origin, `${path}/epic-soul-recovery`, { includePrimordial })
}

function equipmentEntries(request: ScoreWorkerRequest): Item[] {
  return (request.input.simulation?.equipment ?? []) as Item[]
}

test('3조율 에픽 무기와 2조율 에픽 상의는 67개를 돌려받고, 가장 높은 세트와 무기 계열의 장비를 변경 후로 보인다', async (t) => {
  const { payloads, details, path, fetches, catalogRequests } = fixture(epicWeaponAndJacket)
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })
  const worn = payloads.equipment.equipment as Item[]
  const wornWeapon = worn.find(({ slotId }) => slotId === 'WEAPON')!
  const wornJacket = worn.find(({ slotId }) => slotId === 'JACKET')!

  const response = await recover(origin, path, false)

  assert.equal(response.status, 200)
  const goldenJacket = equipmentVariantsOf(GOLDEN_SET, 'JACKET').find(
    ({ rarity, kind }) => rarity === '레전더리' && kind === '일반'
  )!
  assert.deepEqual(response.body.souls, {
    total: 67,
    slots: [
      {
        slotId: 'WEAPON',
        before: {
          itemId: EPIC_GREATSWORD,
          itemName: '제2형 - 수식, 방어의 운검',
          itemRarity: '에픽',
          tune: 3,
          reinforce: wornWeapon.reinforce,
          amplified: wornWeapon.amplificationName !== null
        },
        after: {
          itemId: STAR_LEGENDARY_GREATSWORD,
          itemName: '전설 속의 전승 - 대검',
          itemRarity: '레전더리',
          line: '태초의 별'
        },
        souls: 46
      },
      {
        slotId: 'JACKET',
        before: {
          itemId: PURIFICATION_EPIC_JACKET,
          itemName: '칠흑의 정화 상의',
          itemRarity: '에픽',
          tune: 2,
          reinforce: wornJacket.reinforce,
          amplified: wornJacket.amplificationName !== null
        },
        after: goldenJacket.item,
        souls: 21
      }
    ]
  })
  assert.deepEqual(response.body.best, {
    score: cardScore(2320),
    setItemId: GOLDEN_SET,
    weaponVariantId: STAR_LEGENDARY_GREATSWORD
  })
  assert.deepEqual(response.body.baseline, cardScore(1741))
  assert.equal(engine.requests.length, equipmentSets().length * 2)
  assert.equal(fetches(), 1)
  assert.equal(new Set(catalogRequests).size, catalogRequests.length)
})

test('에픽 무기와 상의는 조율 0의 레전더리로 바꾸고 강화, 증폭은 착용 그대로 둔다', async (t) => {
  const { payloads, details, path } = fixture(epicWeaponAndJacket)
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })

  await recover(origin, path, false)

  const worn = payloads.equipment.equipment as Item[]
  const wornJacket = worn.find(({ slotId }) => slotId === 'JACKET')!
  const wornWeapon = worn.find(({ slotId }) => slotId === 'WEAPON')!

  for (const request of engine.requests) {
    const entries = equipmentEntries(request)
    const jacket = entries.find(({ slotId }) => slotId === 'JACKET')!
    const weapon = entries.find(({ slotId }) => slotId === 'WEAPON')!

    assert.equal(jacket.itemRarity, '레전더리')
    assert.deepEqual(
      (jacket.tune as Item[]).map(({ level }) => level),
      [0]
    )
    assert.equal(jacket.reinforce, wornJacket.reinforce)
    assert.equal(jacket.amplificationName, wornJacket.amplificationName)
    assert.equal(weapon.itemRarity, '레전더리')
    assert.equal(weapon.reinforce, wornWeapon.reinforce)
    assert.equal(weapon.amplificationName, wornWeapon.amplificationName)
    assert.deepEqual(
      (weapon.tune as Item[]).map(({ level }) => level),
      [0]
    )
  }
})

test('에픽 목걸이와 반지는 태초를 고르면 태초로, 고르지 않으면 레전더리로 요청하고 마법석은 레전더리로 요청한다', async (t) => {
  const withEpicAmulet = (items: Item[]) => wear(items, 'AMULET', PURIFICATION_EPIC_AMULET, 0)
  const raritiesOf = async (includePrimordial: boolean) => {
    const { details, path } = fixture(withEpicAmulet)
    const engine = scoring()
    const origin = await listen(t, { details, ...engine.options })

    await recover(origin, path, includePrimordial)

    const rarities = new Set(
      engine.requests.flatMap((request) =>
        equipmentEntries(request)
          .filter(({ slotId }) => ['AMULET', 'RING', 'MAGIC_STON'].includes(slotId as string))
          .map(({ slotId, itemRarity }) => `${slotId} ${itemRarity}`)
      )
    )

    return [...rarities].sort()
  }

  assert.deepEqual(await raritiesOf(true), ['AMULET 태초', 'MAGIC_STON 레전더리', 'RING 태초'])
  assert.deepEqual(await raritiesOf(false), [
    'AMULET 레전더리',
    'MAGIC_STON 레전더리',
    'RING 레전더리'
  ])
})

test('무기가 에픽이 아니면 무기를 바꾸지 않고 세트마다 한 번씩만 계산한다', async (t) => {
  const { details, path } = fixture((items) => wear(items, 'WEAPON', LEGENDARY_GREATSWORD, 0))
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })

  const response = await recover(origin, path, false)

  assert.equal(response.status, 200)
  assert.equal(engine.requests.length, equipmentSets().length)
  assert.ok(engine.requests.every((request) => weaponLineOf(request.input) === null))
  assert.equal(response.body.best.weaponVariantId, null)
  assert.deepEqual(
    response.body.souls.slots.map(({ slotId }: Item) => slotId),
    ['RING', 'MAGIC_STON']
  )
})

test('에픽 부위가 없으면 엔진을 돌리지 않고 회수량 0과 빈 최고 세팅을 준다', async (t) => {
  const { details, path } = fixture(noEpic)
  const engine = scoring()
  const origin = await listen(t, { details, ...engine.options })

  const response = await recover(origin, path, true)

  assert.deepEqual(response, {
    status: 200,
    body: { souls: { total: 0, slots: [] }, baseline: null, best: null }
  })
  assert.equal(engine.requests.length, 0)
})

for (const body of [{}, { includePrimordial: 'yes' }, { includePrimordial: true, extra: 1 }]) {
  test(`요청 body ${JSON.stringify(body)}는 계산하지 않고 400으로 거절한다`, async (t) => {
    const { details, path, fetches } = fixture(epicWeaponAndJacket)
    const engine = scoring()
    const origin = await listen(t, { details, ...engine.options })

    const response = await post(origin, `${path}/epic-soul-recovery`, body)

    assert.deepEqual(response, {
      status: 400,
      body: { error: { code: 'INVALID_SIMULATION_REQUEST' } }
    })
    assert.equal(fetches(), 0)
    assert.equal(engine.requests.length, 0)
  })
}

function realEngineSupportsRecovery(): boolean {
  if (REAL_SCORE_LIBRARY_PATH === null) {
    return false
  }

  const score = openNativeScore({ path: REAL_SCORE_LIBRARY_PATH })
  const text = score?.(readEngineInput('dealer-blade'), 'equipment') ?? null

  if (text === null) {
    return false
  }

  const { versions } = JSON.parse(text) as ScoreEngineResult

  return supportsSimulation(versions.package, {
    slotItems: false,
    equipmentItems: true,
    oathTunes: false,
    equipmentSet: true,
    weaponTune: true,
    weaponItem: true,
    addedSlots: false,
    addedOath: false,
    oathItems: false,
    oathUpgrade: false,
    buffLevel: false,
    switchingEquipment: false,
    avatar: false,
    oathWithoutSetInfo: false
  })
}

// 엔진 버전이 오르면 점수가 바뀌므로 값은 고정하지 않고 시뮬레이션 API와 같은지만 확인한다.
test('실제 엔진의 최고 세팅 점수는 같은 세트, 등급, 무기를 보낸 시뮬레이션 점수와 같다', {
  skip:
    !realEngineSupportsRecovery() &&
    '세트 전환과 무기 아이템 교체를 반영하는 0.13.0 이상 엔진이 없음',
  timeout: 120_000
}, async (t) => {
  // 착용 장비를 바꾸면 Neople 세트 영역의 포인트와 어긋나 엔진이 거절하므로 에픽 무기, 반지, 마법석을 낀 원본을 그대로 쓴다.
  const { details, path } = fixture((items) => items)
  const origin = await listen(t, { details, scoreLibraryPath: REAL_SCORE_LIBRARY_PATH })

  const recovery = await recover(origin, path, false)

  assert.equal(recovery.status, 200)
  assert.notEqual(recovery.body.best, null)
  const equipment = recovery.body.souls.slots.map(({ slotId, before, after }: Item) => {
    const variantId =
      slotId === 'WEAPON' ? recovery.body.best.weaponVariantId : (after as Item).itemId

    return {
      slotId,
      reinforce: (before as Item).reinforce,
      amplified: (before as Item).amplified,
      enchantId: null,
      variantId,
      tune: 0
    }
  })
  const simulation = await post(origin, `${path}/simulation`, {
    equipmentSet: recovery.body.best.setItemId,
    equipment
  })

  assert.equal(simulation.status, 200)
  assert.deepEqual(simulation.body.simulated, recovery.body.best.score)
})
