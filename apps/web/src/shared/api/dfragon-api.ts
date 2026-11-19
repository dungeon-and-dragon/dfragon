import ky from 'ky'

// 개발 서버(vite.config.ts)와 배포한 사이트는 같은 origin의 /api 경로를 API로 넘긴다.
export const API_BASE_URL = `${window.location.origin}/api`

// 공개 API 요청은 인증, 리다이렉트, 자체 재시도, 브라우저 HTTP 캐시를 쓰지 않고 ky 기본 timeout까지만 기다린다.
export const dfragonHttp = ky.create({
  retry: 0,
  throwHttpErrors: false,
  redirect: 'error',
  credentials: 'omit',
  cache: 'no-store'
})
