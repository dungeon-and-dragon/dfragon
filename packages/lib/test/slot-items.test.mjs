import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  SLOT_ITEM_CATEGORIES,
  findSlotItem,
  findWornSlotItem,
  slotItemsOf
} from '@dfragon/lib/slot-items'

// build가 선택 목록을 dist에 함께 실어야 package export로 읽힌다.
const table = JSON.parse(readFileSync(new URL('../dist/slot-items.json', import.meta.url), 'utf8'))
const observed = JSON.parse(
  readFileSync(new URL('../dist/slot-item-ids.json', import.meta.url), 'utf8')
)
const engineIds = Object.values(table.categories).flatMap((items) => items.map(({ id }) => id))

test('선택 목록은 version 1이고 칭호, 크리쳐, 오라 목록만 둔다', () => {
  assert.equal(table.version, 1)
  assert.deepEqual(Object.keys(table.categories).sort(), [...SLOT_ITEM_CATEGORIES].sort())
})

test('선택 항목은 카테고리 안에서 겹치지 않는 id, 하한 이상의 명성, 엔진에 넘길 대표 아이템을 가진다', () => {
  for (const category of SLOT_ITEM_CATEGORIES) {
    const items = slotItemsOf(category)
    const ids = items.map(({ id }) => id)

    assert.equal(new Set(ids).size, ids.length, category)
    for (const slotItem of items) {
      const name = `${category} ${slotItem.id}`
      assert.ok(slotItem.id.startsWith(`${category}:`), name)
      assert.ok(slotItem.fame >= table.floors[category].fame, name)
      assert.match(slotItem.item.itemId, /^[0-9a-f]{32}$/, name)
      assert.equal(typeof slotItem.item.itemName, 'string', name)
      assert.equal(typeof slotItem.item.itemRarity, 'string', name)
      assert.ok(Array.isArray(slotItem.status), name)
    }
  }
})

// 표를 다시 생성해 값이 바뀌면 이 기대값도 함께 고친다.
for (const [category, expected] of [
  [
    'title',
    [
      '프로스트의 전설 플래티넘',
      '프로스트의 전설',
      '진정한 각성을 이룬 자',
      '세리아의 풍성한 선물 Ver.2'
    ]
  ],
  [
    'creature',
    [
      '운명을 담는 재단사 플래티넘',
      '운명을 담는 재단사',
      'SD 흰 구름 전령 에를리히',
      '순백의 나비 공주',
      '다정한 SD 세리아 Ver.2'
    ]
  ],
  [
    'aura',
    [
      '열대야의 추억',
      '스노우메이지 캐슬',
      '어워즈 패셔니스타',
      '로얄 패스 오라',
      '세리아의 파스텔 버블 Ver.2'
    ]
  ]
]) {
  test(`slotItemsOf는 ${category} 묶음을 명성 높은 순으로 돌려준다`, () => {
    assert.deepEqual(
      slotItemsOf(category).map(({ name }) => name),
      expected
    )
  })
}

test('findSlotItem은 그 카테고리의 id만 찾고 다른 카테고리나 없는 id는 null이다', () => {
  const aura = findSlotItem('aura', 'aura:845:character/swordman/avatar/aura/101590700')

  assert.deepEqual(aura?.item, {
    itemId: 'c6ca900e513cccb177890939de234227',
    itemName: '열대야의 추억',
    itemRarity: '레어'
  })
  assert.equal(findSlotItem('title', 'aura:845:character/swordman/avatar/aura/101590700'), null)
  assert.equal(findSlotItem('title', 'missing-slot-item'), null)
})

// 대응 파일에 없는 묶음은 운영에서 대표 아이템을 관측하지 못했거나(칭호 1123의 100333421, 849의 100332647),
// 최상위 명성 밖에서 같은 명성의 가장 많이 착용한 일반 아이템 묶음을 대표로 남긴 묶음이다.
test('대응 파일에 없는 묶음은 목록에서 빠지고, 빠진 묶음의 명성은 남은 묶음이 대표한다', () => {
  const missing = engineIds.filter((id) => observed.items[id] === undefined)

  assert.deepEqual(missing, [
    'title:1123:character/common/title/100333421',
    'title:849:character/common/title/100332897',
    'title:849:character/common/title/100332647',
    'title:790:character/common/title/100333192',
    'creature:889:creature/100991472',
    'creature:810:creature/2026_arcana/platinum/destinylion/autocreature_100',
    'aura:463:character/swordman/avatar/aura/101590906',
    'aura:463:character/swordman/avatar/aura/101590905',
    'aura:463:character/swordman/avatar/aura/101590704',
    'aura:463:character/swordman/avatar/aura/101590703',
    'aura:463:character/swordman/avatar/aura/101590701',
    'aura:463:character/swordman/avatar/aura/101590702'
  ])

  for (const category of SLOT_ITEM_CATEGORIES) {
    const fames = new Set(slotItemsOf(category).map(({ fame }) => fame))

    for (const { id, fame } of table.categories[category]) {
      if (missing.includes(id)) {
        assert.equal(findSlotItem(category, id), null, id)
        assert.ok(fames.has(fame), id)
      }
    }
  }
})

