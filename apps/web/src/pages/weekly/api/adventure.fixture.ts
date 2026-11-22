import {
  type AdventureActivity,
  type AdventureActivityDay,
  type AdventureActivitySeasonDays,
  type AdventureEquipment,
  type AdventureTimelineItem,
  type AdventureTimelinePage,
  type AdventureWeekly,
  EQUIPMENT_SLOTS,
  type EquipmentCharacter,
  type EquipmentSlot
} from '#entities/adventure-guild'
import { storyRankedCharacters } from '#entities/ranking/api/ranked-characters.fixture'

// 모험단, 캐릭터 이름과 활동 기록은 실제 값이 아닌 합성 값이다.

const DAY_MS = 24 * 60 * 60 * 1000

export const STORY_ADVENTURE_NAME = '모험단1'
const STORY_SEASON_ID = 11

// 시즌 번호, 이름, 시작 시각은 운영 DB seasons 표의 실제 값이다(시작은 목요일 06:00 KST). 중천(시즌 10) 이전 시즌은
// 모험단마다 받아야 보이므로, 마계~귀환은 아직 받지 않은 시즌, THE NEXT JOURNEY는 받는 중인 시즌으로 둔다.
const UNCOLLECTED_SEASONS: AdventureActivity['seasons'] = [
  { id: 5, name: '마계', startsAt: '2016-08-31T21:00:00.000Z', available: false },
  { id: 6, name: '할렘', startsAt: '2018-08-08T21:00:00.000Z', available: false },
  { id: 7, name: '귀환', startsAt: '2020-01-08T21:00:00.000Z', available: false },
  {
    id: 8,
    name: 'THE NEXT JOURNEY',
    startsAt: '2022-03-16T21:00:00.000Z',
    available: false,
    backfill: { done: 18, total: 40, running: false }
  }
]

const STORY_SEASONS = [
  { id: 9, name: '선계', startsAt: '2023-09-13T21:00:00.000Z' },
  { id: 10, name: '중천', startsAt: '2025-01-08T21:00:00.000Z' },
  { id: STORY_SEASON_ID, name: '천해천', startsAt: '2026-03-25T21:00:00.000Z' }
] as const

const RAIDS = ['가 레이드', '나 레이드'] as const
const LEGION = '다 레기온'

function isoDate(at: number): string {
  return new Date(at).toISOString().slice(0, 10)
}

function seasonDates(startsAt: string, endsAt: string | null): string[] {
  const first = Date.parse(startsAt) + DAY_MS
  const last = endsAt === null ? Date.now() : Date.parse(endsAt)
  const count = Math.floor((last - first) / DAY_MS) + 1

  return Array.from({ length: count }, (_, index) => isoDate(first + index * DAY_MS))
}

function amountOf(index: number, period: number, peak: number): number {
  const wave = (index * 7 + period) % 11

  if (wave < 4) {
    return 0
  }

  return Math.round(((wave - 3) / 7) * peak)
}

function dayActivity(
  date: string,
  index: number,
  hasOaths: boolean
): AdventureActivity['days'][number] {
  const mythic = !hasOaths && index % 41 === 17
  const oath = hasOaths ? amountOf(index, 8, 4) : 0
  const oathPrimeval = hasOaths && index % 29 === 11

  return {
    date,
    raid: amountOf(index, 1, 6),
    legion: amountOf(index, 4, 3),
    item: amountOf(index, 2, 12),
    enhance: amountOf(index, 6, 20),
    primeval: index % 23 === 5,
    mythic,
    highEnhancement: index % 19 === 7,
    oath,
    oathPrimeval
  }
}

const NO_OATHS = { legendary: 0, epic: 0, primeval: 0 }

