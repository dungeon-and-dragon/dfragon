import { ApiTags } from '@nestjs/swagger'
import { Controller, Get, Inject, Res, UseFilters } from '@nestjs/common'
import type { Response } from 'express'
import type { TodayGradeService } from '../../../application/today-grade/service.js'
import { respondWithCancellation } from '../../../http-response.js'
import { ApiTodayGrade } from '../../openapi/today-grade.js'
import { FailureResponseFilter } from '../failure-response.js'
import { todayGradeFailureResponse } from './failures.js'

export const TODAY_GRADE_SERVICE = Symbol('TODAY_GRADE_SERVICE')

@ApiTags('아이템')
@Controller('items')
@UseFilters(new FailureResponseFilter(todayGradeFailureResponse))
export class TodayGradeController {
  constructor(@Inject(TODAY_GRADE_SERVICE) private readonly service: TodayGradeService) {}

  @Get('today-grade')
  @ApiTodayGrade()
  async todayGrade(@Res() response: Response): Promise<void> {
    await respondWithCancellation(response, (signal) => this.service.get(signal))
  }
}
