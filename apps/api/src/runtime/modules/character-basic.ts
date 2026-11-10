import { type DynamicModule, Module } from '@nestjs/common'
import type { ReportCode } from '../../access-log.js'
import {
  CharacterBasicSubscriber,
  type RecordCharacterBasic,
  type RecordCharacterSkillStyle
} from '../../characters/basic/subscriber.js'

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
              recordCharacterBasic,
              recordCharacterSkillStyle,
              reportCode
            )
        }
      ]
    }
  }
}
