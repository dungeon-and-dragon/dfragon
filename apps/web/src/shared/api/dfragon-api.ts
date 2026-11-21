import { createDfragonHttp } from './dfragon-http'

function serverApiBaseUrl(): string {
  const origin = process.env.DFRAGON_API_ORIGIN
  if (origin === undefined) {
    throw new Error('DFRAGON_API_ORIGIN 환경 변수가 없습니다.')
  }

  return origin
}

// 개발 서버(vite.config.ts)와 배포한 사이트는 같은 origin의 /api 경로를 API로 넘긴다.
// 서버 렌더링에는 브라우저 origin이 없어 DFRAGON_API_ORIGIN으로 받은 API를 직접 부른다.
export const API_BASE_URL =
  typeof window === 'undefined' ? serverApiBaseUrl() : `${window.location.origin}/api`

export const dfragonHttp = createDfragonHttp()
