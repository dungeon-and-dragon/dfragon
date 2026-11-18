import type { CharacterBasicInput } from '@dfragon/database'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/sections.js'
import type { CharacterFetched } from '../../domain/character-events.js'
import { toSectionBodies } from '@dfragon/server-core/domain/character-history/section-body.js'
import type {
  CharacterRecordFailure,
  ParseCharacterBasic,
  ParseCharacterSkillStyle
} from '@dfragon/server-core/application/character-basic/ports.js'
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

  record({ serverId, characterId, payloads, fetchedAt, score }: CharacterFetched): void {
    const parsedBasic = this.ports.parseBasic(payloads.basic)

    // 모험단 이름이 없는 캐릭터처럼 characters에 넣을 수 없는 응답은 저장하지 않는다.
    if (parsedBasic === undefined) {
      return
    }

    const parsedSkillStyle = this.ports.parseSkillStyle(payloads.skill_style)
    // 스킬 스타일, 점수, 이력 행은 characters를 참조하므로 기본 정보를 저장한 뒤에 저장한다.
    this.repository.recordBasic(parsedBasic).then(
      () => {
        this.recordScoreAndHistory(parsedBasic, payloads, fetchedAt, score).catch(() =>
          this.ports.reportFailure('CHARACTER_HISTORY_RECORD_FAILED')
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

  // 점수 이력에 그 점수를 함께 넣으므로 이력은 점수 계산이 끝난 뒤에 저장한다.
  private async recordScoreAndHistory(
    basic: CharacterBasicInput,
    payloads: CharacterPayloads,
    fetchedAt: Date,
    score: CharacterFetched['score']
  ): Promise<void> {
    const { serverId, characterId, ...basicColumns } = basic
    const calculated = await score
    const sections = toSectionBodies(payloads)

    if (calculated !== null) {
      this.repository
        .recordScore({ serverId, characterId, ...calculated })
        .catch(() => this.ports.reportFailure('CHARACTER_SCORE_RECORD_FAILED'))
    }

    await this.repository.recordHistory({
      serverId,
      characterId,
      observedAt: fetchedAt,
      basic: basicColumns,
      sections,
      score: calculated
    })
  }
}
