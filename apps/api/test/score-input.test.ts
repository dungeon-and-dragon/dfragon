import assert from 'node:assert/strict'
import test from 'node:test'
import { unavailableDetail } from '../src/characters/catalog/types.js'
import { toScoreEngineInput } from '../src/score/input.js'
import { loadCatalog, payloadsFromEngineInput, readEngineInput } from './score-fixtures.js'

function engraveItemIds(input: ReturnType<typeof readEngineInput>): string[] {
  const equipment = input.equipment.equipment
  if (!Array.isArray(equipment)) {
    return []
  }

  return equipment.flatMap((item: Record<string, unknown>) => {
    const engrave = item.engrave as Record<string, unknown> | undefined
    if (typeof engrave?.itemId !== 'string') {
      return []
    }

    return [engrave.itemId]
  })
}

test('상세 조회 원문과 공용 아이템 결과로 Desktop 점수 테스트와 같은 엔진 입력을 만든다', () => {
  for (const name of ['dealer-blade', 'buffer-muse'] as const) {
    const original = readEngineInput(name)
    const payloads = payloadsFromEngineInput(original)

    const input = toScoreEngineInput(payloads, loadCatalog(payloads, original.items))

    const { items, ...documents } = input
    const { items: originalItems, ...originalDocuments } = original
    assert.deepEqual(documents, originalDocuments, name)
    // 상세 응답은 engrave 아이템에 공용 아이템 정보를 붙이지 않으므로 Desktop 입력에서도 빠진다.
    const skipped = engraveItemIds(original)
    const expectedItems = Object.fromEntries(
      Object.entries(originalItems).filter(([itemId]) => !skipped.includes(itemId))
    )
    assert.deepEqual(items, expectedItems, name)
  }
})

test('조회하지 못한 공용 아이템은 엔진 입력의 items에 넣지 않는다', () => {
  const original = readEngineInput('dealer-blade')
  const payloads = payloadsFromEngineInput(original)
  const catalog = loadCatalog(payloads, original.items)
  const [unavailableId, freshId] = [...catalog.keys()]
  catalog.set(unavailableId!, unavailableDetail)

  const input = toScoreEngineInput(payloads, catalog)

  assert.equal(Object.hasOwn(input.items, unavailableId!), false)
  assert.deepEqual(input.items[freshId!], original.items[freshId!])
})
