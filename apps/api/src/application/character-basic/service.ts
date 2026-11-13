import type { CharacterFetched } from '../../domain/character-events.js'
import type { CharacterIdentity } from '../../domain/character-identity.js'
import type {
  CharacterRecordFailure,
  ParseCharacterBasic,
  ParseCharacterSkillStyle,
  RecordCharacterBasic,
  RecordCharacterScore,
  RecordCharacterSkillStyle,
  RecordFetchedCharacterBasic
} from './ports.js'

export interface CharacterBasicDependencies {
  readonly parseBasic: ParseCharacterBasic
  readonly parseSkillStyle: ParseCharacterSkillStyle
  readonly recordBasic: RecordCharacterBasic
  readonly recordSkillStyle?: RecordCharacterSkillStyle
  readonly recordScore?: RecordCharacterScore
  readonly reportFailure: (failure: CharacterRecordFailure) => void
}

export function createCharacterBasicRecorder({
  parseBasic,
  parseSkillStyle,
  recordBasic,
  recordSkillStyle,
  recordScore,
  reportFailure
}: CharacterBasicDependencies): RecordFetchedCharacterBasic {
  const recordCalculatedScore = async (
    identity: CharacterIdentity,
    score: CharacterFetched['score']
  ): Promise<void> => {
    if (recordScore === undefined) {
      return
    }

    const calculated = await score

    if (calculated === null) {
      return
    }

    await recordScore({ ...identity, ...calculated })
  }

  return ({
    serverId,
    characterId,
    basic,
    skillStyle,
    fetchedAt,
    score
  }: CharacterFetched): void => {
    const parsedBasic = parseBasic(basic)
    // 모험단 이름이 없는 캐릭터처럼 characters에 넣을 수 없는 응답은 저장하지 않는다.
    if (parsedBasic === undefined) {
      return
    }
    const parsedSkillStyle = parseSkillStyle(skillStyle)
    // 스킬 스타일, 점수 행은 characters를 참조하므로 기본 정보를 저장한 뒤에 저장한다.
    recordBasic(parsedBasic).then(
      () => {
        recordCalculatedScore({ serverId, characterId }, score).catch(() =>
          reportFailure('CHARACTER_SCORE_RECORD_FAILED')
        )

        if (recordSkillStyle === undefined || parsedSkillStyle === undefined) {
          return
        }
        recordSkillStyle({ serverId, characterId, ...parsedSkillStyle, fetchedAt }).catch(() =>
          reportFailure('CHARACTER_SKILL_STYLE_RECORD_FAILED')
        )
      },
      () => reportFailure('CHARACTER_BASIC_RECORD_FAILED')
    )
  }
}
