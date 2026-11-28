import type {
  ClearContent,
  ClearContentStats,
  ClearFameDistribution,
  ClearJob,
  ClearOverview,
  ClearStats,
  ClearWeek,
  ClearWeekMove
} from '#entities/ranking'

// 클리어 화면 story의 합성 집계다. 전직 이름과 수는 실제 값이 아니다.

const DAY = 24 * 60 * 60 * 1000
const LATEST_WEEK = '2026-11-12'
const WEEK_COUNT = 16
const RAID_RELEASE = '2026-08-05T21:00:00.000Z'

function weekStartBefore(weeks: number): string {
  return new Date(Date.parse(`${LATEST_WEEK}T00:00:00Z`) - weeks * 7 * DAY)
    .toISOString()
    .slice(0, 10)
}

function week(weekStart: string, cleared: number, population: number): ClearWeek {
  const unscaledCleared = Math.round(cleared * 0.8)
  const scaledCleared = Math.round(cleared * 0.2)

  return {
    weekStart,
    closed: weekStart !== LATEST_WEEK,
    population,
    minFame: 104292,
    cleared,
    newlyCleared: null,
    ratios: [
      { ratio: null, cleared: unscaledCleared },
      { ratio: 50, cleared: scaledCleared }
    ]
  }
}

function weeksOf(clearedOf: (index: number) => number, length = WEEK_COUNT): ClearWeek[] {
  return Array.from({ length }, (_, index) =>
    week(weekStartBefore(length - 1 - index), clearedOf(index), 12000 + index * 150)
  )
}

function content(
  id: string,
  kind: ClearContent['kind'],
  name: string,
  releasedAt: string,
  weeks: ClearWeek[]
): ClearContent {
  return { id, kind, name, releasedAt, entryFame: 104292, latest: true, weeks }
}

export const storyClearStats: ClearStats = {
  contents: [
    content(
      'nabel-hard',
      'raid',
      '만들어진 신 나벨 (하드)',
      '2025-04-16T21:00:00.000Z',
      weeksOf((index) => 1800 - index * 40)
    ),
    content(
      'inae-twilight',
      'raid',
      '이내 황혼전',
      '2025-08-20T21:00:00.000Z',
      weeksOf((index) => 2600 + (index % 3) * 70)
    ),
    content(
      'michaela-normal',
      'raid',
      '무너진 성자 미카엘라 (일반)',
      RAID_RELEASE,
      weeksOf((index) => 3100 + index * 90)
    ),
    content(
      'michaela-hard',
      'raid',
      '무너진 성자 미카엘라 (하드)',
      RAID_RELEASE,
      weeksOf((index) => 700 + index * 55 - (index === WEEK_COUNT - 1 ? 120 : 0))
    ),
    content(
      'engraved-nightmare-1',
      'challenge',
      '각인된 악몽 "죽음을 딛고 선 자"',
      '2026-11-04T21:00:00.000Z',
      weeksOf((index) => 240 + index * 60, 2)
    )
  ],
  legions: [
    {
      id: 'legion-apocalypse',
      kind: 'legion',
      name: '아포칼립스',
      releasedAt: '2026-04-22T21:00:00.000Z',
      entryFame: null,
      latest: true,
      weeks: weeksOf((index) => 6400 + index * 30).map((item) => ({
        ...item,
        ratios: [{ ratio: null, cleared: item.cleared }]
      }))
    }
  ]
}

function spread(median: number, width: number): ClearFameDistribution {
  return {
    p5: median - width * 2,
    p25: median - width,
    median,
    p75: median + width,
    p95: median + width * 2,
    max: median + width * 3
  }
}

const equipmentScores = spread(3_300_000, 300_000)
const buffScores = spread(1_500_000, 200_000)
const scores = { equipment: equipmentScores, buff: buffScores }

function job(index: number): ClearJob {
  const fame = spread(118000 + index * 600, 4000)
  const equipment = spread(3_000_000 + index * 40_000, 300_000)

  return {
    jobId: `job-${index}`,
    jobGrowId: `grow-${index}`,
    jobName: `직업${index + 1}`,
    jobGrowName: `眞 전직${index + 1}`,
    population: 300 + ((index * 37) % 200),
    cleared: 40 + ((index * 53) % 120),
    fame,
    scores: { equipment, buff: null }
  }
}

const jobs = Array.from({ length: 24 }, (_, index) => job(index))

const weekdays = [4, 5, 6, 7, 1, 2, 3].map((weekday, index) => ({
  weekday,
  cleared: [620, 380, 540, 710, 260, 210, 190][index] ?? 0
}))

const hours = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  cleared: 40 + ((hour * 29) % 90)
}))

function overviewContent(id: string, cleared: number, median: number) {
  const fame = spread(median, 4000)

  return { id, cleared, fame, scores, jobs: [] }
}

