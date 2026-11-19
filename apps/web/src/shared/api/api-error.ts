type SearchErrorDefinition = Readonly<{ message: string }>

export const SEARCH_ERRORS = {
  INVALID_SEARCH_QUERY: { message: '검색 조건을 확인해 주세요.' },
  SEARCH_RATE_LIMITED: { message: '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
  INTERNAL_SERVER_ERROR: { message: '서버 오류로 검색을 처리하지 못했습니다.' },
  CHARACTER_NOT_FOUND: { message: '캐릭터를 찾을 수 없습니다. 서버와 캐릭터 ID를 확인해 주세요.' },
  NEOPLE_API_ERROR: { message: '캐릭터 검색 중 오류가 발생했습니다.' },
  NEOPLE_UNAVAILABLE: {
    message: '현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  },
  NEOPLE_TIMEOUT: { message: '캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.' },
  SEARCH_TIMEOUT: { message: '검색 시간이 초과됐습니다. 다시 시도해 주세요.' },
  SEARCH_NETWORK_ERROR: { message: '검색 서버에 연결하지 못했습니다. 다시 시도해 주세요.' },
  SEARCH_RESPONSE_INVALID: { message: '검색 응답을 확인하지 못했습니다. 다시 시도해 주세요.' }
} as const satisfies Record<string, SearchErrorDefinition>

export type SearchErrorCode = keyof typeof SEARCH_ERRORS
/** `message`는 API가 오류 응답에 담아 보낸 문구다. 응답을 받지 못한 실패에는 없다. */
export type SearchError = Readonly<{ code: SearchErrorCode; message?: string }>

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