export function storyAdventureActivity(
  seasonId: number | undefined = STORY_SEASON_ID
): AdventureActivity {
  const index = STORY_SEASONS.findIndex(({ id }) => id === seasonId)

  if (index < 0) {
    throw new Error(`시즌 ${seasonId}이 없습니다.`)
  }

  const { startsAt } = STORY_SEASONS[index]!
  const endsAt = STORY_SEASONS[index + 1]?.startsAt ?? null
  const hasOaths = seasonId !== 9
  const seasons = [
    ...UNCOLLECTED_SEASONS,
    ...STORY_SEASONS.map((season) => ({ ...season, available: true }))
  ]
  const mythic = hasOaths ? 0 : 2
  const oaths = hasOaths ? { legendary: 27, epic: 9, primeval: 1 } : NO_OATHS
  const days = seasonDates(startsAt, endsAt).map((date, dayIndex) =>
    dayActivity(date, dayIndex, hasOaths)
  )

  return {
    seasons,
    season: { id: seasonId, startsAt, endsAt, timelineStartsAt: startsAt },
    summary: {
      raids: [
        { name: RAIDS[0], count: 412, hard: 120, normal: 292 },
        { name: RAIDS[1], count: 186 }
      ],
      legions: [{ name: LEGION, count: 204 }],
      items: { legendary: 312, epic: 48, primeval: 6, mythic },
      oaths,
      enhancement: {
        attempts: 1826,
        amplify: [
          { target: 12, attempts: 14, successes: 3 },
          { target: 11, attempts: 22, successes: 9 }
        ],
        reinforce: [{ target: 12, attempts: 8, successes: 2 }],
        amplifyBelow10: 1420,
        reinforceBelow12: 312,
        refine: 50
      }
    },
    days
  }
}

function dayDetail(day: AdventureActivity['days'][number]): AdventureActivityDay {
  const at = (hour: number, minute: number) =>
    `${day.date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`

  const items: AdventureActivityDay['items'] = Array.from({ length: day.item }, (_, index) => {
    const itemAt = at(20, index * 3)

    return { at: itemAt, name: `합성 레전더리 ${index + 1}`, rarity: '레전더리' }
  })

  if (day.primeval) {
    const primevalAt = at(19, 12)
    items.unshift({ at: primevalAt, name: '합성 태초', rarity: '태초' })
  }

  if (day.mythic) {
    const mythicAt = at(19, 40)
    items.unshift({ at: mythicAt, name: '합성 신화', rarity: '신화' })
  }

  const oaths: AdventureActivityDay['oaths'] = Array.from({ length: day.oath }, (_, index) => {
    const oathAt = at(21, 40 + index * 2)

    return { at: oathAt, name: `합성 서약 ${index + 1}`, rarity: '레전더리' }
  })

  if (day.oathPrimeval) {
    const oathPrimevalAt = at(21, 30)
    oaths.unshift({ at: oathPrimevalAt, name: '합성 태초 서약', rarity: '태초' })
  }

  const raids = [{ name: RAIDS[day.raid % 2]!, count: day.raid }].filter(({ count }) => count > 0)
  const legions = [{ name: LEGION, count: day.legion }].filter(({ count }) => count > 0)
  const enhancements: AdventureActivityDay['enhancements'] = Array.from(
    { length: day.enhance },
    (_, index) => {
      const enhancementAt = at(22, index * 2)
      const kind = (['reinforce', 'amplify', 'refine'] as const)[index % 3]!
      const target = 10 + (index % 3)
      const success = index % 4 === 0

      return { at: enhancementAt, kind, target, success }
    }
  )

  return { date: day.date, raids, legions, items, oaths, enhancements }
}

export function storyAdventureSeasonDays(seasonId: number): AdventureActivitySeasonDays {
  const { days } = storyAdventureActivity(seasonId)
  const details = days.map(dayDetail)

  return { season: seasonId, days: details }
}

const members = storyRankedCharacters(8).map((character) => ({
  ...character,
  adventureName: STORY_ADVENTURE_NAME
}))

const weeklyCharacters: AdventureWeekly['characters'] = members.map((character, index) => {
  const firstRaid = index % 3 !== 2 ? [{ kind: 'raid' as const, name: RAIDS[0] }] : []
  const secondRaid = index % 2 === 0 ? [{ kind: 'raid' as const, name: RAIDS[1] }] : []
  const legion = index < 5 ? [{ kind: 'legion' as const, name: LEGION }] : []
  const weeklyClears = [...firstRaid, ...secondRaid, ...legion]

  return { ...character, weeklyClears }
})

export const storyAdventureWeekly: AdventureWeekly = {
  adventureName: STORY_ADVENTURE_NAME,
  clearNames: [
    { kind: 'raid', name: RAIDS[0] },
    { kind: 'raid', name: RAIDS[1] },
    { kind: 'legion', name: LEGION }
  ],
  characters: weeklyCharacters
}

