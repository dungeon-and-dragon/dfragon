import { installBrowserHost, WebApp } from '@dfragon/client/web'

const PRODUCTION_API_ORIGIN = 'https://api.dfragon.com'

// 개발 서버는 같은 origin 경로를 운영 API로 넘기므로(vite.config.ts) 운영 API의 CORS 허용 origin 없이도 연다.
const apiOrigin = import.meta.env.DEV ? window.location.origin : PRODUCTION_API_ORIGIN

// host는 페이지의 붙여넣기 listener를 달기 때문에 모듈을 읽을 때 한 번만 설치한다.
const host = installBrowserHost(apiOrigin)

export default function WebClient(): React.JSX.Element {
  return <WebApp host={host} />
}
