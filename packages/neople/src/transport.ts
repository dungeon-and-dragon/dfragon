import ky, {
  SchemaValidationError,
  type SearchParamsOption,
  type StandardSchemaV1,
  type StandardSchemaV1InferOutput,
  isTimeoutError
} from 'ky'
import {
  NeopleRequestFailure,
  classifyNeopleUpstreamFailure,
  neopleStatusFailureKind
} from './failure.js'

export type FetchTransport = (request: Request, init?: RequestInit) => Promise<Response>

export interface TransportDependencies {
  fetch?: FetchTransport
  origin: string
}

export interface RequestOptions {
  searchParams?: SearchParamsOption
  signal?: AbortSignal
}

export interface Transport {
  get<Schema extends StandardSchemaV1>(
    path: string,
    schema: Schema,
    options?: RequestOptions
  ): Promise<StandardSchemaV1InferOutput<Schema>>
}

function readBody(rawBody: string, response: Response): unknown {
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch (error) {
    throw new NeopleRequestFailure(neopleStatusFailureKind(response.status), { cause: error })
  }
  const failure = classifyNeopleUpstreamFailure(body, response.status, response.ok)
  if (failure) {
    throw new NeopleRequestFailure(failure)
  }

  return body
}

export function createTransport(apiKey: string, deps: TransportDependencies): Transport {
  const neople = ky.create({
    baseUrl: deps.origin,
    fetch: deps.fetch,
    headers: { apikey: apiKey },
    redirect: 'error',
    retry: 0,
    throwHttpErrors: false
  })

  return {
    async get(path, schema, options = {}) {
      try {
        return await neople
          .get(path, {
            ...options,
            // Only parseJson sees the response status while ky's .json() keeps its timeout on the body read.
            // Reading response.text() directly after awaiting the request would leave the body unbounded.
            parseJson: (rawBody, { response }) => readBody(rawBody, response)
          })
          .json(schema)
      } catch (error) {
        if (error instanceof NeopleRequestFailure) {
          throw error
        }

        // 검증 issue에 응답 값이 담길 수 있어 원인으로 넘기지 않는다.
        if (error instanceof SchemaValidationError) {
          throw new NeopleRequestFailure('api')
        }

        if (isTimeoutError(error)) {
          throw new NeopleRequestFailure('timeout')
        }
        throw new NeopleRequestFailure('api', { cause: error })
      }
    }
  }
}
