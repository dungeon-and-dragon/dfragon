import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  addLabCurrency,
  createDatabaseClient,
  deleteLabCandidatesOtherVersions,
  readLabCandidateIcon,
  readLabCandidatePriceTargets,
  readLabCandidates,
  readLabCurrencies,
  readLabCurrencyIcon,
  readLabItemGroups,
  readLabItemDetailIcon,
  readLabItemDetails,
  readLabItemPrices,
  recordAuctionPrice,
  replaceLabItemGroup,
  saveLabItemDetail,
  saveLabCandidateIcon,
  upsertLabCandidates,
  updateLabCurrency
} from '../dist/index.js'

const port = process.env.DFRAGON_TEST_LAB_ITEM_PORT

const titleFinal = { category: 'TITLE', role: 'all', tier: '종결' }
const weaponDealerFinal = { category: 'WEAPON', role: 'dealer', tier: '종결' }
const pngIcon = { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), contentType: 'image/png' }
const webpIcon = { bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]), contentType: 'image/webp' }

const MIGRATIONS = [
  '20261126100000_add_lab_items_auction_prices',
  '20261126200000_add_lab_currencies',
  '20261127100000_add_lab_currency_description',
  '20261127200000_add_lab_item_details',
  '20261128100000_add_lab_item_tooltip_fields',
  '20261128200000_add_lab_candidates_auction_price_history',
  '20261128210000_add_lab_candidate_wear_counts'
]

const noTooltip = { itemTypeDetail: null, availableLevel: null, fame: null, card: null }
const tooltip = {
  itemTypeDetail: '합성 재료',
  availableLevel: 115,
  fame: 232,
  card: {
    slots: ['상의', '하의'],
    enchants: [
      { upgrade: 0, status: [{ name: '힘', value: '90' }] },
      { upgrade: 1, status: [{ name: '힘', value: '100' }] }
    ]
  }
}

function currency(name, description = null) {
  return { name, description }
}

function unpriced(itemName) {
  return { itemName, cost: null }
}

function groupOf(groups, key) {
  return groups.find(
    ({ category, role, tier }) =>
      category === key.category && role === key.role && tier === key.tier
  )
}

function namesOf(groups, key) {
  return groupOf(groups, key)?.items.map(({ itemName }) => itemName)
}

async function connectWithEmptyTables(t) {
  const client = createDatabaseClient({
    host: '127.0.0.1',
    port: Number(port),
    database: 'lab_item_test',
    username: 'lab_item_test',
    password: 'synthetic'
  })

  t.after(() => client.$disconnect())
  await client.$executeRawUnsafe(
    'DROP TABLE IF EXISTS "lab_items", "auction_prices", "lab_currencies", "lab_item_details", "lab_candidates", "auction_price_history", "lab_candidate_wear_counts"'
  )

  for (const name of MIGRATIONS) {
    const migration = await readFile(
      new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
      'utf8'
    )

    for (const statement of migration
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part !== '' && part !== 'BEGIN' && part !== 'COMMIT')) {
      await client.$executeRawUnsafe(statement)
    }
  }

  return client
}

async function addCurrency(client, name) {
  const addition = await addLabCurrency(client, currency(name), pngIcon)
  assert.equal(addition.status, 'added')

  return addition.id
}

test('묶음 하나를 바꾸면 그 묶음에는 새 이름만 남고 다른 묶음은 그대로다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)

  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [unpriced('합성 칭호 A'), unpriced('합성 칭호 B')]
  })
  await replaceLabItemGroup(client, { ...weaponDealerFinal, items: [unpriced('합성 카드 A')] })
  const [kept] = await client.$queryRaw`
    SELECT "created_at" AS "createdAt" FROM "lab_items" WHERE "item_name" = '합성 칭호 B'`

  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [unpriced('합성 칭호 B'), unpriced('합성 칭호 C')]
  })

  const replaced = await readLabItemGroups(client)
  assert.deepEqual(namesOf(replaced, titleFinal), ['합성 칭호 B', '합성 칭호 C'])
  assert.deepEqual(namesOf(replaced, weaponDealerFinal), ['합성 카드 A'])
  const [after] = await client.$queryRaw`
    SELECT "created_at" AS "createdAt" FROM "lab_items" WHERE "item_name" = '합성 칭호 B'`
  assert.deepEqual(after, kept)

  await replaceLabItemGroup(client, { ...titleFinal, items: [] })

  assert.deepEqual(await readLabItemGroups(client), [
    { ...weaponDealerFinal, items: [unpriced('합성 카드 A')] }
  ])
})

