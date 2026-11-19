import type {
  AdventureActivity,
  AdventureActivityDay,
  AdventureActivitySeasonDays,
  AdventureWeekly
} from '#entities/adventure-guild'
import { storyRankedCharacters } from '#entities/ranking/api/ranked-characters.fixture'

// 모험단, 캐릭터 이름과 활동 기록은 실제 값이 아닌 합성 값이다.

const DAY_MS = 24 * 60 * 60 * 1000

export const STORY_ADVENTURE_NAME = '모험단1'
const STORY_SEASON_ID = 11

const BACKFILLING_SEASON: AdventureActivity['seasons'][number] = {
  id: 8,
  name: '합성 시즌 8',
  startsAt: '2022-01-12T21:00:00.000Z',
  available: false,
  backfill: { done: 18, total: 40, running: false }
}

const STORY_SEASONS = [
  { id: 9, name: '합성 시즌 9', startsAt: '2023-09-13T21:00:00.000Z' },
  { id: 10, name: '합성 시즌 10', startsAt: '2025-01-08T21:00:00.000Z' },
  { id: STORY_SEASON_ID, name: '합성 시즌 11', startsAt: '2026-03-25T21:00:00.000Z' }
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
    throw new Error(`합성 시즌 ${seasonId}이 없습니다.`)
  }

  const { startsAt } = STORY_SEASONS[index]!
  const endsAt = STORY_SEASONS[index + 1]?.startsAt ?? null
  const hasOaths = seasonId !== 9
  const seasons = [
    BACKFILLING_SEASON,
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
