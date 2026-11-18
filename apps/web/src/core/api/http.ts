import { SEARCH_ERRORS, type SearchError, type SearchErrorCode } from '#core/search/search'

export class SearchHttpFailure extends Error {
  constructor(
    readonly code: SearchErrorCode,
    readonly serverMessage?: string
  ) {
    super(serverMessage ?? SEARCH_ERRORS[code].message)
    this.name = 'SearchHttpFailure'
  }

  toSearchError(): SearchError {
    if (this.serverMessage === undefined) {
      return { code: this.code }
    }

    return { code: this.code, message: this.serverMessage }
  }
}
