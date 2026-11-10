import { type DynamicModule, Module } from '@nestjs/common'
import type { FetchShopGrade } from '../../application/today-grade/ports.js'
import { createTodayGradeService } from '../../application/today-grade/service.js'
import {
  TODAY_GRADE_SERVICE,
  TodayGradeController
} from '../../presentation/http/today-grade/controller.js'

export interface TodayGradeModuleOptions {
  readonly fetchShopGrade: FetchShopGrade
}

@Module({})
export class TodayGradeModule {
  static register({ fetchShopGrade }: TodayGradeModuleOptions): DynamicModule {
    return {
      module: TodayGradeModule,
      controllers: [TodayGradeController],
      providers: [
        { provide: TODAY_GRADE_SERVICE, useValue: createTodayGradeService(fetchShopGrade) }
      ]
    }
  }
}
