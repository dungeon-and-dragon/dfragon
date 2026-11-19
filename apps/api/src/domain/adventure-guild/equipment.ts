import type {
  CharacterTimelineItemRow,
  ItemDictionaryEntry,
  StoredCharacter,
  StoredSeason,
  TimelineCharacter
} from '@dfragon/database'
import { groupBy } from 'remeda'
import {
  EQUIPMENT_ACQUISITION_CODES,
  OATH_ACQUISITION_CODES
} from '@dfragon/server-core/domain/item-dictionary/index.js'
import { type CharacterRow, toCharacterRow } from '#domain/character-row.js'
import {
  isSeasonEquipment,
  readTranscendenceDirection,
  seasonEquipmentLevel
} from './season-equipment.js'

const HOLDING_RARITIES = ['레전더리', '에픽', '태초'] as const
const OATH_KINDS: ReadonlyMap<string | null, OathKind> = new Map([
  ['서약', 'oath'],
  ['서약결정', 'crystal']
])
const EQUIPMENT_CODES: ReadonlySet<number> = new Set(EQUIPMENT_ACQUISITION_CODES)
const OATH_CODES: ReadonlySet<number> = new Set(OATH_ACQUISITION_CODES)
const TRANSCENDENCE_CODES: ReadonlySet<number> = new Set([516, 556])
// 업그레이드(511), 제작서(514), 서약 업그레이드(553), 무기고(555)는 이미 가진 것을 바꾸거나 꺼낸 기록일 수 있어
// 개수를 더하지 않고 없던 칸만 1로 만든다(2026-11-19 저장소 소유자 결정, #1852).
const KEEP_CODES: ReadonlySet<number> = new Set([511, 514, 553, 555])
// 고유 장비는 Neople 사전에 세트가 없어 이름 앞의 "고유 - "로 가르고, 세트 하나처럼 묶는다(2026-11-19 저장소 소유자 결정).
// 이름에 "고유"가 없는 세트 없는 태초 장비는 묶지 않는다.
const UNIQUE_NAME_PREFIX = '고유 - '
const UNIQUE_SET: EquipmentSet = { setItemId: 'unique', setItemName: '고유' }

type HoldingRarity = (typeof HOLDING_RARITIES)[number]
type OathKind = 'oath' | 'crystal'

export type HoldingRecord = Pick<
  CharacterTimelineItemRow,
  'serverId' | 'characterId' | 'code' | 'itemId' | 'itemName' | 'data'
>

export type EquipmentHolding = {
  setItemId: string
  slot: string
  rarity: string
  itemId: string
  itemName: string
  count: number
}

export type OathHolding = {
  setItemId: string
  kind: OathKind
  rarity: string
  itemId: string
  itemName: string
  count: number
}

export type EquipmentSet = { setItemId: string; setItemName: string }

export type EquipmentCharacter = CharacterRow & {
  equipment: EquipmentHolding[]
  oaths: OathHolding[]
}

export type AdventureEquipment = {
  sets: EquipmentSet[]
  servers: { serverId: string; characters: EquipmentCharacter[] }[]
}

export type EquipmentWindow = { since: Date; equipmentLevel: number | undefined }

type HoldingCell =
  | { kind: 'equipment'; setItemId: string; slot: string; rarity: HoldingRarity }
  | { kind: OathKind; setItemId: string; rarity: HoldingRarity }

type CountedCell = {
  cell: HoldingCell
  setItemName: string
  itemId: string
  itemName: string
  count: number
}

function isHoldingRarity(rarity: string | null): rarity is HoldingRarity {
  return HOLDING_RARITIES.some((name) => name === rarity)
}

// 기록은 지금 시즌과 장비 레벨이 같은 시즌 가운데 가장 이른 시즌의 시작부터 읽는다.
export function toEquipmentWindow(
  seasons: readonly StoredSeason[],
  now: Date
): EquipmentWindow | undefined {
  const started = seasons.filter(({ startsAt }) => startsAt <= now)
  const current = started.at(-1)

  if (current === undefined) {
    return undefined
  }

  const equipmentLevel = seasonEquipmentLevel(current.id)
  const first =
    equipmentLevel !== undefined
      ? (started.find(({ id }) => seasonEquipmentLevel(id) === equipmentLevel) ?? current)
      : current

  return { since: first.startsAt, equipmentLevel }
}

function holdingSet(entry: ItemDictionaryEntry, itemName: string | null): EquipmentSet | undefined {
  const { setItemId, setItemName } = entry

  if (setItemId !== null && setItemName !== null) {
    return { setItemId, setItemName }
  }

  if (setItemId === null && itemName?.startsWith(UNIQUE_NAME_PREFIX)) {
    return UNIQUE_SET
  }

  return undefined
}

