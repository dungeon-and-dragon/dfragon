import { createCharacterBasicRecorder } from '../../application/character-basic/service.js'
import {
  parseCharacterBasic,
  parseCharacterSkillStyle
} from '../../infrastructure/neople/character-basic.js'
import { CharacterBasicSubscriber } from '../../presentation/events/character-basic.js'
import { type DynamicModule, Module } from '@nestjs/common'
import type { ReportCode } from '../../access-log.js'
import {
  type RecordCharacterBasic,
  type RecordCharacterSkillStyle
} from '../../application/character-basic/ports.js'

export interface CharacterBasicModuleOptions {
  readonly recordCharacterBasic?: RecordCharacterBasic
  readonly recordCharacterSkillStyle?: RecordCharacterSkillStyle
  readonly reportCode: ReportCode
}

@Module({})
export class CharacterBasicModule {
  static register({
    recordCharacterBasic,
    recordCharacterSkillStyle,
    reportCode
  }: CharacterBasicModuleOptions): DynamicModule {
    // DB 설정이 없으면 구독자를 등록하지 않아, 상세 조회가 낸 이벤트를 받는 곳이 없다.
    if (recordCharacterBasic === undefined) {
      return { module: CharacterBasicModule }
    }

    return {
      module: CharacterBasicModule,
      providers: [
        {
          provide: CharacterBasicSubscriber,
          useFactory: () =>
            new CharacterBasicSubscriber(
              createCharacterBasicRecorder({
                recordBasic: recordCharacterBasic,
                recordSkillStyle: recordCharacterSkillStyle,
                parseBasic: parseCharacterBasic,
                parseSkillStyle: parseCharacterSkillStyle,
                reportFailure: reportCode
              })
            )
        }
      ]
    }
  }
}
