import assert from 'node:assert/strict'
import test from 'node:test'
import type { ItemDictionaryEntry, StoredCharacter, StoredSeason } from '@dfragon/database'
import {
  type HoldingRecord,
  selectAdventureEquipment,
  toAdventureEquipment,
  toEquipmentWindow
} from '../src/domain/adventure-guild/equipment.js'

const CANCELS_OUT = '획득 한 번과 같은 칸의 초월 out 한 번이 있으면 그 칸이 없다'
const CANCELS_FUSED_OUT =
  '원래 itemId로 얻고 융합으로 바뀐 itemId로 out이 찍혀도 같은 칸에서 상쇄된다'
const ADDS_IN = '초월 in은 받은 캐릭터의 칸에 1을 더한다'
const KEEPS_UPGRADE = '같은 칸에 획득 뒤 511 기록이 와도 개수는 1이다'
const FILLS_UPGRADE = '가진 것이 없던 칸에 511 기록이 오면 개수는 1이다'
const SKIPS_NON_SET = '사전에 없는 itemId, 칭호, 융합석, 무기, 105레벨 장비의 기록은 없다'
const USES_DICTIONARY_RARITY =
  '554 기록으로 얻은 서약은 사전의 등급으로 나오고, 본체와 결정이 kind로 갈린다'
const SPLITS_SERVERS =
  '서버가 둘인 모험단은 servers가 둘이고 캐릭터가 자기 서버에만 있으며, 가진 것이 없는 캐릭터도 남는다'
const OATH_CODES =
  '서약도 556 out은 1을 빼고 553 기록은 이미 있는 칸을 늘리지 않으며, 초월이 아닌 기록의 out 값은 빼지 않는다'
const LATEST_ITEM =
  '칸의 아이템 id와 이름은 out이 아닌 가장 최근 기록의 값이고, sets는 응답에 나온 세트만 담는다'
const GROUPS_UNIQUE =
  '세트가 없고 이름이 "고유 - "로 시작하는 장비는 고유 세트 하나로 묶고, 이름에 고유가 없는 세트 없는 장비는 없다'
const SORTS_SETS =
  'sets는 세트 순서 표의 세트가 먼저 표 순서로 오고, 표에 없는 세트는 그 뒤에 이름순으로 온다'
const SELECTS_QUERY =
  '고른 서버, 세트를 주면 그 서버의 캐릭터만 그 세트의 보유로 남고, 칩 목록은 모험단 전체 기준이다'
const DEFAULT_SELECTION =
  '서버, 세트가 없거나 모험단에 없는 값이면 첫 서버와 sets의 첫 세트를 고른다'
const NO_CHARACTER = '캐릭터가 없는 모험단은 고른 값이 null이다'
const WINDOW_START =
  '기록은 지금 시즌과 장비 레벨이 같은 시즌 가운데 가장 이른 시즌의 시작부터 읽는다'

// 합성 캐릭터, itemId, 세트다. 사전 값의 itemType, itemTypeDetail은 실제 Neople 응답의 모양을 흉내 냈다.
const valkyrie = 'v'.repeat(32)
const purify = 'p'.repeat(32)
// 세트 순서 표의 첫 세트(황금향)인 실제 Neople setItemId다.
const golden = '7f788a703a87d783079b41d0fe6448c9'
const ids = {
  top: 'a'.repeat(32),
  fusedTop: 'b'.repeat(32),
  topPrimeval: 'c'.repeat(32),
  ring: 'd'.repeat(32),
  purifyTop: 'e'.repeat(32),
  oath: 'f'.repeat(32),
  crystal: '1'.repeat(32),
  title: '2'.repeat(32),
  fusionStone: '3'.repeat(32),
  weapon: '4'.repeat(32),
  oldTop: '5'.repeat(32),
  unknown: '6'.repeat(32),
  uniqueRing: '7'.repeat(32),
  noSetEarring: '8'.repeat(32),
  uniqueTop: '9'.repeat(32),
  goldenTop: '0'.repeat(32)
}

function entry(
  itemId: string,
  fields: Partial<Omit<ItemDictionaryEntry, 'itemId'>>
): ItemDictionaryEntry {
  return {
    itemId,
    availableLevel: 115,
    itemType: '방어구',
    itemTypeDetail: '상의',
    itemRarity: '에픽',
    setItemId: valkyrie,
    setItemName: '발키리 세트',
    ...fields
  }
}