test('남는 이름의 재화 비용을 바꾸거나 지우면 그 묶음의 그 이름에만 반영된다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const currencyId = await addCurrency(client, '합성 재화')

  await replaceLabItemGroup(client, {
    ...weaponDealerFinal,
    items: [{ itemName: '합성 보주', cost: { currencyId, count: 5 } }, unpriced('합성 카드 A')]
  })
  await replaceLabItemGroup(client, { ...titleFinal, items: [unpriced('합성 보주')] })
  await replaceLabItemGroup(client, {
    ...weaponDealerFinal,
    items: [unpriced('합성 보주'), { itemName: '합성 카드 A', cost: { currencyId, count: 2 } }]
  })

  const groups = await readLabItemGroups(client)
  assert.deepEqual(groupOf(groups, weaponDealerFinal).items, [
    unpriced('합성 보주'),
    { itemName: '합성 카드 A', cost: { currencyId, count: 2 } }
  ])
  assert.deepEqual(groupOf(groups, titleFinal).items, [unpriced('합성 보주')])
})

test('가격은 이름으로, 재화는 비용으로 붙이고, 32bit를 넘는 가격도 숫자로 읽는다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const checkedAt = new Date('2026-11-26T00:00:00.000Z')
  const currencyId = await addCurrency(client, '합성 재화')
  const [{ updatedAt }] = await readLabCurrencies(client)

  await replaceLabItemGroup(client, {
    ...weaponDealerFinal,
    items: [unpriced('합성 카드 A'), unpriced('합성 카드 B')]
  })
  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [unpriced('합성 카드 A'), { itemName: '합성 칭호 A', cost: { currencyId, count: 3 } }]
  })
  await client.$executeRaw`
    INSERT INTO "auction_prices" ("item_name", "item_id", "item_rarity", "unit_price", "checked_at")
    VALUES
      ('합성 카드 A', 'synthetic-item', '레전더리', 3000000000, ${checkedAt}),
      ('합성 칭호 A', 'synthetic-title', '유니크', NULL, ${checkedAt})`

  const price = {
    itemId: 'synthetic-item',
    itemRarity: '레전더리',
    unitPrice: 3_000_000_000,
    checkedAt,
    cost: null,
    detail: null,
    candidate: null
  }
  const missing = {
    itemId: null,
    itemRarity: null,
    unitPrice: null,
    checkedAt: null,
    cost: null,
    detail: null,
    candidate: null
  }
  const exchanged = {
    itemId: 'synthetic-title',
    itemRarity: '유니크',
    unitPrice: null,
    checkedAt,
    cost: {
      currencyId,
      currencyName: '합성 재화',
      currencyDescription: null,
      currencyUpdatedAt: updatedAt,
      count: 3
    },
    detail: null,
    candidate: null
  }

  assert.deepEqual(await readLabItemPrices(client), [
    { ...weaponDealerFinal, itemName: '합성 카드 A', ...price },
    { ...weaponDealerFinal, itemName: '합성 카드 B', ...missing },
    { ...titleFinal, itemName: '합성 카드 A', ...price },
    { ...titleFinal, itemName: '합성 칭호 A', ...exchanged }
  ])
})