export function storyClearOverview(weekStart: string): ClearOverview {
  const michaelaHard = overviewContent('michaela-hard', 1450, 126000)

  return {
    weekStart,
    contents: [
      {
        ...michaelaHard,
        jobs
      },
      overviewContent('michaela-normal', 4400, 119000),
      overviewContent('inae-twilight', 2700, 115000),
      overviewContent('nabel-hard', 1200, 121000)
    ],
    weekdays,
    hours
  }
}

const adventures = [
  { characters: 1, adventures: 820 },
  { characters: 2, adventures: 410 },
  { characters: 3, adventures: 260 },
  { characters: 4, adventures: 150 },
  { characters: 5, adventures: 90 },
  { characters: 8, adventures: 40 },
  { characters: 12, adventures: 12 },
  { characters: 16, adventures: 10 },
  { characters: 18, adventures: 7 },
  { characters: 20, adventures: 9 },
  { characters: 24, adventures: 6 },
  { characters: 28, adventures: 4 },
  { characters: 36, adventures: 3 },
  { characters: 44, adventures: 2 },
  { characters: 120, adventures: 1 }
]

function weekGroup(cleared: number, median: number) {
  const fame = spread(median, 4000)

  return { cleared, fame, scores }
}

const bothGroup = weekGroup(980, 124000)
const returnedGroup = weekGroup(130, 120000)
const leftGroup = weekGroup(210, 118000)
const firstGroup = weekGroup(160, 116000)

export function storyClearContentStats(contentId: string, weekStart: string): ClearContentStats {
  const found = [...storyClearStats.contents, ...storyClearStats.legions].find(
    ({ id }) => id === contentId
  )
  if (found === undefined) {
    throw new Error(`story에 없는 컨텐츠입니다: ${contentId}`)
  }

  const { weeks, ...header } = found
  const weekly = header.kind !== 'challenge'
  const selected = weeks.find((item) => item.weekStart === weekStart) ?? null
  const weekOverWeek = weekly
    ? {
        both: bothGroup,
        returned: returnedGroup,
        left: leftGroup,
        first: firstGroup
      }
    : null

  const weekMoves: ClearWeekMove[] | null = contentId.startsWith('michaela')
    ? [
        { from: 'hard', to: 'hard', characters: 1100 },
        { from: 'hard', to: 'normal', characters: 300 },
        { from: 'hard', to: 'left', characters: 180 },
        { from: 'normal', to: 'hard', characters: 240 },
        { from: 'normal', to: 'normal', characters: 3900 },
        { from: 'normal', to: 'left', characters: 520 },
        { from: 'returned', to: 'hard', characters: 70 },
        { from: 'returned', to: 'normal', characters: 150 },
        { from: 'first', to: 'hard', characters: 40 },
        { from: 'first', to: 'normal', characters: 50 }
      ]
    : null

  const streaks = weekly
    ? [
        { weeks: 1, characters: 320 },
        { weeks: 2, characters: 280 },
        { weeks: 4, characters: 410 },
        { weeks: 8, characters: 260 },
        { weeks: 12, characters: 180 }
      ]
    : null

  const stages =
    header.kind === 'raid'
      ? [
          { stage: '싱글/매칭', characters: 1800 },
          { stage: '일반', characters: 900 },
          { stage: '하드', characters: 500 }
        ]
      : null

  const weeklyClears = weeks.map((item, index) => {
    const firstCleared = Math.round(item.cleared * (index === 0 ? 1 : 0.12))
    const repeatCleared = Math.round(item.cleared * (index === 0 ? 0 : 0.88))
    const everCleared = Math.round(item.cleared * (1.2 + index * 0.05))

    return {
      weekStart: item.weekStart,
      population: item.population,
      firstCleared,
      repeatCleared,
      everCleared
    }
  })

  const fameBands = Array.from({ length: 10 }, (_, index) => ({
    fame: 104000 + index * 2000,
    population: 2400 - index * 180,
    cleared: 40 + index * 70
  }))

  const equipmentBands = Array.from({ length: 8 }, (_, index) => ({
    score: 2_400_000 + index * 200_000,
    population: 1200 - index * 90,
    cleared: 60 + index * 80
  }))

  const buffBands = Array.from({ length: 6 }, (_, index) => ({
    score: 1_000_000 + index * 200_000,
    population: 600 - index * 60,
    cleared: 30 + index * 50
  }))

  return {
    ...header,
    week: selected,
    jobs,
    adventures,
    weeklyClears,
    fameBands,
    weekOverWeek,
    weekMoves,
    streaks,
    stages,
    scoreBands: { equipment: equipmentBands, buff: buffBands },
    weekdays,
    hours
  }
}
