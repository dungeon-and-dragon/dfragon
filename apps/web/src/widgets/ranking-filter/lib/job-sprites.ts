import type { ImageChipSprite } from '@dfragon/ui'
import type { MaleCrusaderRole, RankingGrow, RankingJob } from '#entities/character'
import growsSheet from '#shared/assets/ranking-jobs/grows.webp'
import jobsSheet from '#shared/assets/ranking-jobs/jobs.webp'
import roleBadgesSheet from '#shared/assets/ranking-jobs/role-badges.webp'

// 직업, 전직 sprite는 던파 공식 캐릭터 소개 페이지의 그림을 webp로 옮겼다. 직업은 왼쪽 직업 목록(100x40 칸을 세로로
// 쌓음)을, 전직은 딜러 목록 아래에 버퍼 목록을 붙인 sprite(110x50 칸)를 쓴다. 전직 sprite는 줄 간격이 일정하지 않아
// 칸 위치를 그 페이지 값 그대로 옮겼다.
const BUFFER_ROW_Y = 1020

function dealer(x: number, y: number): ImageChipSprite {
  return {
    src: growsSheet,
    sheetWidth: 839,
    x,
    y,
    width: 110,
    height: 50
  }
}

function buffer(x: number): ImageChipSprite {
  return {
    src: growsSheet,
    sheetWidth: 839,
    x,
    y: BUFFER_ROW_Y,
    width: 110,
    height: 50
  }
}

const JOB_ORDER = [
  '귀검사(남)',
  '귀검사(여)',
  '격투가(남)',
  '격투가(여)',
  '거너(남)',
  '거너(여)',
  '마법사(남)',
  '마법사(여)',
  '프리스트(남)',
  '프리스트(여)',
  '도적',
  '나이트',
  '마창사',
  '총검사',
  '아처',
  '제국기사',
  '다크나이트',
  '크리에이터'
]

// 남자 크루세이더는 딜러, 버퍼가 같은 전직 ID라 역할까지 키에 붙인다. 공식 목록에 남자 크루세이더 칸이 하나뿐이라
// 두 역할이 같은 그림을 쓴다.
const GROW_SPRITES: Readonly<Record<string, ImageChipSprite>> = {
  '귀검사(남)/웨펀마스터': dealer(0, 0),
  '귀검사(남)/소울브링어': dealer(145, 0),
  '귀검사(남)/버서커': dealer(290, 0),
  '귀검사(남)/아수라': dealer(435, 0),
  '귀검사(남)/검귀': dealer(580, 0),
  '귀검사(여)/소드마스터': dealer(725, 0),
  '귀검사(여)/데몬슬레이어': dealer(0, 97),
  '귀검사(여)/베가본드': dealer(145, 97),
  '귀검사(여)/다크템플러': dealer(290, 97),
  '귀검사(여)/블레이드': dealer(435, 97),
  '격투가(남)/넨마스터': dealer(580, 97),
  '격투가(남)/스트라이커': dealer(725, 97),
  '격투가(남)/스트리트파이터': dealer(0, 194),
  '격투가(남)/그래플러': dealer(145, 194),
  '격투가(여)/넨마스터': dealer(290, 194),
  '격투가(여)/스트라이커': dealer(435, 194),
  '격투가(여)/스트리트파이터': dealer(580, 194),
  '격투가(여)/그래플러': dealer(725, 194),
  '거너(남)/레인저': dealer(0, 291),
  '거너(남)/런처': dealer(145, 291),
  '거너(남)/메카닉': dealer(290, 291),
  '거너(남)/스핏파이어': dealer(435, 291),
  '거너(남)/어썰트': dealer(580, 291),
  '거너(여)/레인저': dealer(725, 291),
  '거너(여)/런처': dealer(0, 388),
  '거너(여)/메카닉': dealer(145, 388),
  '거너(여)/스핏파이어': dealer(290, 388),
  '거너(여)/패러메딕': buffer(580),
  '마법사(남)/엘레멘탈 바머': dealer(435, 388),
  '마법사(남)/빙결사': dealer(580, 388),
  '마법사(남)/블러드 메이지': dealer(725, 388),
  '마법사(남)/스위프트 마스터': dealer(0, 485),
  '마법사(남)/디멘션워커': dealer(145, 485),
  '마법사(여)/엘레멘탈마스터': dealer(290, 485),
  '마법사(여)/소환사': dealer(435, 485),
  '마법사(여)/배틀메이지': dealer(580, 485),
  '마법사(여)/마도학자': dealer(725, 485),
  '마법사(여)/인챈트리스': buffer(290),
  '프리스트(남)/크루세이더/dealer': buffer(0),
  '프리스트(남)/크루세이더/buffer': buffer(0),
  '프리스트(남)/인파이터': dealer(0, 582),
  '프리스트(남)/퇴마사': dealer(145, 582),
  '프리스트(남)/어벤저': dealer(290, 582),
  '프리스트(여)/크루세이더': buffer(145),
  '프리스트(여)/이단심판관': dealer(435, 582),
  '프리스트(여)/무녀': dealer(580, 582),
  '프리스트(여)/미스트리스': dealer(725, 582),
  '프리스트(여)/인파이터': dealer(580, 970),
  '도적/로그': dealer(0, 679),
  '도적/사령술사': dealer(145, 679),
  '도적/쿠노이치': dealer(290, 679),
  '도적/섀도우댄서': dealer(435, 679),
  '나이트/엘븐나이트': dealer(580, 679),
  '나이트/카오스': dealer(725, 679),
  '나이트/팔라딘': dealer(0, 779),
  '나이트/드래곤나이트': dealer(145, 779),
  '마창사/뱅가드': dealer(290, 779),
  '마창사/듀얼리스트': dealer(435, 779),
  '마창사/드래고니안 랜서': dealer(580, 779),
  '마창사/다크 랜서': dealer(725, 779),
  '총검사/요원': dealer(0, 873),
  '총검사/트러블 슈터': dealer(145, 873),
  '총검사/히트맨': dealer(290, 873),
  '총검사/스페셜리스트': dealer(435, 873),
  '아처/뮤즈': buffer(435),
  '아처/트래블러': dealer(580, 873),
  '아처/헌터': dealer(145, 970),
  '아처/비질란테': dealer(290, 970),
  '아처/키메라': dealer(435, 970),
  '다크나이트/다크나이트': dealer(725, 873),
  '크리에이터/크리에이터': dealer(0, 970),
  '제국기사/브레이커': dealer(725, 970)
}

export function growSprite(job: RankingJob, grow: RankingGrow): ImageChipSprite | undefined {
  const key = [job.name, grow.name, grow.role].filter((part) => part !== undefined).join('/')

  return GROW_SPRITES[key]
}

export function jobSprite(job: RankingJob): ImageChipSprite | undefined {
  const index = JOB_ORDER.indexOf(job.name)

  if (index === -1) {
    return undefined
  }

  return {
    src: jobsSheet,
    sheetWidth: 100,
    x: 0,
    y: index * 40,
    width: 100,
    height: 40
  }
}

// 남자 크루세이더는 딜러, 버퍼가 같은 그림이라 역할 아이콘(32x32 칸을 딜러, 버퍼 순으로 가로로 붙임)을 얹어 구분한다.
export function roleBadgeSprite(role: MaleCrusaderRole): ImageChipSprite {
  const cellX = role === 'dealer' ? 0 : 32

  return {
    src: roleBadgesSheet,
    sheetWidth: 64,
    x: cellX,
    y: 0,
    width: 32,
    height: 32
  }
}