function toHoldingCell(
  code: number,
  entry: ItemDictionaryEntry,
  setItemId: string,
  equipmentLevel: number | undefined
): HoldingCell | undefined {
  const { itemRarity, itemTypeDetail, itemType } = entry

  if (!isHoldingRarity(itemRarity)) {
    return undefined
  }

  if (EQUIPMENT_CODES.has(code)) {
    const isEquipment =
      equipmentLevel !== undefined &&
      itemType !== '무기' &&
      isSeasonEquipment(entry, equipmentLevel)

    if (!isEquipment || itemTypeDetail === null) {
      return undefined
    }

    return { kind: 'equipment', setItemId, slot: itemTypeDetail, rarity: itemRarity }
  }

  const kind = OATH_KINDS.get(itemType)

  if (!OATH_CODES.has(code) || kind === undefined) {
    return undefined
  }

  return { kind, setItemId, rarity: itemRarity }
}

function cellPart(cell: HoldingCell): string {
  if (cell.kind === 'equipment') {
    return cell.slot
  }

  return cell.kind
}

function cellKey(cell: HoldingCell): string {
  return `${cell.setItemId}/${cellPart(cell)}/${cell.rarity}`
}

function countHoldings(
  records: readonly HoldingRecord[],
  dictionary: ReadonlyMap<string, ItemDictionaryEntry>,
  equipmentLevel: number | undefined
): CountedCell[] {
  const cells = new Map<string, CountedCell>()

  for (const { code, itemId, itemName, data } of records) {
    const entry = itemId !== null ? dictionary.get(itemId) : undefined
    const set = entry && holdingSet(entry, itemName)
    const cell = set && toHoldingCell(code, entry, set.setItemId, equipmentLevel)

    if (itemId === null || set === undefined || cell === undefined) {
      continue
    }

    const key = cellKey(cell)
    const counted = cells.get(key) ?? { cell, setItemName: '', itemId, itemName: '', count: 0 }
    const out = TRANSCENDENCE_CODES.has(code) && readTranscendenceDirection(data) === 'out'

    if (out) {
      counted.count--
    } else {
      counted.count = KEEP_CODES.has(code) ? Math.max(counted.count, 1) : counted.count + 1
      counted.itemId = itemId
      counted.itemName = itemName ?? ''
      counted.setItemName = set.setItemName
    }
    cells.set(key, counted)
  }

  return [...cells.values()].filter(({ count }) => count > 0)
}

function rarityRank(rarity: HoldingRarity): number {
  return HOLDING_RARITIES.indexOf(rarity)
}

function compareCells(a: CountedCell, b: CountedCell): number {
  const bySet = a.cell.setItemId.localeCompare(b.cell.setItemId)

  if (bySet !== 0) {
    return bySet
  }

  const byPart = cellPart(a.cell).localeCompare(cellPart(b.cell), 'ko')

  if (byPart !== 0) {
    return byPart
  }

  return rarityRank(a.cell.rarity) - rarityRank(b.cell.rarity)
}

function toCharacterHoldings(counted: readonly CountedCell[]) {
  const equipment: EquipmentHolding[] = []
  const oaths: OathHolding[] = []

  for (const { cell, itemId, itemName, count } of counted.toSorted(compareCells)) {
    if (cell.kind === 'equipment') {
      const { setItemId, slot, rarity } = cell
      equipment.push({ setItemId, slot, rarity, itemId, itemName, count })
    } else {
      const { setItemId, kind, rarity } = cell
      oaths.push({ setItemId, kind, rarity, itemId, itemName, count })
    }
  }

  return { equipment, oaths }
}

function characterKey({ serverId, characterId }: TimelineCharacter): string {
  return `${serverId}/${characterId}`
}

// records는 캐릭터마다 시간순이어야 한다. 같은 칸의 획득과 초월을 기록 순서대로 더하고 뺀다.
export function toAdventureEquipment(
  characters: readonly StoredCharacter[],
  records: readonly HoldingRecord[],
  dictionary: ReadonlyMap<string, ItemDictionaryEntry>,
  equipmentLevel: number | undefined
): AdventureEquipment {
  const recordsByCharacter = groupBy(records, characterKey)
  const sets = new Map<string, string>()
  const servers = new Map<string, EquipmentCharacter[]>()

  for (const character of characters) {
    const counted = countHoldings(
      recordsByCharacter[characterKey(character)] ?? [],
      dictionary,
      equipmentLevel
    )

    for (const { cell, setItemName } of counted) {
      if (!sets.has(cell.setItemId)) {
        sets.set(cell.setItemId, setItemName)
      }
    }

    const serverCharacters = servers.get(character.serverId) ?? []
    const row = toCharacterRow(character)
    const holdings = toCharacterHoldings(counted)

    serverCharacters.push({ ...row, ...holdings })
    servers.set(character.serverId, serverCharacters)
  }

  const setList = [...sets]
    .map(([setItemId, setItemName]) => ({ setItemId, setItemName }))
    .sort((a, b) => a.setItemName.localeCompare(b.setItemName, 'ko'))
  const serverList = [...servers].map(([serverId, serverCharacters]) => ({
    serverId,
    characters: serverCharacters
  }))

  return { sets: setList, servers: serverList }
}
