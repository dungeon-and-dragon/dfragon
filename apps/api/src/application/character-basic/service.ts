import type { CharacterFetched } from '../../domain/character-events.js'
import type {
  CharacterRecordFailure,
  ParseCharacterBasic,
  ParseCharacterSkillStyle,
  RecordCharacterBasic,
  RecordCharacterSkillStyle,
  RecordFetchedCharacterBasic
} from './ports.js'

export interface CharacterBasicDependencies {
  readonly parseBasic: ParseCharacterBasic
  readonly parseSkillStyle: ParseCharacterSkillStyle
  readonly recordBasic: RecordCharacterBasic
  readonly recordSkillStyle?: RecordCharacterSkillStyle
  readonly reportFailure: (failure: CharacterRecordFailure) => void
}

export function createCharacterBasicRecorder({
  parseBasic,
  parseSkillStyle,
  recordBasic,
  recordSkillStyle,
  reportFailure
}: CharacterBasicDependencies): RecordFetchedCharacterBasic {
  return ({ serverId, characterId, basic, skillStyle, fetchedAt }: CharacterFetched): void => {
    const parsedBasic = parseBasic(basic)
    // 모험단 이름이 없는 캐릭터처럼 characters에 넣을 수 없는 응답은 저장하지 않는다.
    if (parsedBasic === undefined) {
      return
    }
    const parsedSkillStyle = parseSkillStyle(skillStyle)
    // 스킬 스타일 행은 characters를 참조하므로 기본 정보를 저장한 뒤에 저장한다.
    recordBasic(parsedBasic).then(
      () => {
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
