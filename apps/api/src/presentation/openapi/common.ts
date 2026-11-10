import { applyDecorators } from '@nestjs/common'
import { ApiParam, ApiResponse, type SchemaObject } from '@nestjs/swagger'
import { CHARACTER_ID_PATTERN_SOURCE } from '../../characters/identity.js'
import { NEOPLE_SERVER_NAMES } from '../../constants/neople-character-search.js'

export const timestampSchema: SchemaObject = { type: 'string', format: 'date-time' }

export function objectSchema(properties: Record<string, SchemaObject>): SchemaObject {
  const required = Object.keys(properties)

  return {
    type: 'object',
    required,
    additionalProperties: false,
    properties
  }
}

export function successResponse(schema: string, description: string) {
  return ApiResponse({
    status: 200,
    description,
    schema: { $ref: `#/components/schemas/${schema}` }
  })
}

export function errorResponses(definitions: Record<number, string>) {
  return applyDecorators(
    ...Object.entries(definitions).map(([status, description]) =>
      ApiResponse({
        status: Number(status),
        description,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
      })
    )
  )
}

export const neopleFailures = {
  500: 'INTERNAL_SERVER_ERROR',
  502: 'NEOPLE_API_ERROR',
  503: 'NEOPLE_UNAVAILABLE',
  504: 'NEOPLE_TIMEOUT'
}

export const textSchema: SchemaObject = { type: 'string' }

export const nullableTextSchema: SchemaObject = { type: 'string', nullable: true }

export const serverIdSchema: SchemaObject = {
  type: 'string',
  enum: [...NEOPLE_SERVER_NAMES.keys()]
}

export const timelineClearKindSchema: SchemaObject = { type: 'string', enum: ['raid', 'legion'] }

export const characterCountSchema: SchemaObject = { type: 'integer', minimum: 0 }

export const storedCharacterProperties: Record<string, SchemaObject> = {
  serverId: serverIdSchema,
  characterId: textSchema,
  characterName: textSchema,
  adventureName: textSchema,
  level: { type: 'integer', nullable: true },
  jobId: nullableTextSchema,
  jobGrowId: nullableTextSchema,
  jobName: nullableTextSchema,
  jobGrowName: nullableTextSchema,
  fame: { type: 'integer', nullable: true },
  guildId: nullableTextSchema,
  guildName: nullableTextSchema,
  fetchedAt: {
    ...timestampSchema,
    nullable: true,
    description: '이 행의 기본 정보를 Neople에서 받은 시각(basic_fetched_at). 받지 않은 행은 null'
  },
  role: {
    type: 'string',
    enum: ['dealer', 'buffer', 'synergy'],
    nullable: true,
    description:
      '카드 role과 같은 전직 이름 기준이며 직업을 모르면 null. jobName이 프리스트(남)인 크루세이더는 저장된 스킬 스타일(받을 때의 전직이 지금 전직과 같은 행)에 용기의 은총이 있으면 dealer, 없으면 buffer이고 그런 행이 없으면 null.'
  }
}

export const storedCharacterSchema = objectSchema(storedCharacterProperties)

export const characterParams = [
  ApiParam({
    name: 'serverId',
    schema: { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] }
  }),
  ApiParam({
    name: 'characterId',
    schema: { type: 'string', pattern: CHARACTER_ID_PATTERN_SOURCE, minLength: 1, maxLength: 256 }
  })
]

export const commonSchemas: Record<string, SchemaObject> = {
  ApiError: objectSchema({ error: objectSchema({ code: textSchema, message: textSchema }) })
}