test('재화는 이름이 겹치면 더하거나 바꾸지 않고, 아이콘 없이 고치면 이름과 설명만 바꾼다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const firstId = await addCurrency(client, '합성 재화 A')
  const secondId = await addCurrency(client, '합성 재화 B')

  const addedDuplicate = await addLabCurrency(client, currency('합성 재화 A'), webpIcon)
  assert.deepEqual(addedDuplicate, { status: 'duplicate' })
  const renamedDuplicate = await updateLabCurrency(client, secondId, currency('합성 재화 A'), null)
  assert.deepEqual(renamedDuplicate, { status: 'duplicate' })
  const missing = await updateLabCurrency(client, secondId + 100, currency('합성 재화 C'), null)
  assert.deepEqual(missing, { status: 'notFound' })

  // 같은 ms 안에 고쳐도 바뀐 시각을 비교할 수 있게 먼저 시각을 과거로 돌린다.
  const before = new Date('2026-11-01T00:00:00.000Z')
  await client.$executeRaw`UPDATE "lab_currencies" SET "updated_at" = ${before}`
  const described = await updateLabCurrency(
    client,
    secondId,
    currency('합성 재화 C', '합성 설명\n둘째 줄'),
    null
  )
  assert.deepEqual(described, { status: 'updated' })
  assert.deepEqual(await readLabCurrencyIcon(client, secondId), pngIcon)

  const reiconed = await updateLabCurrency(client, firstId, currency('합성 재화 A'), webpIcon)
  assert.deepEqual(reiconed, { status: 'updated' })
  assert.deepEqual(await readLabCurrencyIcon(client, firstId), webpIcon)

  const currencies = await readLabCurrencies(client)
  assert.deepEqual(
    currencies.map(({ id, name, description }) => ({ id, name, description })),
    [
      { id: firstId, name: '합성 재화 A', description: null },
      { id: secondId, name: '합성 재화 C', description: '합성 설명\n둘째 줄' }
    ]
  )
  assert.ok(currencies.every(({ updatedAt }) => updatedAt > before))
  assert.equal(await readLabCurrencyIcon(client, secondId + 100), null)
})

test('재화 설명은 추가할 때 넣을 수 있고, 가격 읽기의 비용에 함께 실린다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const addition = await addLabCurrency(client, currency('합성 재화', '합성 설명'), pngIcon)
  assert.equal(addition.status, 'added')

  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [{ itemName: '합성 칭호 A', cost: { currencyId: addition.id, count: 2 } }]
  })

  const [row] = await readLabItemPrices(client)
  assert.equal(row.cost.currencyDescription, '합성 설명')
  assert.equal((await readLabCurrencies(client))[0].description, '합성 설명')
})

test('아이템 상세는 이름마다 한 행으로 저장해 tooltip 값을 바꾸고, 아이콘을 주지 않으면 그대로 두며 null이면 지운다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const detail = { description: '합성 설명', itemRarity: '유니크', ...tooltip }

  await saveLabItemDetail(client, '합성 상자', detail, pngIcon)
  assert.deepEqual((await readLabItemDetails(client))[0].card, tooltip.card)
  await saveLabItemDetail(
    client,
    '합성 상자',
    { description: null, itemRarity: '에픽', ...noTooltip },
    undefined
  )

  assert.deepEqual(await readLabItemDetailIcon(client, '합성 상자'), pngIcon)
  const savedDetails = await readLabItemDetails(client)
  assert.equal(savedDetails.length, 1)
  const [saved] = savedDetails
  assert.deepEqual(
    { ...saved, updatedAt: undefined },
    {
      itemName: '합성 상자',
      description: null,
      itemRarity: '에픽',
      ...noTooltip,
      hasIcon: true,
      updatedAt: undefined
    }
  )

  await saveLabItemDetail(client, '합성 상자', detail, null)

  assert.equal(await readLabItemDetailIcon(client, '합성 상자'), null)
  assert.equal((await readLabItemDetails(client))[0].hasIcon, false)
  assert.equal(await readLabItemDetailIcon(client, '없는 상자'), null)
})

