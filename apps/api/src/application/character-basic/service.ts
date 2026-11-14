import type { CharacterFetched } from '../../domain/character-events.js'
import type { CharacterIdentity } from '../../domain/character-identity.js'
import type {
  CharacterRecordFailure,
  ParseCharacterBasic,
  ParseCharacterSkillStyle
} from './ports.js'
import type { CharacterBasicRepository } from './repository.js'

export interface CharacterBasicDependencies {
  readonly parseBasic: ParseCharacterBasic
  readonly parseSkillStyle: ParseCharacterSkillStyle
  readonly reportFailure: (failure: CharacterRecordFailure) => void
}

export class CharacterBasicService {
  constructor(
    private readonly repository: CharacterBasicRepository,
    private readonly ports: CharacterBasicDependencies
  ) {}

  record({ serverId, characterId, basic, skillStyle, fetchedAt, score }: CharacterFetched): void {
    const parsedBasic = this.ports.parseBasic(basic)

    // 모험단 이름이 없는 캐릭터처럼 characters에 넣을 수 없는 응답은 저장하지 않는다.
    if (parsedBasic === undefined) {
      return
    }

    const parsedSkillStyle = this.ports.parseSkillStyle(skillStyle)
    // 스킬 스타일, 점수 행은 characters를 참조하므로 기본 정보를 저장한 뒤에 저장한다.
    this.repository.recordBasic(parsedBasic).then(
      () => {
        this.recordCalculatedScore({ serverId, characterId }, score).catch(() =>
          this.ports.reportFailure('CHARACTER_SCORE_RECORD_FAILED')
        )

        if (parsedSkillStyle === undefined) {
          return
        }

        this.repository
          .recordSkillStyle({ serverId, characterId, ...parsedSkillStyle, fetchedAt })
          .catch(() => this.ports.reportFailure('CHARACTER_SKILL_STYLE_RECORD_FAILED'))
      },
      () => this.ports.reportFailure('CHARACTER_BASIC_RECORD_FAILED')
    )
  }

  private async recordCalculatedScore(
    identity: CharacterIdentity,
    score: CharacterFetched['score']
  ): Promise<void> {
    const calculated = await score

    if (calculated === null) {
      return
    }

    await this.repository.recordScore({ ...identity, ...calculated })
  }
}
