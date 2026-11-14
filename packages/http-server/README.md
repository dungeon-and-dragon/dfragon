# @dfragon/http-server

API의 공개 app과 운영 app이 함께 쓰는 HTTP 코드입니다.
`hono`, `@hono/node-server` 의존성을 이 package가 갖고(`@dfragon/lib`에도 의존), API는 `"@dfragon/http-server": "workspace:*"`로 공개 export만 씁니다.
이 package는 `apps/api`, `@dfragon/database`, `@dfragon/neople`을 import하지 않습니다.

## 파일

| 파일 | 내용 |
| --- | --- |
| `src/hono-app.ts` | 공통 middleware를 붙인 Hono app을 만드는 `createHonoApp`, server 시작과 종료를 감싼 `createHonoAppHandle` |
| `src/app-handle.ts` | `HttpAppHandle` 타입 |
| `src/access-log.ts`, `src/access-log-sink.ts` | access log middleware와 기록 함수, 로그와 code 보고를 쓰는 함수 |
| `src/failure-response.ts` | 실패와 404를 응답으로 바꾸는 함수 |
| `src/common-headers.ts` | `Cache-Control`과 JSON `Content-Type` |

## 검증

```bash
pnpm --filter @dfragon/http-server test
pnpm --filter @dfragon/http-server lint
```

`test`는 `@dfragon/lib`과 이 package를 build한 뒤 `test/*.test.ts`를 compile해 실행합니다.