// 세트, 아이템 id와 이름은 게임 데이터 그대로다. 이 표에 없는 등급은 그림이 없는 합성 id를 쓴다.
const STORY_SET_ITEMS = {
  '4ee7bd5912cda6e2a24c1f36d5202b46': {
    name: '소울 페어리 세트',
    items: {
      상의: ['11f55a9437e514d46ee55c8a8ae82b7e', '긍휼 속 자비의 상의'],
      머리어깨: ['2d81feba3c9977d5ffa32fd378785bf0', '숭고한 심판의 어깨'],
      하의: ['607ee0da46bf24a4b211bff52f3c05f1', '명예로운 공경의 하의'],
      신발: ['e6360b073291b20bd81c830fe5b52962', '고요한 안식의 신발'],
      벨트: ['20c367fa5eaccbaa7b9fe372d4b94170', '완전한 침묵의 벨트'],
      목걸이: ['f774b185f71d9f5e7a712aa842e8ebba', '성스러운 믿음의 목걸이'],
      팔찌: ['1d102027205b181ec94bd03581f30fe6', '드러난 진실의 팔찌'],
      반지: ['f8f5673ee549e8de296b3c2ba1593ca4', '거룩한 희생의 반지'],
      보조장비: ['819d0bd846c913248d30c8b1e4e53755', '초연한 청렴의 보조장비'],
      마법석: ['b797e5b10819d9edb772d6cc69f7561d', '무결한 순수의 마법석'],
      귀걸이: ['523be2dc115d046a3ce5ab76f5e1e42b', '강인한 절제의 귀걸이']
    }
  },
  '7f788a703a87d783079b41d0fe6448c9': {
    name: '영원히 이어지는 황금향 세트',
    items: {
      상의: ['847ec8e923e46351dc2c747cd121b7f0', '긍휼 속 자비의 상의'],
      머리어깨: ['c4de6c27c8c1cce1474341a170f06351', '숭고한 심판의 어깨'],
      하의: ['2eee49706bce42e0bd022b9a86e7e3c9', '명예로운 공경의 하의'],
      신발: ['3dc40d93e54a55bb1e13a4a2633c6efb', '고요한 안식의 신발'],
      벨트: ['ed24b65d57244bbbde424696bb46e59a', '완전한 침묵의 벨트'],
      목걸이: ['d844d52f4ddec5d044d17daf5ed3e803', '흑아 : 영롱한 황금향의 축복 - 목걸이'],
      팔찌: ['733d2c61423065cb0780674cc806ca3c', '흑아 : 영롱한 황금향의 영광 - 팔찌'],
      반지: ['51b04adc93626218e1aa26bb78b9c7e6', '흑아 : 영롱한 황금향의 꿈 - 반지'],
      마법석: ['0cf2f211de3751d2e4ee971b7b29802b', '무결한 순수의 마법석'],
      귀걸이: ['039af53f45fb9d16c597db9b47461c76', '강인한 절제의 귀걸이']
    }
  },
  '11f7d203a05ea6f13300c0facb39f11e': {
    name: '칠흑의 정화 세트',
    items: {
      상의: ['8620ea36303db8fe485762e3e1b56883', '때 묻지 않은 정화 상의'],
      머리어깨: ['2444288a5ba59fe11dacd68b811ffc18', '때 묻지 않은 정화 어깨'],
      하의: ['5a4809553cd2957bc784cae0cfb5799d', '때 묻지 않은 정화 하의'],
      벨트: ['b7062a0ba2ddd8dc5d8d481ae764c944', '때 묻지 않은 정화 벨트'],
      목걸이: ['634efedb77439c30128b6560278281f8', '혼돈의 정화 목걸이'],
      팔찌: ['7893424d65044032b098b8ac7e07f673', '타버린 정화 팔찌'],
      반지: ['854d52a64fe061dc2586a10bf274676b', '칠흑의 정화 반지'],
      보조장비: ['c1a6496d2b9817e6cd88f6c1dbdcb115', '타버린 정화 보조장비'],
      마법석: ['1ec42a6c4087627c396daa257475ed5c', '칠흑의 정화 마법석']
    }
  },
  '93e7825053bdec4e0f4c12837cf4f57e': {
    name: '에테리얼 오브 아츠 세트',
    items: {
      상의: ['b18e7187087ec03a300e22d171e83ce4', '수습 여우의 상의'],
      머리어깨: ['4e13a0e608282e52bfd188532a7bf8b4', '수습 여우의 보호 어깨'],
      목걸이: ['e468101e457344d9824a0f1588152f06', '대 여우의 영혼 목걸이'],
      보조장비: ['dd267f29006748266a62a816b5b05d48', '수습 여우의 숨결 부적 보조장비'],
      마법석: ['9623d7f5197b40a96dffd78c65d57287', '고위 여우의 구슬 마법석'],
      귀걸이: ['3c72626a0afb037b8b2b1f226eca6176', '고위 여우의 속삭임 귀걸이']
    }
  },
  // 줄임말 표에 없는 세트도 칩에 나오는지 보려고 둔 합성 세트다.
  'story-unlisted-set': { name: '합성 이야기 세트', items: {} }
} as const satisfies Record<
  string,
  { name: string; items: Partial<Record<EquipmentSlot, readonly [string, string]>> }