test('가격 읽기는 이름으로 아이템 상세와 tooltip 값을 붙이고, 아이콘이 있을 때만 아이콘 시각을 낸다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [unpriced('합성 상자'), unpriced('합성 칭호'), unpriced('합성 카드')]
  })
  await saveLabItemDetail(
    client,
    '합성 상자',
    { description: '합성 설명', itemRarity: '유니크', ...tooltip },
    pngIcon
  )
  await saveLabItemDetail(
    client,
    '합성 칭호',
    { description: null, itemRarity: '레어', ...noTooltip },
    undefined
  )
  const [{ updatedAt }] = await readLabItemDetails(client)

  const details = (await readLabItemPrices(client)).map(({ itemName, detail }) => ({
    itemName,
    detail
  }))

  assert.deepEqual(details, [
    {
      itemName: '합성 상자',
      detail: {
        description: '합성 설명',
        itemRarity: '유니크',
        iconUpdatedAt: updatedAt,
        ...tooltip
      }
    },
    {
      itemName: '합성 칭호',
      detail: { description: null, itemRarity: '레어', iconUpdatedAt: null, ...noTooltip }
    },
    { itemName: '합성 카드', detail: null }
  ])
})

const importedAt = new Date('2026-11-27T00:00:00Z')
const invalidCandidateCategoryPattern = /lab_candidates_(kind|categories_roles)_check/
const invalidCandidateIconPattern = /lab_candidates_icon_check/

function candidate(itemName, changes = {}) {
  return {
    itemName,
    kind: 'TITLE',
    categories: ['TITLE'],
    roles: ['all'],
    itemRarity: '레어',
    ...noTooltip,
    options: [{ name: '힘', value: '100' }],
    buffLines: ['합성 버프 옵션'],
    description: '합성 후보 설명',
    sourceItemId: 'synthetic-source',
    ...changes
  }
}

test('후보를 다른 판으로 다시 넣으면 값을 바꾸고 아이콘과 아이콘 시각은 유지한다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const itemName = '합성 후보'
  await upsertLabCandidates(client, {
    versionId: 'first',
    importedAt,
    items: [candidate(itemName)]
  })
  assert.equal(await readLabCandidateIcon(client, itemName), null)
  assert.deepEqual(await saveLabCandidateIcon(client, '없는 후보', pngIcon), { status: 'notFound' })
  assert.equal(await readLabCandidateIcon(client, '없는 후보'), null)
  assert.deepEqual(await saveLabCandidateIcon(client, itemName, pngIcon), { status: 'updated' })
  const [{ iconUpdatedAt }] = await readLabCandidates(client)
  assert.ok(iconUpdatedAt instanceof Date)

  const later = new Date('2026-11-28T00:00:00Z')
  const changed = candidate(itemName, {
    kind: 'ENCHANT',
    categories: ['WEAPON', 'JACKET'],
    roles: ['dealer', 'buffer'],
    itemRarity: '유니크',
    ...tooltip,
    options: [],
    buffLines: [],
    description: null,
    sourceItemId: 'synthetic-other-source'
  })
  await upsertLabCandidates(client, { versionId: 'second', importedAt: later, items: [changed] })

  assert.deepEqual(await readLabCandidateIcon(client, itemName), pngIcon)
  assert.deepEqual(await readLabCandidates(client), [
    {
      ...changed,
      versionId: 'second',
      importedAt: later,
      hasIcon: true,
      iconUpdatedAt,
      itemId: null,
      unitPrice: null,
      checkedAt: null,
      previousPrice: null,
      wearCount: null,
      wearCountedAt: null
    }
  ])
  await saveLabCandidateIcon(client, itemName, webpIcon)
  assert.deepEqual(await readLabCandidateIcon(client, itemName), webpIcon)
})

