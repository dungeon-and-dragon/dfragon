import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { StoredCharacterSection } from '@dfragon/database'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import { projectCharacterChanges } from '../src/domain/character-history/changes.js'
import { toSectionBodies } from '@dfragon/server-core/domain/character-history/index.js'

type Body = Record<string, unknown>
type Item = Record<string, unknown>

function readBodies() {
  const url = new URL(
    '../../../../packages/server-core/test/fixtures/character-card-dealer.json',
    import.meta.url
  )
  const { sections } = JSON.parse(readFileSync(url, 'utf8')) as { sections: CharacterPayloads }

  return toSectionBodies(sections)
}

const bodies = readBodies()
const firstAt = new Date('2026-11-05T13:00:00Z')
const secondAt = new Date('2026-11-08T06:31:00Z')
const thirdAt = new Date('2026-11-13T11:40:00Z')

function row(section: string, observedAt: Date, data: Body): StoredCharacterSection {
  return { section, observedAt, data }
}

// 실응답 fixture의 장비 섹션에서 고른 슬롯의 칸만 바꾼 합성 본문이다.
function equipmentWith(change: (slotId: string, item: Item) => Item, setItemInfo?: unknown): Body {
  const equipment = bodies.equipment.equipment as Item[]
  const changed = equipment.map((item) => change(String(item.slotId), item))
  const sets = setItemInfo ?? bodies.equipment.setItemInfo

  return {
    ...bodies.equipment,
    equipment: changed,
    setItemInfo: sets
  }
}

function creatureWith(change: (artifact: Item) => Item): Body {
  const creature = bodies.creature.creature as { artifact: Item[] }
  const artifact = creature.artifact.map(change)

  return { creature: { ...creature, artifact } }
}

const first = { observedAt: firstAt.toISOString(), first: true, items: [] }

test('장비 하나의 재련만 바뀐 두 저장 사이에서 그 부위와 재련 이전, 이후가 한 줄 나온다', () => {
  const refined = equipmentWith((slotId, item) =>
    slotId === 'WEAPON' ? { ...item, refine: 1 } : item
  )

  const changes = projectCharacterChanges(firstAt, [
    row('equipment', firstAt, bodies.equipment),
    row('equipment', secondAt, refined)
  ])

  assert.deepEqual(changes, [
    first,
    {
      observedAt: secondAt.toISOString(),
      first: false,
      items: [
        {
          kind: 'equipment',
          slotId: 'WEAPON',
          slotName: '무기',
          itemName: '재앙의 송곳니',
          itemRarity: '태초',
          replaced: null,
          fields: [{ field: 'refine', name: null, before: 0, after: 1 }]
        }
      ]
    }
  ])
})

test('강화, 증폭, 조율, 마법부여, 칭호 교체, 세트 등급과 포인트, 크리쳐 아티팩트 교체를 같은 시점 아래에 모두 준다', () => {
  const grown = equipmentWith(
    (slotId, item) => {
      if (slotId === 'TITLE') {
        return { ...item, itemId: 'synthetic-title', itemName: '순백의 눈꽃 결정[30Lv]' }
      }

      if (slotId === 'WEAPON') {
        return { ...item, reinforce: 11 }
      }

      if (slotId === 'EARRING') {
        return { ...item, reinforce: 9 }
      }

      if (slotId === 'JACKET') {
        const enchant = {
          status: [
            { name: '최종 데미지 증가', value: '3%' },
            { name: '물리 공격력', value: 110 },
            { name: '마법 공격력', value: 110 },
            { name: '독립 공격력', value: 110 },
            { name: '힘', value: 90 },
            { name: '지능', value: 90 }
          ]
        }

        return { ...item, enchant, tune: [{ level: 3, setPoint: 265 }] }
      }

      return item
    },
    [
      {
        setItemId: '4ee7bd5912cda6e2a24c1f36d5202b46',
        setItemName: '소울 페어리 세트',
        setItemRarityName: '에픽 Ⅴ',
        active: { setPoint: { current: 2495 } }
      }
    ]
  )
  const artifactChanged = creatureWith((artifact) =>
    artifact.slotColor === 'BLUE'
      ? {
          ...artifact,
          itemId: 'synthetic-artifact',
          itemName: '눈부신 영원의 달빛',
          itemRarity: '유니크'
        }
      : artifact
  )

  const earring = (bodies.equipment.equipment as Item[]).at(-1)
  const earringName = String(earring?.itemName)
  const earringRarity = String(earring?.itemRarity)

  const changes = projectCharacterChanges(firstAt, [
    row('equipment', firstAt, bodies.equipment),
    row('creature', firstAt, bodies.creature),
    row('creature', secondAt, artifactChanged),
    row('equipment', secondAt, grown)
  ])

  assert.equal(changes.length, 2)
  assert.deepEqual(changes[1]?.items, [
    {
      kind: 'equipment',
      slotId: 'WEAPON',
      slotName: '무기',
      itemName: '재앙의 송곳니',
      itemRarity: '태초',
      replaced: null,
      fields: [{ field: 'reinforce', name: null, before: 10, after: 11 }]
    },
    {
      kind: 'equipment',
      slotId: 'TITLE',
      slotName: '칭호',
      itemName: '순백의 눈꽃 결정[30Lv]',
      itemRarity: '레어',
      replaced: { itemName: '프로스트의 전설 플래티넘[35Lv]', itemRarity: '레어' },
      fields: []
    },
    {
      kind: 'equipment',
      slotId: 'JACKET',
      slotName: '상의',
      itemName: '긍휼 속 자비의 상의',
      itemRarity: '에픽',
      replaced: null,
      fields: [
        { field: 'tune', name: null, before: 0, after: 3 },
        { field: 'enchant', name: '최종 데미지 증가', before: '1%', after: '3%' }
      ]
    },
    {
      kind: 'equipment',
      slotId: 'EARRING',
      slotName: '귀걸이',
      itemName: earringName,
      itemRarity: earringRarity,
      replaced: null,
      fields: [{ field: 'amplify', name: null, before: 8, after: 9 }]
    },
    {
      kind: 'set',
      setItemId: '4ee7bd5912cda6e2a24c1f36d5202b46',
      setItemName: '소울 페어리 세트',
      fields: [
        { field: 'rarity', name: null, before: '태초', after: '에픽 Ⅴ' },
        { field: 'point', name: null, before: 2615, after: 2495 }
      ]
    },
    {
      kind: 'artifact',
      slotColor: 'BLUE',
      itemName: '눈부신 영원의 달빛',
      itemRarity: '유니크',
      replaced: { itemName: '기민한 적룡의 날개', itemRarity: '레어' }
    }
  ])
})

