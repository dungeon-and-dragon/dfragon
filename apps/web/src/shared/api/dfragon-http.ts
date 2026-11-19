import ky, { type KyInstance } from 'ky'

// 공개 API 요청은 인증, 리다이렉트, 자체 재시도, 브라우저 HTTP 캐시를 쓰지 않고 ky 기본 timeout까지만 기다린다.
// transport를 넘기지 않으면 ky가 요청할 때마다 전역 fetch를 읽어 테스트의 MSW가 가로챈다.
export function createDfragonHttp(transport?: typeof fetch): KyInstance {
  return ky.create({
    fetch: transport,
    retry: 0,
    throwHttpErrors: false,
    redirect: 'error',
    credentials: 'omit',
    cache: 'no-store'
  })
}