test('후보 정리는 지정한 판만 남기며 없는 판이면 0을 알리고 기존 후보를 보존한다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  await upsertLabCandidates(client, {
    versionId: 'old',
    importedAt,
    items: [candidate('합성 이전 후보')]
  })
  await upsertLabCandidates(client, {
    versionId: 'new',
    importedAt,
    items: [candidate('합성 새 후보'), candidate('합성 새 후보 B')]
  })
  assert.deepEqual(await deleteLabCandidatesOtherVersions(client, 'missing'), {
    remaining: 0,
    deleted: 0
  })
  assert.equal((await readLabCandidates(client)).length, 3)
  assert.deepEqual(await deleteLabCandidatesOtherVersions(client, 'new'), {
    remaining: 2,
    deleted: 1
  })
  assert.deepEqual(
    (await readLabCandidates(client)).map(({ itemName }) => itemName),
    ['합성 새 후보', '합성 새 후보 B']
  )
  assert.deepEqual(await deleteLabCandidatesOtherVersions(client, 'new'), {
    remaining: 2,
    deleted: 0
  })
})

test('후보 조회는 종류, 부위, 역할을 거르고 명성순으로 가격과 직전의 다른 가격을 붙인다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const enchant = { kind: 'ENCHANT', categories: ['WEAPON', 'JACKET'], roles: ['dealer', 'buffer'] }
  await upsertLabCandidates(client, {
    versionId: 'first',
    importedAt,
    items: [
      candidate('합성 높은 카드', { ...enchant, fame: 500 }),
      candidate('합성 낮은 카드', { ...enchant, fame: 100 }),
      candidate('합성 명성 없는 카드', enchant),
      candidate('합성 다른 부위', { ...enchant, categories: ['PANTS'], fame: 900 }),
      candidate('합성 다른 역할', { ...enchant, roles: ['buffer'], fame: 800 }),
      candidate('합성 칭호', { fame: 700 })
    ]
  })
  const price = { itemName: '합성 높은 카드', itemId: 'synthetic-item', itemRarity: '유니크' }
  await recordAuctionPrice(client, { ...price, unitPrice: 3_000_000_000, checkedAt: importedAt })
  const changedAt = new Date('2026-11-27T01:00:00Z')
  await recordAuctionPrice(client, { ...price, unitPrice: 4_000_000_000, checkedAt: changedAt })
  const dailyAt = new Date('2026-11-28T01:00:00Z')
  await recordAuctionPrice(client, { ...price, unitPrice: 4_000_000_000, checkedAt: dailyAt })
  await recordAuctionPrice(client, {
    ...price,
    itemName: '합성 다른 부위',
    unitPrice: 1,
    checkedAt: dailyAt
  })
  const rows = await readLabCandidates(client, {
    kind: 'ENCHANT',
    category: 'WEAPON',
    role: 'dealer'
  })

  assert.deepEqual(
    rows.map(({ itemName }) => itemName),
    ['합성 높은 카드', '합성 낮은 카드', '합성 명성 없는 카드']
  )
  assert.equal(rows[0].unitPrice, 4_000_000_000)
  assert.equal(rows[0].itemId, 'synthetic-item')
  assert.deepEqual(rows[0].checkedAt, dailyAt)
  assert.deepEqual(rows[0].previousPrice, {
    itemId: 'synthetic-item',
    unitPrice: 3_000_000_000,
    checkedAt: importedAt
  })
  for (const row of rows.slice(1)) {
    assert.equal(row.itemId, null)
    assert.equal(row.unitPrice, null)
    assert.equal(row.checkedAt, null)
    assert.equal(row.previousPrice, null)
  }
  assert.ok(rows.every(({ wearCount }) => wearCount === null))
  assert.ok(rows.every((row) => !('icon' in row) && !('iconContentType' in row)))
  assert.deepEqual(
    (await readLabCandidates(client, { kind: 'TITLE' })).map(({ itemName }) => itemName),
    ['합성 칭호']
  )

  const missingAt = new Date('2026-11-28T02:00:00Z')
  await recordAuctionPrice(client, { ...price, unitPrice: null, checkedAt: missingAt })
  const [missing] = await readLabCandidates(client, {
    kind: 'ENCHANT',
    category: 'WEAPON',
    role: 'dealer'
  })
  assert.equal(missing.unitPrice, null)
  assert.deepEqual(missing.previousPrice, {
    itemId: 'synthetic-item',
    unitPrice: 4_000_000_000,
    checkedAt: dailyAt
  })
  await recordAuctionPrice(client, {
    ...price,
    unitPrice: 100,
    checkedAt: new Date('2026-11-28T03:00:00Z')
  })
  const [returned] = await readLabCandidates(client, {
    kind: 'ENCHANT',
    category: 'WEAPON',
    role: 'dealer'
  })
  assert.deepEqual(returned.previousPrice, {
    itemId: 'synthetic-item',
    unitPrice: null,
    checkedAt: missingAt
  })
})

