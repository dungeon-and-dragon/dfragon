import { type DynamicModule, Module } from '@nestjs/common'
import type { ReportCode } from '../../access-log.js'
import { SCORE_ENGINE, createScoreEngine } from '../../infrastructure/score/engine.js'

export interface ScoreEngineModuleOptions {
  readonly libraryPath: string | null
  readonly reportCode: ReportCode
}

// 상세 조회 module이 엔진을 받는다. 전역 module은 종료 hook이 다른 module보다 늦게 불려, 상세 조회가 먼저 진행 중인 요청을 취소한 뒤 worker를 멈춘다.
@Module({})
export class ScoreEngineModule {
  static register({ libraryPath, reportCode }: ScoreEngineModuleOptions): DynamicModule {
    return {
      module: ScoreEngineModule,
      global: true,
      providers: [
        {
          provide: SCORE_ENGINE,
          // worker는 listen을 기다리지 않고 시작해 준비 계산을 하며, 그동안 온 계산은 worker에 쌓였다가 차례로 계산된다.
          useFactory: () => createScoreEngine({ path: libraryPath, report: reportCode })
        }
      ],
      exports: [SCORE_ENGINE]
    }
  }
}
