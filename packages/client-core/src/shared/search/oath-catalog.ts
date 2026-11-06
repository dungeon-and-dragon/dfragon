import { z } from 'zod'
import type { CharacterDetailView } from './character-detail-view'

const RARITY_FILES = ['rare', 'unique', 'legendary', 'epic', 'primitive'] as const

type RarityFile = (typeof RARITY_FILES)[number]

const optionSchema = z.object({
  name: z.string(),
  icon: z.string(),
  effects: z.record(z.enum(RARITY_FILES), z.string().nullable())
})

const setSchema = z.object({
  setId: z.number().int(),
  name: z.string(),
  icon: z.string().nullable(),
  options: z.array(optionSchema)
})

export const oathCatalogSchema = z.object({
  pvfSha256: z.string(),
  sets: z.array(setSchema)
})

export type OathCatalog = z.infer<typeof oathCatalogSchema>

type OathSetInfo = NonNullable<NonNullable<CharacterDetailView['oath']>['setInfo']>

export type OathOptionCard = Readonly<{
  name: string
  icon: string
  picked: boolean
  effect: string | null
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
