import { API_BASE_URL } from '#shared/api/dfragon-api'
import { installBrowserHost } from '#features/capture-search'
import { WebApp } from './WebApp'

// host는 페이지의 붙여넣기 listener를 달기 때문에 모듈을 읽을 때 한 번만 설치한다.
const host = installBrowserHost(API_BASE_URL)

export default function WebClient(): React.JSX.Element {
  return <WebApp host={host} />
}
