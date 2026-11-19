import { API_BASE_URL } from '#shared/api/dfragon-api'
import { installBrowserHost } from './host'
import { WebApp } from './WebApp'

// 서약 데이터는 사이트 빌드에 넣지 않고 따로 올리며, host Caddy와 개발 서버가 같은 origin의 /skilltab/ 아래에 내준다.
const oathCatalogUrl = `${window.location.origin}/skilltab/oath.v2.json`

// host는 페이지의 붙여넣기 listener를 달기 때문에 모듈을 읽을 때 한 번만 설치한다.
const host = installBrowserHost(API_BASE_URL, oathCatalogUrl)

export default function WebClient(): React.JSX.Element {
  return <WebApp host={host} />
}
