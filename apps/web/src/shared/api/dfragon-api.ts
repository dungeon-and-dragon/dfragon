import { createDfragonHttp } from './dfragon-http'

// 개발 서버(vite.config.ts)와 배포한 사이트는 같은 origin의 /api 경로를 API로 넘긴다.
export const API_BASE_URL = `${window.location.origin}/api`

export const dfragonHttp = createDfragonHttp()