// 최상위 명성에서만 플래티넘 판이 일반 판과 점수가 달라 둘을 따로 둔다.
test('최상위 명성 밖에서는 명성이 겹치지 않고, 최상위 명성은 일반과 플래티넘 한 개씩까지 둔다', () => {
  for (const category of SLOT_ITEM_CATEGORIES) {
    const items = slotItemsOf(category)
    const top = Math.max(...items.map(({ fame }) => fame))
    const below = items.filter(({ fame }) => fame !== top).map(({ fame }) => fame)
    const topItems = items.filter(({ fame }) => fame === top)
    const platinum = topItems.filter(({ item }) => item.itemName.includes('플래티넘'))

    assert.equal(new Set(below).size, below.length, category)
    assert.ok(platinum.length <= 1, category)
    assert.ok(topItems.length - platinum.length <= 1, category)
  }
})

test('대응 파일의 묶음 id는 모두 엔진 목록에 있다', () => {
  const unknown = Object.keys(observed.items).filter((id) => !engineIds.includes(id))

  assert.deepEqual(unknown, [])
})

test('대응 파일이 이름을 덮어쓴 묶음 넷은 그 이름으로 보인다', () => {
  assert.equal(
    findSlotItem('title', 'title:1123:character/common/title/100333448')?.name,
    '프로스트의 전설 플래티넘'
  )
  assert.equal(
    findSlotItem('creature', 'creature:1261:creature/22_lounge6/autocreature_100')?.name,
    '운명을 담는 재단사 플래티넘'
  )
  assert.equal(
    findSlotItem('title', 'title:1123:character/common/title/100333206')?.name,
    '프로스트의 전설'
  )
  assert.equal(
    findSlotItem('title', 'title:849:character/common/title/100332937')?.name,
    '진정한 각성을 이룬 자'
  )
})

test('카테고리 안에서 표시 이름이 겹치지 않는다', () => {
  for (const category of SLOT_ITEM_CATEGORIES) {
    const names = slotItemsOf(category).map(({ name }) => name)

    assert.equal(new Set(names).size, names.length, category)
  }
})

// 대표가 아닌 아이템의 itemId는 이름으로만 묶음을 찾는지 보려고 만든 값이다.
const OTHER_ITEM_ID = '0'.repeat(32)
const FROST_PLATINUM = 'title:1123:character/common/title/100333448'
const FROST = 'title:1123:character/common/title/100333206'

test('findWornSlotItem은 착용 아이템의 이름이 멤버인 묶음을 찾고, 다른 카테고리나 목록에서 빠진 묶음의 멤버는 null이다', () => {
  assert.equal(
    findWornSlotItem('title', { itemId: OTHER_ITEM_ID, itemName: '프로스트의 전설 플래티넘[35Lv]' })
      ?.id,
    FROST_PLATINUM
  )
  assert.equal(
    findWornSlotItem('aura', { itemId: OTHER_ITEM_ID, itemName: '고결한 영혼의 잔상' })?.id,
    'aura:645:character/swordman/avatar/aura/101590961'
  )
  assert.equal(
    findWornSlotItem('creature', { itemId: OTHER_ITEM_ID, itemName: '고결한 영혼의 잔상' }),
    null
  )
  assert.equal(
    findWornSlotItem('title', {
      itemId: OTHER_ITEM_ID,
      itemName: '진정한 각성을 이룬 자 플래티넘[35Lv]'
    }),
    null
  )
  assert.equal(findWornSlotItem('title', { itemId: OTHER_ITEM_ID, itemName: null }), null)
})

// "프로스트의 전설"은 목록에 있는 묶음과 빠진 묶음(100333421)에 같은 이름으로 있어 효과가 다를 수 있다.
test('findWornSlotItem은 여러 묶음에 같은 이름이 있는 아이템을 대표 아이템과 itemId가 같을 때만 그 묶음으로 본다', () => {
  const frost = findSlotItem('title', FROST)

  assert.equal(
    findWornSlotItem('title', { itemId: frost.item.itemId, itemName: '프로스트의 전설' })?.id,
    FROST
  )
  assert.equal(
    findWornSlotItem('title', { itemId: OTHER_ITEM_ID, itemName: '프로스트의 전설' }),
    null
  )
})
