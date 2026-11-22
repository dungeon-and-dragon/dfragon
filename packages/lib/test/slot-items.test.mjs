import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { SLOT_ITEM_CATEGORIES, findSlotItem, slotItemsOf } from '@dfragon/lib/slot-items'

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
      '운명이 담긴 책',
      '프로스트의 전설',
      '진정한 각성을 이룬 자',
      '마스터 다이버',
      '세리아의 풍성한 선물 Ver.2',
      '달을 삼킨 자 플래티넘'
    ]
  ],
  [
    'creature',
    [
      '운명을 담는 여신',
      '운명을 담는 재단사',
      'SD 흰 구름 전령 에를리히',
      '순백의 나비 공주',
      '페이퍼 폭스 플래티넘',
      '다정한 SD 세리아 Ver.2',
      '데스티니 라이언 플래티넘'
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

test('운영에서 대표 아이템을 관측하지 못한 칭호 묶음 둘만 목록에서 빠진다', () => {
  const missing = engineIds.filter((id) => observed.items[id] === undefined)

  assert.deepEqual(missing, [
    'title:1123:character/common/title/100333421',
    'title:849:character/common/title/100332647'
  ])

  for (const id of missing) {
    assert.equal(findSlotItem('title', id), null, id)
  }
})

test('대응 파일의 묶음 id는 모두 엔진 목록에 있다', () => {
  const unknown = Object.keys(observed.items).filter((id) => !engineIds.includes(id))

  assert.deepEqual(unknown, [])
})

test('겹치던 묶음이 빠진 칭호 둘은 덮어쓴 이름으로 보인다', () => {
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
