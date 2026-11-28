import type { CharacterStats } from '#entities/ranking'

const JOBS = [
  ['귀검사(남)', '眞 웨펀마스터', 9120],
  ['귀검사(남)', '眞 버서커', 8410],
  ['귀검사(여)', '眞 소드마스터', 7630],
  ['격투가(여)', '眞 넨마스터', 6950],
  ['거너(여)', '眞 레인저', 6120],
  ['마법사(여)', '眞 인챈트리스', 5480],
  ['프리스트(남)', '眞 크루세이더', 4870],
  ['도적', '眞 로그', 3910]
] as const

const JOB_FAME_SHARES = [
  [40_000, 0.22],
  [70_000, 0.3],
  [80_000, 0.16],
  [100_000, 0.14],
  [110_000, 0.08],
  [120_000, 0.07],
  [130_000, 0.03]
] as const

const SERVER_SHARES = [
  ['cain', 0.24],
  ['bakal', 0.16],
  ['diregie', 0.14],
  ['casillas', 0.12],
  ['hilder', 0.1],
  ['prey', 0.09],
  ['siroco', 0.08],
  ['anton', 0.07]
] as const

const FINE_BUCKETS = [
  2140, 2380, 2610, 2790, 2950, 3120, 3040, 2880, 2710, 2490, 2230, 1980, 1720, 1460, 1190, 930,
  710, 520, 360, 240, 150, 90, 50, 20
]

// 서버 인구, 직업 분포, 명성 분포는 실제 통계가 아닌 합성 값이다.
export function storyCharacterStats(computedAt: string): CharacterStats {
  const coarse = [
    { from: 10_000, to: 11_000, count: 3820 },
    { from: 52_000, to: 53_000, count: 7410 },
    { from: 95_000, to: 96_000, count: 11_260 }
  ]
  const fine = FINE_BUCKETS.map((count, index) => {
    const from = 120_000 + index * 1000
    const to = from + 1000

    return { from, to, count }
  })
  const fameDistribution = [...coarse, ...fine]
  const total = fameDistribution.reduce((sum, { count }) => sum + count, 0)

  const servers = SERVER_SHARES.map(([serverId, share]) => {
    const count = Math.round(total * share)

    return { serverId, count }
  })
  const jobs = JOBS.map(([jobName, jobGrowName, count], index) => {
    const jobId = `job-${index}`
    const jobGrowId = `grow-${index}`

    // 직업마다 높은 구간 비중을 달리 둬, 범례로 구간을 끄면 막대 순서가 바뀌게 한다.
    const tilt = ((index % 4) - 1.5) / 2
    const weighted = JOB_FAME_SHARES.map(
      ([, share], bucket) => share * (1 + tilt * ((bucket - 3) / 3))
    )
    const weightSum = weighted.reduce((sum, weight) => sum + weight, 0)
    const fameBuckets = JOB_FAME_SHARES.map(([from], bucket) => {
      const to = from + 10_000
      const bucketCount = Math.round((count * (weighted[bucket] ?? 0)) / weightSum)

      return { from, to, count: bucketCount }
    })

    return { jobId, jobGrowId, jobName, jobGrowName, count, fameBuckets }
  })

  return { computedAt, total, servers, jobs, fameDistribution }
}
