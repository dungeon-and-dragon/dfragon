import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'
import { errorResponses, neopleFailures, characterParams } from './common.js'

export function ApiCharacterImage() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 초상화 전달',
      description:
        '공개 API. 검증한 serverId, characterId로 만든 Neople 캐릭터 이미지(zoom=1)를 받아 image/png 본문을 변환하지 않고 그대로 반환합니다. 웹 사이트는 같은 origin의 /api로 받아 얼굴 크롭과 비교할 픽셀을 읽으므로 CORS 헤더는 붙이지 않습니다. API 메모리에 캐시하거나 저장하지 않으며 Cache-Control: private, max-age=3600으로 브라우저 캐시만 씁니다. Neople 이미지가 4MiB를 넘거나 image/png가 아니면 NEOPLE_API_ERROR입니다.'
    }),
    ...characterParams,
    ApiResponse({
      status: 200,
      description: 'Neople 캐릭터 이미지 원본',
      content: { 'image/png': { schema: { type: 'string', format: 'binary' } } }
    }),
    errorResponses({ 400: 'INVALID_CHARACTER_QUERY', ...neopleFailures })
  )
}
