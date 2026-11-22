import type { RankedCharacter } from '#entities/ranking/model/ranking-stats'

const SERVERS = ['cain', 'bakal', 'diregie', 'casillas', 'hilder'] as const
const JOBS = [
  ['귀검사(남)', '眞 웨펀마스터'],
  ['귀검사(남)', '眞 버서커'],
  ['거너(여)', '眞 레인저'],
  ['프리스트(남)', '眞 크루세이더'],
  ['마법사(여)', '眞 인챈트리스']
] as const

// 세트 id와 이름, 선택지 이름은 게임 데이터 그대로다. 다섯 번째마다 세트가 없고 일곱 번째마다 세트 값을 받은 적이 없다.
const EQUIPMENT_SETS = [
  { id: '7f788a703a87d783079b41d0fe6448c9', name: '영원히 이어지는 황금향 세트' },
  { id: '11f7d203a05ea6f13300c0facb39f11e', name: '칠흑의 정화 세트' },
  { id: '4ee7bd5912cda6e2a24c1f36d5202b46', name: '소울 페어리 세트' },
  { id: 'b92ca7784123b5fea9cea40144925194', name: '용투장의 난 세트' }
] as const
const OATH_SETS = [
  { id: 16204, name: '야망의 용투 서약', option: '용투 : 세계를 태우는 불꽃' },
  { id: 16204, name: '야망의 용투 서약', option: '용투 : 용제 강림' },
  { id: 16205, name: '완전무결한 정화 서약', option: '정화 : 찬란한 정화' }
] as const
const NO_SET_EVERY = 5
const NOT_FETCHED_EVERY = 7

function setsOf(index: number): Pick<RankedCharacter, 'equipmentSet' | 'oathSet'> {
  if ((index + 1) % NOT_FETCHED_EVERY === 0) {
    return { equipmentSet: null, oathSet: null }
  }

  const equipmentSet =
    (index + 1) % NO_SET_EVERY === 0 ? null : EQUIPMENT_SETS[index % EQUIPMENT_SETS.length]!
  const oathSet = OATH_SETS[index % OATH_SETS.length]!

  return { equipmentSet, oathSet }
}

// 여섯 번째마다 점수가 저장되지 않은 캐릭터다. 점수 값은 운영 데이터의 자릿수를 따른 합성 값이다.
const NO_SCORE_EVERY = 6

function scoreOf(index: number, role: 'buffer' | 'dealer'): RankedCharacter['score'] {
  if ((index + 1) % NO_SCORE_EVERY === 0) {
    return null
  }

  if (role === 'buffer') {
    return { calculator: 'buff', value: 4_120_000 - index * 1_700, approximate: null }
  }

  return { calculator: 'equipment', value: 1_388_832 - index * 613, approximate: null }
}

// 이름과 소속은 실제 캐릭터가 아닌 합성 값이다.
export function storyRankedCharacters(count: number): RankedCharacter[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    const jobIndex = index % JOBS.length
    const [jobName, jobGrowName] = JOBS[jobIndex]!
    const serverId = SERVERS[index % SERVERS.length]!
    const adventureName = `모험단${(index % 7) + 1}`
    const fame = 136_647 - index * 37
    const belowMaxLevel = index % 6 === 5
    const guildless = index % 4 === 3
    const guildNumber = (index % 3) + 1
    const level = belowMaxLevel ? 114 : 115
    const guildId = guildless ? null : `guild-${guildNumber}`
    const guildName = guildless ? null : `길드${guildNumber}`
    const role = jobGrowName === '眞 크루세이더' ? 'buffer' : 'dealer'
    const score = scoreOf(index, role)

    return {
      serverId,
      characterId: `story-character-${number}`,
      characterName: `캐릭터${number}`,
      adventureName,
      level,
      jobId: `job-${jobIndex}`,
      jobGrowId: `grow-${jobIndex}`,
      jobName,
      jobGrowName,
      fame,
      guildId,
      guildName,
      role,
      score,
      ...setsOf(index)
    }
  })
}