const dictionary = new Map(
  [
    entry(ids.top, {}),
    entry(ids.fusedTop, {}),
    entry(ids.topPrimeval, { itemRarity: '태초' }),
    entry(ids.ring, { itemType: '액세서리', itemTypeDetail: '반지' }),
    entry(ids.purifyTop, { setItemId: purify, setItemName: '정화 세트' }),
    entry(ids.goldenTop, { setItemId: golden, setItemName: '황금향 세트' }),
    entry(ids.oath, { itemType: '서약', itemTypeDetail: '서약', itemRarity: '태초' }),
    entry(ids.crystal, { itemType: '서약결정', itemTypeDetail: '서약결정', itemRarity: '에픽' }),
    entry(ids.title, {
      availableLevel: 1,
      itemType: '액세서리',
      itemTypeDetail: '칭호',
      setItemId: null,
      setItemName: null
    }),
    entry(ids.fusionStone, { itemType: '융합석', itemTypeDetail: '융합석' }),
    entry(ids.weapon, { itemType: '무기', itemTypeDetail: '대검' }),
    entry(ids.oldTop, { availableLevel: 105 }),
    entry(ids.uniqueRing, {
      itemType: '액세서리',
      itemTypeDetail: '반지',
      setItemId: null,
      setItemName: null
    }),
    entry(ids.uniqueTop, { setItemId: null, setItemName: null }),
    entry(ids.noSetEarring, {
      itemType: '추가장비',
      itemTypeDetail: '귀걸이',
      itemRarity: '태초',
      setItemId: null,
      setItemName: null
    })
  ].map((dictionaryEntry) => [dictionaryEntry.itemId, dictionaryEntry])
)

function character(serverId: string, characterId: string): StoredCharacter {
  return {
    serverId,
    characterId,
    characterName: `합성${characterId}`,
    adventureName: '합성모험단',
    level: 115,
    jobId: 'synthetic-job',
    jobGrowId: 'synthetic-grow',
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    fame: 70000,
    guildId: null,
    guildName: null,
    fetchedAt: null,
    dealerSkillLearned: null,
    score: null
  }
}

const cain = character('cain', 'a')

function record(
  code: number,
  itemId: string,
  { itemName = `합성 ${itemId.slice(0, 4)}`, data = {}, owner = cain } = {}
): HoldingRecord {
  return { serverId: owner.serverId, characterId: owner.characterId, code, itemId, itemName, data }
}

const out = { data: { adventureSafeMoveType: 'out' } }
const moveIn = { data: { adventureSafeMoveType: 'in' } }

function holdingsOf(records: HoldingRecord[], characters = [cain]) {
  return toAdventureEquipment(characters, records, dictionary, 115)
}

function firstCharacter(records: HoldingRecord[]) {
  const character = holdingsOf(records).servers[0]?.characters[0]
  assert.ok(character)

  return character
}

const countsOf = (records: HoldingRecord[]) =>
  firstCharacter(records).equipment.map(({ slot, rarity, count }) => [slot, rarity, count])

test(CANCELS_OUT, () => {
  assert.deepEqual(countsOf([record(505, ids.top), record(516, ids.top, out)]), [])
})

test(CANCELS_FUSED_OUT, () => {
  assert.deepEqual(countsOf([record(505, ids.top), record(516, ids.fusedTop, out)]), [])
})

test(ADDS_IN, () => {
  assert.deepEqual(countsOf([record(505, ids.top), record(516, ids.fusedTop, moveIn)]), [
    ['상의', '에픽', 2]
  ])
})

test(KEEPS_UPGRADE, () => {
  assert.deepEqual(countsOf([record(505, ids.top), record(511, ids.top)]), [['상의', '에픽', 1]])
})

test(FILLS_UPGRADE, () => {
  assert.deepEqual(countsOf([record(511, ids.topPrimeval)]), [['상의', '태초', 1]])
})

test(SKIPS_NON_SET, () => {
  const holdings = firstCharacter([
    record(505, ids.unknown),
    record(505, ids.title),
    record(505, ids.fusionStone),
    record(505, ids.weapon),
    record(505, ids.oldTop),
    record(550, ids.top)
  ])

  assert.deepEqual(holdings.equipment, [])
  assert.deepEqual(holdings.oaths, [])
})

test(USES_DICTIONARY_RARITY, () => {
  const { oaths } = firstCharacter([record(554, ids.oath), record(552, ids.crystal)])

  assert.deepEqual(
    oaths.map(({ kind, rarity, count }) => [kind, rarity, count]),
    [
      ['crystal', '에픽', 1],
      ['oath', '태초', 1]
    ]
  )
})

test(OATH_CODES, () => {
  const { oaths } = firstCharacter([
    record(550, ids.oath),
    record(553, ids.oath),
    record(552, ids.crystal),
    record(556, ids.crystal, out),
    record(551, ids.crystal, out)
  ])

  assert.deepEqual(
    oaths.map(({ kind, count }) => [kind, count]),
    [
      ['crystal', 1],
      ['oath', 1]
    ]
  )
})

test(SPLITS_SERVERS, () => {
  const siroco = character('siroco', 'b')
  const empty = character('cain', 'c')
  const equipment = holdingsOf(
    [record(505, ids.top), record(505, ids.ring, { owner: siroco })],
    [cain, siroco, empty]
  )

  assert.deepEqual(
    equipment.servers.map(({ serverId, characters }) => [
      serverId,
      characters.map(({ characterId, equipment: held }) => [
        characterId,
        held.map(({ slot }) => slot)
      ])
    ]),
    [
      [
        'cain',
        [
          ['a', ['상의']],
          ['c', []]
        ]
      ],
      ['siroco', [['b', ['반지']]]]
    ]
  )
})

