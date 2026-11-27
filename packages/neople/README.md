# @dfragon/neople

Neople Open API(`api.neople.co.kr`)와 캐릭터 이미지 서버(`img-api.neople.co.kr`)를 부르는 package입니다.
`ky`, `zod` 의존성을 이 package가 갖고(`@dfragon/lib`에도 의존), API, worker와 `@dfragon/server-core`는 `"@dfragon/neople": "workspace:*"`로 공개 export만 씁니다.
이 package는 `apps/api`를 import하지 않습니다.

## 공개 export

공개 export의 원본은 `src/index.ts`입니다.

- `NeopleRequestFailure`의 `cause`에는 정제하지 않은 원래 오류가 남으므로 응답이나 로그로 그대로 내보내지 않습니다.
- `createNeopleClientForTest`(`fetch`, origin을 바꿈), `createNeopleImageClientForTest`(`fetch`를 바꿈)는 테스트에서만 씁니다. 운영 origin은 고정입니다.

## 검증

```bash
pnpm --filter @dfragon/neople test
```

`test`는 `@dfragon/lib`과 이 package를 build한 뒤 `test/*.test.mjs`를 `dist` 대상으로 실행합니다.
