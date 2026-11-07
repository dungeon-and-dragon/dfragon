import type { CharacterBasicInput, CharacterSkillStyleInput } from '@dfragon/database'
import { characterBasicSchema, characterSkillStyleSchema } from '@dfragon/neople'
import { OnEvent } from '@nestjs/event-emitter'
import { CHARACTER_FETCHED, type CharacterFetched } from '../events.js'

export type RecordCharacterBasic = (basic: CharacterBasicInput) => Promise<void>

export type RecordCharacterSkillStyle = (style: CharacterSkillStyleInput) => Promise<void>

export type CharacterRecordFailure =
  | 'CHARACTER_BASIC_RECORD_FAILED'
  | 'CHARACTER_SKILL_STYLE_RECORD_FAILED'

export class CharacterBasicSubscriber {
  constructor(
    private readonly recordBasic: RecordCharacterBasic,
    private readonly recordSkillStyle: RecordCharacterSkillStyle | undefined,
    private readonly reportFailure: (failure: CharacterRecordFailure) => void
  ) {}

  @OnEvent(CHARACTER_FETCHED)
  onCharacterFetched({
    serverId,
    characterId,
    basic,
    skillStyle,
    fetchedAt
  }: CharacterFetched): void {
    const parsedBasic = characterBasicSchema.safeParse(basic)
    // 모험단 이름이 없는 캐릭터처럼 characters에 넣을 수 없는 응답은 저장하지 않는다.
    if (!parsedBasic.success) {
      return
    }
    const parsedSkillStyle = characterSkillStyleSchema.safeParse(skillStyle)
    const recordSkillStyle = this.recordSkillStyle
    // 스킬 스타일 행은 characters를 참조하므로 기본 정보를 저장한 뒤에 저장한다.
    this.recordBasic(parsedBasic.data).then(
      () => {
        if (recordSkillStyle === undefined || !parsedSkillStyle.success) {
          return
        }
        recordSkillStyle({ serverId, characterId, ...parsedSkillStyle.data, fetchedAt }).catch(() =>
          this.reportFailure('CHARACTER_SKILL_STYLE_RECORD_FAILED')
        )
      },
      () => this.reportFailure('CHARACTER_BASIC_RECORD_FAILED')
    )
  }
}
