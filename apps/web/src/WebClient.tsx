import { installBrowserHost, WebApp } from '@dfragon/client/web'

const PRODUCTION_API_ORIGIN = 'https://api.dfragon.com'

// 개발 서버(vite.config.ts)와 Worker(worker/index.ts)는 같은 origin의 /api 경로를 운영 API로 넘기므로, 운영 API의
// CORS 허용 origin이 아닌 주소(workers.dev)에 올린 빌드도 연다.
const proxiesApiFromSameOrigin =
  import.meta.env.DEV || import.meta.env.VITE_SAME_ORIGIN_API === 'true'
const apiBaseUrl = proxiesApiFromSameOrigin
  ? `${window.location.origin}/api`
  : PRODUCTION_API_ORIGIN

// 스킬 창과 서약 데이터는 사이트 빌드에 넣지 않고 따로 올리며, Worker와 개발 서버가 같은 origin의 /skilltab/ 아래에 내준다.
const skillWindowCatalogUrl = `${window.location.origin}/skilltab/skilltab.json`
const oathCatalogUrl = `${window.location.origin}/skilltab/oath.json`

// host는 페이지의 붙여넣기 listener를 달기 때문에 모듈을 읽을 때 한 번만 설치한다.
const host = installBrowserHost(apiBaseUrl, skillWindowCatalogUrl, oathCatalogUrl)

export default function WebClient(): React.JSX.Element {
  return <WebApp host={host} />
}
