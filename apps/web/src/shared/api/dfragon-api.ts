import { createDfragonHttp } from './dfragon-http'

function serverApiBaseUrl(): string {
  const origin = process.env.DFRAGON_API_ORIGIN
  if (origin === undefined) {
    throw new Error('DFRAGON_API_ORIGIN 환경 변수가 없습니다.')
  }

  return origin
}

// 개발 서버(vite.config.ts)와 배포한 사이트는 같은 origin의 /api 경로를 API로 넘긴다.
// 이미지 주소처럼 브라우저가 여는 주소는 서버 렌더링에서도 이 경로로 만들어야 내부 API 주소가 HTML에 실리지 않는다.
export const BROWSER_API_PATH = '/api'

// 서버 렌더링에는 브라우저 origin이 없어 DFRAGON_API_ORIGIN으로 받은 API를 직접 부른다.
export const API_BASE_URL =
  typeof window === 'undefined'
    ? serverApiBaseUrl()
    : `${window.location.origin}${BROWSER_API_PATH}`

export const dfragonHttp = createDfragonHttp()
