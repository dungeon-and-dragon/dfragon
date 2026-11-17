import type {
  AdventureActivity,
  AdventureActivityDay,
  AdventureActivitySeasonDays
} from '#core/adventure-guild/adventure-activity'
import type { AdventureWeekly } from '#core/adventure-guild/adventure-weekly'
import type { Guild } from '#core/adventure-guild/adventure-guild'
import type { FavoriteCharacter } from '../../hooks/useFavoriteCharacterStore'
import { storyRankedCharacters } from './story-characters'

// 모험단, 길드, 캐릭터 이름과 활동 기록은 실제 값이 아닌 합성 값이다.

const DAY_MS = 24 * 60 * 60 * 1000
const SEASON_STARTS_AT = '2026-03-25T21:00:00.000Z'

export const STORY_ADVENTURE_NAME = '모험단1'
export const STORY_SEASON_ID = 11

const RAIDS = ['가 레이드', '나 레이드'] as const
const LEGION = '다 레기온'

function isoDate(at: number): string {
  return new Date(at).toISOString().slice(0, 10)
}

function seasonDates(): string[] {
  const first = Date.parse(SEASON_STARTS_AT) + DAY_MS
  const count = Math.floor((Date.now() - first) / DAY_MS) + 1

  return Array.from({ length: count }, (_, index) => isoDate(first + index * DAY_MS))
}

function amountOf(index: number, period: number, peak: number): number {
  const wave = (index * 7 + period) % 11

  if (wave < 4) {
    return 0
  }

  return Math.round(((wave - 3) / 7) * peak)
}

function dayActivity(date: string, index: number): AdventureActivity['days'][number] {
  return {
    date,
    raid: amountOf(index, 1, 6),
    legion: amountOf(index, 4, 3),
    item: amountOf(index, 2, 12),
    enhance: amountOf(index, 6, 20),
    primeval: index % 23 === 5,
    mythic: index % 41 === 17,
    highEnhancement: index % 19 === 7
  }
}

const dates = seasonDates()
const days = dates.map(dayActivity)

export const storyAdventureActivity: AdventureActivity = {
  seasons: [
    {
      id: 9,
      name: '합성 시즌 9',
      startsAt: '2023-09-13T21:00:00.000Z',
      available: false,
      backfill: { done: 18, total: 40, running: false }
    },
    { id: 10, name: '합성 시즌 10', startsAt: '2025-01-08T21:00:00.000Z', available: true },
    { id: STORY_SEASON_ID, name: '합성 시즌 11', startsAt: SEASON_STARTS_AT, available: true }
  ],
  season: {
    id: STORY_SEASON_ID,
    startsAt: SEASON_STARTS_AT,
    endsAt: null,
    timelineStartsAt: SEASON_STARTS_AT
  },
  summary: {
    raids: [
      { name: RAIDS[0], count: 412, hard: 120, normal: 292 },
      { name: RAIDS[1], count: 186 }
    ],
    legions: [{ name: LEGION, count: 204 }],
    items: { legendary: 312, epic: 48, primeval: 6, mythic: 2 },
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

function dayDetail(day: AdventureActivity['days'][number]): AdventureActivityDay {
  const at = (hour: number, minute: number) =>
    `${day.date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`

  const items: AdventureActivityDay['items'] = Array.from({ length: day.item }, (_, index) => {
    const itemAt = at(20, index * 3)

    return { at: itemAt, name: `합성 레전더리 ${index + 1}`, rarity: '레전더리' }
  })

  if (day.primeval) {
    items.unshift({ at: at(19, 12), name: '합성 태초', rarity: '태초' })
  }

  if (day.mythic) {
    items.unshift({ at: at(19, 40), name: '합성 신화', rarity: '신화' })
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

  return { date: day.date, raids, legions, items, enhancements }
}

const dayDetails = days.map(dayDetail)

export const storyAdventureSeasonDays: AdventureActivitySeasonDays = {
  season: STORY_SEASON_ID,
  days: dayDetails
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

export function storyGuild(memberCount: number): Guild {
  const guildMembers = storyRankedCharacters(memberCount).map((character) => ({
    ...character,
    guildId: 'guild-1',
    guildName: '길드1'
  }))
  const totalFame = guildMembers.reduce((total, { fame }) => total + (fame ?? 0), 0)
  const averageFame = memberCount > 0 ? Math.round(totalFame / memberCount) : null

  return { guildId: 'guild-1', guildName: '길드1', memberCount, averageFame, members: guildMembers }
}

export const storyFavoriteCharacters: FavoriteCharacter[] = storyRankedCharacters(6).map(
  (
    {
      serverId,
      characterId,
      characterName,
      adventureName,
      guildId,
      guildName,
      level,
      jobName,
      jobGrowName,
      fame,
      role
    },
    index
  ) => ({
    serverId,
    characterId,
    characterName,
    adventureName,
    guildId,
    guildName,
    level,
    jobName,
    jobGrowName,
    fame,
    role,
    savedAt: index
  })
)