>

type StorySetId = keyof typeof STORY_SET_ITEMS
type StoryHolding = EquipmentCharacter['equipment'][number]
type StoryOath = EquipmentCharacter['oaths'][number]

const STORY_RARITIES = ['태초', '에픽', '레전더리'] as const
const STORY_OATH_NAMES = {
  태초: '태초로 인도하는 서약',
  에픽: '안내하는 서약',
  레전더리: '손짓하는 서약'
} as const

function storyHolding(setItemId: StorySetId, slot: EquipmentSlot, seed: number): StoryHolding[] {
  const items: Partial<Record<EquipmentSlot, readonly [string, string]>> =
    STORY_SET_ITEMS[setItemId].items
  const item = items[slot]
  const rarity = STORY_RARITIES[seed % 4]

  if (rarity === undefined) {
    return []
  }

  const [itemId, itemName] = item ?? [`story-${setItemId}-${slot}`, `합성 ${slot}`]
  const holding = { setItemId, slot, rarity, itemId, itemName, count: 1 }

  // 다섯 번째 칸마다 아래 등급을 하나 더 가져 "+N"을 보인다.
  if (seed % 5 === 0 && rarity === '태초') {
    return [holding, { ...holding, rarity: '에픽', count: 2 }]
  }

  return [holding]
}

function storyOaths(setItemId: StorySetId, seed: number): StoryOath[] {
  const rarity = STORY_RARITIES[seed % 4]

  if (rarity === undefined) {
    return []
  }

  const oath: StoryOath = {
    setItemId,
    kind: 'oath',
    rarity,
    itemId: `story-oath-${setItemId}`,
    itemName: STORY_OATH_NAMES[rarity],
    count: 1
  }
  const crystals = STORY_RARITIES.map((crystalRarity, index) => {
    const count = (seed + index * 3) % 7

    return {
      setItemId,
      kind: 'crystal' as const,
      rarity: crystalRarity,
      itemId: `story-crystal-${setItemId}-${index}`,
      itemName: `합성 ${crystalRarity} 결정`,
      count
    }
  }).filter(({ count }) => count > 0)

  return [oath, ...crystals]
}

function storyEquipmentCharacter(
  index: number,
  serverId: EquipmentCharacter['serverId'],
  setIds: readonly StorySetId[]
): EquipmentCharacter {
  const base = weeklyCharacters[index % weeklyCharacters.length]!
  const { weeklyClears: _weeklyClears, ...character } = base
  const empty = index === 3
  const equipment = empty
    ? []
    : setIds.flatMap((setItemId, setIndex) =>
        EQUIPMENT_SLOTS.flatMap((slot, slotIndex) =>
          storyHolding(setItemId, slot, index + slotIndex * 3 + setIndex)
        )
      )
  const oaths = empty
    ? []
    : setIds.flatMap((setItemId, setIndex) => storyOaths(setItemId, index + setIndex))
  const fame = 90000 - index * 1500

  return {
    ...character,
    serverId,
    characterId: `story-equipment-${index}`,
    characterName: `캐릭터${index + 1}`,
    fame,
    equipment,
    oaths
  }
}

const STORY_MAIN_SETS: readonly StorySetId[] = [
  '4ee7bd5912cda6e2a24c1f36d5202b46',
  '7f788a703a87d783079b41d0fe6448c9',
  '11f7d203a05ea6f13300c0facb39f11e'
]

// API가 세트 순서 표대로 정렬해 주는 순서다.
const STORY_SET_ORDER: readonly StorySetId[] = [
  '7f788a703a87d783079b41d0fe6448c9',
  '11f7d203a05ea6f13300c0facb39f11e',
  '4ee7bd5912cda6e2a24c1f36d5202b46',
  '93e7825053bdec4e0f4c12837cf4f57e',
  'story-unlisted-set'
]

