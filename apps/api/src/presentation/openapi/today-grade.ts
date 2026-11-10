import { applyDecorators } from '@nestjs/common'
import { ApiOperation, type SchemaObject } from '@nestjs/swagger'
import {
  errorResponses,
  neopleFailures,
  objectSchema,
  successResponse,
  timestampSchema
} from './common.js'

export const todayGradeSchemas: Record<string, SchemaObject> = {
  TodayGrade: objectSchema({
    percent: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: '11부위 대표 아이템 오늘의 등급(itemGradeValue)의 평균을 반올림한 값'
    },
    expiresAt: { ...timestampSchema, description: '등급이 바뀌는 다음 0시(KST)' }
  })
}

export function ApiTodayGrade() {
  return applyDecorators(
    ApiOperation({
      summary: '오늘의 등급 조회',
      description:
        '공개 API. 방어구 5, 악세서리 3, 특수장비 3부위의 엘더 페어리 장비(115레벨 레전더리) 11개를 Neople 상점 판매 정보 조회로 받아 오늘의 등급(itemGradeValue)의 평균을 반환합니다. 결과는 등급이 바뀌는 다음 0시(KST)까지 API 메모리에 캐시하고, 겹치는 조회는 공유합니다. 아이템 하나라도 실패하면 부분 결과 없이 실패하며 실패는 캐시하지 않습니다.'
    }),
    successResponse('TodayGrade', '오늘의 등급 퍼센트와 만료 시각'),
    errorResponses(neopleFailures)
  )
}
