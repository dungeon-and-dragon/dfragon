import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiQuery, type SchemaObject } from '@nestjs/swagger'
import { CHARACTER_ID_PATTERN_SOURCE } from '../../characters/identity.js'
import { NEOPLE_SERVER_NAMES } from '../../constants/neople-character-search.js'
import {
  objectSchema,
  successResponse,
  errorResponses,
  neopleFailures,
  textSchema
} from './common.js'

const characterSearchRowProperties: Record<string, SchemaObject> = {
  characterId: {
    type: 'string',
    pattern: CHARACTER_ID_PATTERN_SOURCE,
    minLength: 1,
    maxLength: 256
  },
  characterName: textSchema,
  serverId: { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] },
  serverName: textSchema,
  fame: { type: 'number', nullable: true },
  jobName: {
    type: 'string',
    nullable: true,
    description:
      'Neople 검색 응답의 jobName. 문자열이 아니거나 비어 있으면 null이며 상세를 조회하지 않습니다.'
  },
  jobGrowName: {
    type: 'string',
    nullable: true,
    description:
      'Neople 검색 응답의 jobGrowName. 문자열이 아니거나 비어 있으면 null이며 상세를 조회하지 않습니다.'
  },
  imageUrl: {
    type: 'string',
    format: 'uri',
    description: 'Neople 전체 캐릭터 이미지 URL. Web에서 파티원 얼굴 영역과 비교합니다.',
    example: 'https://img-api.neople.co.kr/df/servers/cain/characters/character-id?zoom=1'
  }
}

const CHARACTER_SEARCH_ORDER_DESCRIPTION =
  'fame 내림차순, null은 마지막. 동률과 null은 공급자 순서 유지.'

const characterSearchRows = (
  description: string,
  properties: Record<string, SchemaObject> = {}
): SchemaObject =>
  objectSchema({
    rows: {
      type: 'array',
      description,
      items: objectSchema({ ...characterSearchRowProperties, ...properties })
    }
  })

export const characterSearchSchemas: Record<string, SchemaObject> = {
  CharacterCandidatesResult: characterSearchRows(CHARACTER_SEARCH_ORDER_DESCRIPTION),
  CharacterCandidatesWithAdventureResult: characterSearchRows(CHARACTER_SEARCH_ORDER_DESCRIPTION, {
    adventureName: {
      type: 'string',
      nullable: true,
      description:
        'DB에 저장된 그 캐릭터(서버, 캐릭터 ID)의 모험단명. 저장되지 않은 캐릭터와 DB 설정이 없는 API는 null입니다. 응답할 때마다 DB에서 읽어 24시간 후보 캐시에 들지 않습니다.'
    }
  })
}

export function ApiCharacterSearch() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 검색',
      description:
        '공개 API. Neople wordType=full로 검색한 뒤 이름이 characterName으로 시작하는 캐릭터만 반환합니다. characterName이 한 글자면 wordType=full이 받지 않으므로 wordType=match로 검색해 이름이 같은 캐릭터만 반환합니다. 행의 모양은 후보 조회와 같고, 캐릭터 이름순으로 반환합니다. 검색 결과는 저장하지 않습니다. IP별, 서버 전체 호출 제한은 없습니다. 중복, 알 수 없는 query key는 거절합니다.'
    }),
    ApiQuery({
      name: 'characterName',
      required: true,
      schema: { type: 'string', minLength: 1, maxLength: 12 },
      description: 'Unicode code point 1~12개. 앞뒤 공백 불가, 정규화 없음.'
    }),
    ApiQuery({
      name: 'serverId',
      required: false,
      schema: { type: 'string', enum: ['all', ...NEOPLE_SERVER_NAMES.keys()], default: 'all' }
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 200, default: 10 },
      description: 'ASCII 십진 숫자만 허용. 선행 0 허용.'
    }),
    successResponse('CharacterCandidatesResult', '검색 결과 (0건이면 빈 rows)'),
    errorResponses({ 400: 'INVALID_SEARCH_QUERY', ...neopleFailures })
  )
}

export function ApiCharacterCandidates() {
  return applyDecorators(
    ApiOperation({
      summary: 'OCR 닉네임의 캐릭터 비교 후보 조회',
      description:
        '공개 API. 닉네임 하나를 전체 서버에서 정확히 일치하는 wordType=match로 검색합니다. fame이 있는 후보를 내림차순, fame이 null인 후보를 뒤에 반환하며 동률과 null 사이에는 공급자 순서를 유지합니다. jobName, jobGrowName은 Neople 검색 응답의 값이며 없으면 null입니다. adventureName은 DB에 저장된 그 캐릭터의 모험단명이며 저장되지 않았거나 DB 설정이 없으면 null입니다. Neople 상세를 조회하지 않고 후보 전체를 query 한 번으로 읽습니다. imageUrl은 zoom=1인 전체 캐릭터 이미지이며 얼굴 크롭과 비교는 Web에서 수행합니다. 반환 순서대로 비교하여 기준을 먼저 통과한 캐릭터를 선택하고, 모두 실패한 뒤 다음 OCR 닉네임을 요청합니다. 후보가 있는 Neople 검색 결과는 이름별로 API 메모리에 24시간 캐시하며, 실패와 빈 결과는 캐시하지 않습니다. 모험단명은 캐시하지 않고 응답할 때마다 DB에서 읽습니다. 이미지는 API에 저장하지 않습니다. IP별, 서버 전체 호출 제한은 없습니다. characterName 외 query key와 중복 query는 거절합니다.'
    }),
    ApiQuery({
      name: 'characterName',
      required: true,
      schema: { type: 'string', minLength: 1, maxLength: 12 },
      description: 'Unicode code point 1~12개. 앞뒤 공백 불가, 정규화 없음.'
    }),
    successResponse(
      'CharacterCandidatesWithAdventureResult',
      '비교 순서의 후보와 이미지 URL, 모험단명 (0건이면 빈 rows)'
    ),
    errorResponses({ 400: 'INVALID_SEARCH_QUERY', ...neopleFailures })
  )
}
