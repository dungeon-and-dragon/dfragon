import { NeopleSearchFailure } from '../../../errors/neople-search.js'
import type { FailureResponse } from '../failure-response.js'

export function characterSearchFailureResponse(error: unknown): FailureResponse {
  if (error instanceof NeopleSearchFailure) {
    return error
  }

  return new NeopleSearchFailure('internal')
}