const storyEquipmentSets = STORY_SET_ORDER.map((setItemId) => ({
  setItemId,
  setItemName: STORY_SET_ITEMS[setItemId].name
}))
const storyCainCharacters = [0, 1, 2, 3, 4, 5].map((index) =>
  storyEquipmentCharacter(index, 'cain', STORY_MAIN_SETS)
)
const storySirocoCharacters = [6, 7].map((index) =>
  storyEquipmentCharacter(index, 'siroco', [
    '93e7825053bdec4e0f4c12837cf4f57e',
    'story-unlisted-set'
  ])
)

const storyEquipmentServers = [
  { serverId: 'cain', characters: storyCainCharacters },
  { serverId: 'siroco', characters: storySirocoCharacters }
]

function onlySet(character: EquipmentCharacter, setItemId: string): EquipmentCharacter {
  const equipment = character.equipment.filter((holding) => holding.setItemId === setItemId)
  const oaths = character.oaths.filter((holding) => holding.setItemId === setItemId)

  return { ...character, equipment, oaths }
}

// API처럼 없거나 모르는 서버, 세트는 첫 서버와 첫 세트로 고르고, 고른 서버, 세트의 보유만 담는다.
export function storyAdventureEquipment(
  server: string | null,
  set: string | null
): AdventureEquipment {
  const serverId =
    storyEquipmentServers.find((candidate) => candidate.serverId === server)?.serverId ?? 'cain'
  const setItemId =
    storyEquipmentSets.find((candidate) => candidate.setItemId === set)?.setItemId ??
    STORY_SET_ORDER[0]!
  const servers = storyEquipmentServers.map((candidate) => {
    if (candidate.serverId !== serverId) {
      return { serverId: candidate.serverId, characters: [] }
    }

    const characters = candidate.characters.map((character) => onlySet(character, setItemId))

    return { serverId: candidate.serverId, characters }
  })

  return {
    adventureName: STORY_ADVENTURE_NAME,
    sets: storyEquipmentSets,
    servers,
    selected: { serverId, setItemId }
  }
}

export const storyEmptyAdventureEquipment: AdventureEquipment = {
  adventureName: STORY_ADVENTURE_NAME,
  sets: [],
  servers: [],
  selected: null
}

const STORY_TIMELINE_NOW = Date.parse('2026-11-20T21:00:00+09:00')
const storyTimelineCharacters = [
  { serverId: 'cain', characterId: 'story-timeline-1', characterName: '타임라인검사' },
  { serverId: 'siroco', characterId: 'story-timeline-2', characterName: '타임라인마법사' }
] as const

function storyTimelineAt(minutesAgo: number): string {
  return new Date(STORY_TIMELINE_NOW - minutesAgo * 60 * 1000).toISOString()
}

const storyTimelineItems: AdventureTimelineItem[] = [
  {
    ...storyTimelineCharacters[0],
    type: 'enhancement',
    kind: 'reinforce',
    itemId: null,
    itemName: '합성 대검',
    itemRarity: '태초',
    before: 11,
    after: 12,
    result: true,
    safe: false,
    occurredAt: storyTimelineAt(3)
  },
  {
    ...storyTimelineCharacters[1],
    type: 'acquisition',
    code: 505,
    name: '아이템 획득(레이드 카드 보상)',
    itemId: null,
    itemName: '합성 상의',
    itemRarity: '태초',
    occurredAt: storyTimelineAt(70)
  },
  {
    ...storyTimelineCharacters[1],
    type: 'enhancement',
    kind: 'amplify',
    itemId: null,
    itemName: '합성 반지',
    itemRarity: '에픽',
    before: 10,
    after: 11,
    result: false,
    safe: true,
    occurredAt: storyTimelineAt(95)
  },
  {
    ...storyTimelineCharacters[0],
    type: 'clear',
    kind: 'raid',
    name: '합성 레이드',
    modeName: '합성 단계',
    hard: true,
    occurredAt: storyTimelineAt(600)
  },
  {
    ...storyTimelineCharacters[0],
    type: 'acquisition',
    code: 550,
    name: '서약 획득(던전 드랍)',
    itemId: null,
    itemName: '합성 서약',
    itemRarity: '에픽',
    occurredAt: storyTimelineAt(1500)
  }
]

export function storyAdventureTimeline(kind: string | null): AdventureTimelinePage {
  const items = storyTimelineItems.filter((item) => kind === null || item.type === kind)

  return { items, nextCursor: null }
}