test('후보 가격 대상은 고른 이름을 빼고, 고른 아이템의 가격 조회는 후보 상세를 이름으로 붙인다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  const selected = candidate('합성 선택 후보', { ...tooltip })
  const noIcon = candidate('합성 아이콘 없는 후보')
  await upsertLabCandidates(client, {
    versionId: 'first',
    importedAt,
    items: [
      selected,
      noIcon,
      candidate('합성 미선택 카드', {
        kind: 'ENCHANT',
        categories: ['WEAPON', 'JACKET'],
        roles: ['dealer']
      })
    ]
  })
  await saveLabCandidateIcon(client, selected.itemName, pngIcon)
  await replaceLabItemGroup(client, {
    ...titleFinal,
    items: [
      unpriced(selected.itemName),
      unpriced(noIcon.itemName),
      unpriced('합성 후보 없는 아이템')
    ]
  })
  await replaceLabItemGroup(client, { ...weaponDealerFinal, items: [unpriced(selected.itemName)] })

  assert.deepEqual(await readLabCandidatePriceTargets(client), [
    { itemName: '합성 미선택 카드', exchanged: false, categories: ['WEAPON', 'JACKET'] }
  ])
  const [{ iconUpdatedAt }] = await readLabCandidates(client, { kind: 'TITLE' })
  const rows = await readLabItemPrices(client)
  assert.deepEqual(
    rows.map(({ candidate: detail }) => detail),
    [
      { description: selected.description, itemRarity: '레어', ...tooltip, iconUpdatedAt },
      { description: noIcon.description, itemRarity: '레어', ...noTooltip, iconUpdatedAt: null },
      null,
      { description: selected.description, itemRarity: '레어', ...tooltip, iconUpdatedAt }
    ]
  )
  assert.ok(rows.every(({ detail }) => detail === null))
})

test('후보 CHECK는 일반 종류의 목록과 아이콘 쌍을 지키고 잘못된 묶음은 모두 rollback한다', {
  skip: port === undefined
}, async (t) => {
  const client = await connectWithEmptyTables(t)
  for (const changes of [
    { kind: 'OTHER' },
    { categories: ['TITLE', 'CREATURE'] },
    { categories: ['CREATURE'] },
    { categories: [] },
    { roles: ['dealer'] },
    { roles: ['all', 'buffer'] },
    { roles: [] }
  ]) {
    await assert.rejects(
      upsertLabCandidates(client, {
        versionId: 'first',
        importedAt,
        items: [candidate('합성 정상 후보'), candidate('합성 잘못된 후보', changes)]
      }),
      invalidCandidateCategoryPattern
    )
    assert.deepEqual(await readLabCandidates(client), [])
  }
  await upsertLabCandidates(client, {
    versionId: 'first',
    importedAt,
    items: [candidate('합성 후보')]
  })
  await assert.rejects(
    client.$executeRaw`
    UPDATE "lab_candidates" SET "icon_content_type" = 'image/png' WHERE "item_name" = '합성 후보'`,
    invalidCandidateIconPattern
  )
  await assert.rejects(
    client.$executeRaw`
    UPDATE "lab_candidates" SET "icon" = ${pngIcon.bytes}::bytea WHERE "item_name" = '합성 후보'`,
    invalidCandidateIconPattern
  )
  assert.equal(await readLabCandidateIcon(client, '합성 후보'), null)
})
