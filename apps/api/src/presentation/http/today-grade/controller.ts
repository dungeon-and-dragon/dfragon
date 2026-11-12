import { Controller, Get, Inject, Res, UseFilters } from '@nestjs/common'
import type { Response } from 'express'
import type { TodayGradeService } from '../../../application/today-grade/service.js'
import { respondWithCancellation } from '../http-response.js'
import { FailureResponseFilter } from '../failure-response.js'
import { todayGradeFailureResponse } from './failures.js'

export const TODAY_GRADE_SERVICE = Symbol('TODAY_GRADE_SERVICE')

@Controller('items')
@UseFilters(new FailureResponseFilter(todayGradeFailureResponse))
export class TodayGradeController {
  constructor(@Inject(TODAY_GRADE_SERVICE) private readonly service: TodayGradeService) {}

  @Get('today-grade')
  async todayGrade(@Res() response: Response): Promise<void> {
    await respondWithCancellation(response, (signal) => this.service.get(signal))
  }
}
