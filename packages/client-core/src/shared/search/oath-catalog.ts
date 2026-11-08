import { z } from 'zod'
import type { ItemView } from '../../lib/character-item'
import { type GameTextLines, gameTextSchema } from './game-text'
import { itemRarityOf } from './character-detail-display'
import type { CharacterDetailView } from './character-detail-view'

const RARITY_FILES = ['rare', 'unique', 'legendary', 'epic', 'primitive'] as const

type RarityFile = (typeof RARITY_FILES)[number]

const optionSchema = z.object({
  name: z.string(),
  icon: z.string(),
  effects: z.record(z.enum(RARITY_FILES), gameTextSchema.nullable())
})

const setSchema = z.object({
  setId: z.number().int(),
  name: z.string(),
  icon: z.string().nullable(),
  options: z.array(optionSchema)
})

const itemSchema = z.object({
  name: z.string(),
  rarity: z.string(),
  icon: z.string()
})

export const oathCatalogSchema = z.object({
  version: z.string(),
  sets: z.array(setSchema),
  items: z.array(itemSchema)
})

export type OathCatalog = z.infer<typeof oathCatalogSchema>

type OathSetInfo = NonNullable<NonNullable<CharacterDetailView['oath']>['setInfo']>

export type OathOptionCard = Readonly<{
  name: string
  icon: string
  picked: boolean
  effect: GameTextLines | null
}>

export type OathSetBoard = Readonly<{
  icon: string | null
  options: readonly OathOptionCard[]
}>

const RARITY_FILE_BY_NAME: Readonly<Record<string, RarityFile>> = {
  레어: 'rare',
  유니크: 'unique',
  레전더리: 'legendary',
  에픽: 'epic',
  태초: 'primitive'
}

// setRarityName은 "레어 Ⅱ"처럼 등급 뒤에 단계가 붙기도 하므로 앞의 등급 이름으로 파일을 고른다.
function rarityFileOf(setRarityName: string | null): RarityFile | null {
  const rarityName = setRarityName?.split(' ')[0]
  if (rarityName === undefined) {
    return null
  }

  const rarityFile = RARITY_FILE_BY_NAME[rarityName]
  if (rarityFile === undefined) {
    return null
  }

  return rarityFile
}

export function oathSetBoardOf(catalog: OathCatalog, setInfo: OathSetInfo): OathSetBoard | null {
  const set = catalog.sets.find(({ setId }) => setId === setInfo.setId)
  if (set === undefined) {
    return null
  }
  const rarityFile = rarityFileOf(setInfo.setRarityName)
  const options = set.options.map(({ name, icon, effects }) => {
    const picked = name === setInfo.setOptionName
    const effect = rarityFile !== null ? effects[rarityFile] : null

    return { name, icon, picked, effect }
  })

  return { icon: set.icon, options }
}

// Neople의 서약 itemId는 게임 아이템 번호가 아니고, 영겁의 안개 서약처럼 등급마다 이름이 같은 서약이 있어 이름과 등급으로 찾는다.
export function oathItemIconOf(catalog: OathCatalog, item: ItemView): string | null {
  if (item.rarity === null) {
    return null
  }

  const found = catalog.items.find(
    ({ name, rarity }) => name === item.itemName && itemRarityOf(rarity) === item.rarity
  )
  if (found === undefined) {
    return null
  }

  return found.icon
}
