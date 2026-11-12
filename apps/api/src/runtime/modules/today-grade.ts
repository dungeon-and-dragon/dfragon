import { type DynamicModule, Module } from '@nestjs/common'
import type { TodayGradeService } from '../../application/today-grade/service.js'
import {
  TODAY_GRADE_SERVICE,
  TodayGradeController
} from '../../presentation/http/today-grade/controller.js'

@Module({})
export class TodayGradeModule {
  static register(service: TodayGradeService): DynamicModule {
    return {
      module: TodayGradeModule,
      controllers: [TodayGradeController],
      providers: [{ provide: TODAY_GRADE_SERVICE, useValue: service }]
    }
  }
}
