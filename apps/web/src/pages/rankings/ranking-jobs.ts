import type { FameRankingFilter } from '#core/shared/ranking/ranking-stats'

type RankingJob = Readonly<{
  jobId: string
  name: string
  grows: readonly Readonly<{ jobGrowId: string; name: string }>[]
}>

// DB에 아직 없는 직업도 보이도록 응답이 아니라 고정 목록이다. id는 Neople 직업 정보 조회(/df/jobs)의 2026-11-06 응답에서
// 직업마다 각성(眞) 전직의 id를 모았다. 캐릭터의 jobGrowId는 이 각성 전직 id이고, 같은 id가 다른 직업에도 있어 jobId와 함께 쓴다.
export const RANKING_JOBS: readonly RankingJob[] = [
  {
    jobId: '41f1cdc2ff58bb5fdc287be0db2a8df3',
    name: '귀검사(남)',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 웨펀마스터' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 소울브링어' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 버서커' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 아수라' },
      { jobGrowId: '92da05ec93fb43406e193ffb9a2a629b', name: '眞 검귀' }
    ]
  },
  {
    jobId: '1645c45aabb008c98406b3a16447040d',
    name: '귀검사(여)',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 소드마스터' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 다크템플러' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 데몬슬레이어' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 베가본드' },
      { jobGrowId: '92da05ec93fb43406e193ffb9a2a629b', name: '眞 블레이드' }
    ]
  },
  {
    jobId: 'ca0f0e0e9e1d55b5f9955b03d9dd213c',
    name: '격투가(남)',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 넨마스터' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 스트라이커' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 스트리트파이터' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 그래플러' }
    ]
  },
  {
    jobId: 'a7a059ebe9e6054c0644b40ef316d6e9',
    name: '격투가(여)',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 넨마스터' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 스트라이커' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 스트리트파이터' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 그래플러' }
    ]
  },
  {
    jobId: 'afdf3b989339de478e85b614d274d1ef',
    name: '거너(남)',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 레인저' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 런처' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 메카닉' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 스핏파이어' },
      { jobGrowId: '92da05ec93fb43406e193ffb9a2a629b', name: '眞 어썰트' }
    ]
  },
  {
    jobId: '944b9aab492c15a8474f96947ceeb9e4',
    name: '거너(여)',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 레인저' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 런처' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 메카닉' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 스핏파이어' },
      { jobGrowId: '92da05ec93fb43406e193ffb9a2a629b', name: '眞 패러메딕' }
    ]
  },
  {
    jobId: 'a5ccbaf5538981c6ef99b236c0a60b73',
    name: '마법사(남)',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 엘레멘탈 바머' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 빙결사' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 블러드 메이지' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 스위프트 마스터' },
      { jobGrowId: '92da05ec93fb43406e193ffb9a2a629b', name: '眞 디멘션워커' }
    ]
  },
  {
    jobId: '3909d0b188e9c95311399f776e331da5',
    name: '마법사(여)',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 엘레멘탈마스터' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 소환사' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 배틀메이지' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 마도학자' },
      { jobGrowId: '92da05ec93fb43406e193ffb9a2a629b', name: '眞 인챈트리스' }
    ]
  },
  {
    jobId: 'f6a4ad30555b99b499c07835f87ce522',
    name: '프리스트(남)',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 크루세이더' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 인파이터' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 퇴마사' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 어벤저' }
    ]
  },
  {
    jobId: '0c1b401bb09241570d364420b3ba3fd7',
    name: '프리스트(여)',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 크루세이더' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 이단심판관' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 무녀' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 미스트리스' },
      { jobGrowId: '92da05ec93fb43406e193ffb9a2a629b', name: '眞 인파이터' }
    ]
  },
  {
    jobId: 'ddc49e9ad1ff72a00b53c6cff5b1e920',
    name: '도적',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 로그' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 사령술사' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 쿠노이치' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 섀도우댄서' }
    ]
  },
  {
    jobId: '0ee8fa5dc525c1a1f23fc6911e921e4a',
    name: '나이트',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 엘븐나이트' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 카오스' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 팔라딘' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 드래곤나이트' }
    ]
  },
  {
    jobId: '3deb7be5f01953ac8b1ecaa1e25e0420',
    name: '마창사',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 뱅가드' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 듀얼리스트' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 드래고니안 랜서' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 다크 랜서' }
    ]
  },
  {
    jobId: '986c2b3d72ee0e4a0b7fcfbe786d4e02',
    name: '총검사',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 히트맨' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 요원' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 트러블 슈터' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 스페셜리스트' }
    ]
  },
  {
    jobId: 'b9cb48777665de22c006fabaf9a560b3',
    name: '아처',
    grows: [
      { jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 뮤즈' },
      { jobGrowId: '618326026de1a1f1cfba5dbd0b8396e7', name: '眞 트래블러' },
      { jobGrowId: '6d459bc74ba73ee4fe5cdc4655400193', name: '眞 헌터' },
      { jobGrowId: 'c9b492038ee3ca8d27d7004cf58d59f3', name: '眞 비질란테' },
      { jobGrowId: '92da05ec93fb43406e193ffb9a2a629b', name: '眞 키메라' }
    ]
  },
  {
    jobId: '17e417b31686389eebff6d754c3401ea',
    name: '다크나이트',
    grows: [{ jobGrowId: '0a49d9c8b5e1358efff324e5cb11d41e', name: '眞 다크나이트' }]
  },
  {
    jobId: 'b522a95d819a5559b775deb9a490e49a',
    name: '크리에이터',
    grows: [{ jobGrowId: '0a49d9c8b5e1358efff324e5cb11d41e', name: '眞 크리에이터' }]
  },
  {
    jobId: '8d4d2001cdb357e41633c234eb7501b5',
    name: '제국기사',
    grows: [{ jobGrowId: '37495b941da3b1661bc900e68ef3b2c6', name: '眞 브레이커' }]
  }
]

export function rankingName({ jobId }: FameRankingFilter): string {
  const job = RANKING_JOBS.find((candidate) => candidate.jobId === jobId)

  if (job === undefined) {
    return '명성 랭킹'
  }

  return `${job.name} 명성 랭킹`
}
