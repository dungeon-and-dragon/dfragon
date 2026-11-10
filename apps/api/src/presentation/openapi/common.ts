import { applyDecorators } from '@nestjs/common'
import { ApiResponse, type SchemaObject } from '@nestjs/swagger'

export const timestamp: SchemaObject = { type: 'string', format: 'date-time' }

export function object(properties: Record<string, SchemaObject>): SchemaObject {
  const required = Object.keys(properties)

  return {
    type: 'object',
    required,
    additionalProperties: false,
    properties
  }
}

export function success(schema: string, description: string) {
  return ApiResponse({
    status: 200,
    description,
    schema: { $ref: `#/components/schemas/${schema}` }
  })
}

export function errors(definitions: Record<number, string>) {
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