test(LATEST_ITEM, () => {
  const equipment = holdingsOf([
    record(505, ids.top, { itemName: '원래 상의' }),
    record(512, ids.fusedTop, { itemName: '융합된 상의' }),
    record(516, ids.top, { itemName: '보낸 상의', ...out })
  ])

  assert.deepEqual(equipment.servers[0]?.characters[0]?.equipment, [
    {
      setItemId: valkyrie,
      slot: '상의',
      rarity: '에픽',
      itemId: ids.fusedTop,
      itemName: '융합된 상의',
      count: 1
    }
  ])
  assert.deepEqual(equipment.sets, [{ setItemId: valkyrie, setItemName: '발키리 세트' }])
})

test(GROUPS_UNIQUE, () => {
  const equipment = holdingsOf([
    record(505, ids.uniqueRing, { itemName: '고유 - 합성 반지' }),
    record(505, ids.uniqueTop, { itemName: '고유 - 합성 상의' }),
    record(505, ids.noSetEarring, { itemName: '합성 귀걸이' })
  ])

  assert.deepEqual(
    equipment.servers[0]?.characters[0]?.equipment.map(({ setItemId, slot, count }) => [
      setItemId,
      slot,
      count
    ]),
    [
      ['unique', '반지', 1],
      ['unique', '상의', 1]
    ]
  )
  assert.deepEqual(equipment.sets, [{ setItemId: 'unique', setItemName: '고유' }])
})

test(SORTS_SETS, () => {
  const equipment = holdingsOf([
    record(505, ids.purifyTop),
    record(505, ids.uniqueTop, { itemName: '고유 - 합성 상의' }),
    record(505, ids.ring),
    record(505, ids.goldenTop)
  ])

  assert.deepEqual(
    equipment.sets.map(({ setItemName }) => setItemName),
    ['황금향 세트', '고유', '발키리 세트', '정화 세트']
  )
})

const siroco = character('siroco', 'b')

function twoServerEquipment() {
  return holdingsOf(
    [
      record(505, ids.top),
      record(505, ids.purifyTop),
      record(505, ids.ring, { owner: siroco }),
      record(505, ids.purifyTop, { owner: siroco })
    ],
    [cain, siroco]
  )
}

function shownHoldings(equipment: ReturnType<typeof selectAdventureEquipment>) {
  return equipment.servers.map(({ serverId, characters }) => [
    serverId,
    characters.map(({ characterId, equipment: holdings }) => [
      characterId,
      holdings.map(({ setItemId, slot }) => `${setItemId.slice(0, 1)}/${slot}`)
    ])
  ])
}

test(SELECTS_QUERY, () => {
  const all = twoServerEquipment()
  const selected = selectAdventureEquipment(all, { serverId: 'siroco', setItemId: valkyrie })

  assert.deepEqual(selected.selected, { serverId: 'siroco', setItemId: valkyrie })
  assert.deepEqual(selected.sets, all.sets)
  assert.deepEqual(shownHoldings(selected), [
    ['cain', []],
    ['siroco', [['b', ['v/반지']]]]
  ])
})

test(DEFAULT_SELECTION, () => {
  const all = twoServerEquipment()
  const expected = [
    ['cain', [['a', ['v/상의']]]],
    ['siroco', []]
  ]

  for (const query of [
    { serverId: undefined, setItemId: undefined },
    { serverId: 'unknown', setItemId: 'unknown' }
  ]) {
    const selected = selectAdventureEquipment(all, query)

    assert.deepEqual(selected.selected, { serverId: 'cain', setItemId: valkyrie })
    assert.deepEqual(shownHoldings(selected), expected)
  }
})

test(NO_CHARACTER, () => {
  const selected = selectAdventureEquipment(holdingsOf([], []), {
    serverId: 'cain',
    setItemId: valkyrie
  })

  assert.deepEqual(selected, { sets: [], servers: [], selected: null })
})

test(WINDOW_START, () => {
  const season = (id: number, startsAt: string): StoredSeason => ({
    id,
    name: `시즌 ${id}`,
    startsAt: new Date(`${startsAt}T06:00:00+09:00`)
  })
  const seasons = [season(9, '2024-01-18'), season(10, '2025-01-09'), season(11, '2026-03-19')]

  assert.deepEqual(toEquipmentWindow(seasons, new Date('2026-11-19T00:00:00+09:00')), {
    since: new Date('2025-01-09T06:00:00+09:00'),
    equipmentLevel: 115
  })
  assert.deepEqual(toEquipmentWindow(seasons, new Date('2024-06-01T00:00:00+09:00')), {
    since: new Date('2024-01-18T06:00:00+09:00'),
    equipmentLevel: undefined
  })
  assert.equal(toEquipmentWindow([], new Date('2026-11-19T00:00:00+09:00')), undefined)
})