test('스탯처럼 변경점을 만들지 않는 섹션만 바뀐 시점은 목록에 나오지 않고, 한 시점뿐이면 첫 기록 하나만 나온다', () => {
  const changedStatus = { ...bodies.status, status: [] }

  assert.deepEqual(
    projectCharacterChanges(firstAt, [
      row('equipment', firstAt, bodies.equipment),
      row('status', firstAt, bodies.status),
      row('status', thirdAt, changedStatus)
    ]),
    [first]
  )
  assert.deepEqual(
    projectCharacterChanges(firstAt, [row('equipment', firstAt, bodies.equipment)]),
    [first]
  )
  assert.deepEqual(projectCharacterChanges(null, []), [])
})

test('부위에 장비가 새로 생기거나 빠지면 그 부위의 교체로 나온다', () => {
  const equipment = bodies.equipment.equipment as Item[]
  const remaining = equipment.filter((item) => item.slotId !== 'SUPPORT')
  const withoutSupport = { ...bodies.equipment, equipment: remaining }

  const changes = projectCharacterChanges(firstAt, [
    row('equipment', firstAt, bodies.equipment),
    row('equipment', secondAt, withoutSupport),
    row('equipment', thirdAt, bodies.equipment)
  ])
  const support = equipment.find((item) => item.slotId === 'SUPPORT')
  const supportName = String(support?.itemName)
  const supportRarity = String(support?.itemRarity)
  const supportItem = { itemName: supportName, itemRarity: supportRarity }

  assert.deepEqual(
    changes.slice(1).map(({ items }) => items),
    [
      [
        {
          kind: 'equipment',
          slotId: 'SUPPORT',
          slotName: '보조장비',
          itemName: null,
          itemRarity: null,
          replaced: supportItem,
          fields: []
        }
      ],
      [
        {
          kind: 'equipment',
          slotId: 'SUPPORT',
          slotName: '보조장비',
          ...supportItem,
          replaced: null,
          fields: []
        }
      ]
    ]
  )
})

test('강화 수치가 같아도 증폭 속성이 생기면 증폭 한 줄로 나온다', () => {
  const amplified = equipmentWith((slotId, item) =>
    slotId === 'WEAPON' ? { ...item, amplificationName: '차원의 힘' } : item
  )

  const changes = projectCharacterChanges(firstAt, [
    row('equipment', firstAt, bodies.equipment),
    row('equipment', secondAt, amplified)
  ])
  const fields = changes[1]?.items.map((item) => (item.kind === 'equipment' ? item.fields : []))

  assert.deepEqual(fields, [[{ field: 'amplify', name: null, before: 10, after: 10 }]])
})

test('첫 기록 시각에 생긴 변경점은 그 시점을 첫 기록으로만 두고 줄을 내지 않는다', () => {
  const refined = equipmentWith((slotId, item) =>
    slotId === 'WEAPON' ? { ...item, refine: 1 } : item
  )

  const changes = projectCharacterChanges(secondAt, [
    row('equipment', firstAt, bodies.equipment),
    row('equipment', secondAt, refined)
  ])

  assert.deepEqual(changes, [{ observedAt: secondAt.toISOString(), first: true, items: [] }])
})
