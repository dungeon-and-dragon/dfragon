import { z } from 'zod'
import {
  apiCharacterCardSchema,
  characterIdentitySchema
} from '../../preload/common/search/character-summary'

// API는 Neople의 시즌별 중첩 옵션을 고정 schema로 막지 않으므로, 상세 화면은 칸이 없거나 형태가 달라도 빈 값으로 읽는다.
const text = z.string().nullable().catch(null)
const count = z.number().nullable().catch(null)
const statValue = z.union([z.number(), z.string()]).nullable().catch(null)

function list<Item extends z.ZodType>(item: Item) {
  return z.array(item).catch([])
}

function section<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object(shape).nullable().catch(null)
}

// API가 직접 만드는 묶음은 늘 객체로 오므로, 통째로 없으면 null 대신 안쪽 칸이 모두 빈 값인 묶음으로 둔다.
function group<Shape extends z.ZodRawShape>(shape: Shape) {
  const schema = z.object(shape)

  return schema.catch(() => schema.parse({}))
}

const namedStat = z.object({ name: text, value: statValue })
const keyedStat = z.object({ key: text, value: statValue })
const setPoint = section({ current: count, min: count, max: count })
const itemShape = { itemId: text, itemName: text, itemRarity: text }

const equipmentItem = z.object({
  slotId: text,
  slotName: text,
  ...itemShape,
  reinforce: count,
  amplificationName: text,
  refine: count,
  tune: list(z.object({ level: count, setPoint: count })),
  enchant: section({
    status: list(namedStat),
    reinforceSkill: list(z.object({ skills: list(z.object({ name: text, value: count })) }))
  }),
  exaltedInfo: section({ explain: text }),
  potency: section({ value: statValue })
})

const setItem = z.object({
  setItemId: text,
  setItemName: text,
  setItemRarityName: text,
  active: section({ setPoint, status: list(namedStat) })
})

const avatarItem = z.object({
  slotId: text,
  slotName: text,
  ...itemShape,
  optionAbility: text,
  emblems: list(z.object({ slotNo: count, slotColor: text, ...itemShape })),
  clone: section({ itemId: text, itemName: text })
})

const skill = z.object({ skillId: text, name: text, level: count, requiredLevel: count })
const skillUpgrade = z.object({ skillId: text, type: count })

const buffSkillInfo = section({
  skillId: text,
  name: text,
  option: section({ level: count, desc: text, values: list(text) })
})

export const characterDetailViewSchema = z.object({
  character: characterIdentitySchema.extend({
    characterName: text,
    serverName: text,
    level: count,
    jobName: text,
    jobGrowName: text,
    fame: count,
    adventureName: text,
    guildName: text
  }),
  card: apiCharacterCardSchema.nullable().catch(null),
  equipment: group({ equipment: list(equipmentItem), setItemInfo: list(setItem) }),
  creature: section({
    ...itemShape,
    artifact: list(z.object({ slotColor: text, ...itemShape }))
  }),
  avatar: list(avatarItem),
  mistAssimilation: section({ level: count, expRate: text, status: list(namedStat) }),
  oath: section({
    info: section({
      ...itemShape,
      setPoint: count,
      oathUpgrade: section({
        status: list(keyedStat),
        options: list(z.object({ stepName: text, optionName: text, status: list(keyedStat) }))
      })
    }),
    crystal: list(
      z.object({ slotNo: count, ...itemShape, tune: section({ level: count, setPoint: count }) })
    ),
    blessing: section({ status: list(keyedStat) }),
    setInfo: section({
      setName: text,
      setOptionName: text,
      setRarityName: text,
      active: section({ setPoint, status: list(keyedStat) })
    })
  }),
  skillStyle: section({
    style: section({
      active: list(skill),
      passive: list(skill),
      evolution: list(skillUpgrade),
      enhancement: list(skillUpgrade)
    })
  }),
  buff: group({
    equipment: section({ skillInfo: buffSkillInfo, equipment: list(equipmentItem) }),
    avatar: section({ skillInfo: buffSkillInfo, avatar: list(avatarItem) }),
    creature: section({ skillInfo: buffSkillInfo, creature: list(z.object(itemShape)) })
  }),
  status: group({
    status: list(namedStat),
    buff: list(z.object({ name: text, level: count, status: list(namedStat) }))
  })
})

export type CharacterDetailView = z.infer<typeof characterDetailViewSchema>
