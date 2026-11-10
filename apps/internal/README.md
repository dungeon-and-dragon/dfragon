# Internal

저장소 소유자만 쓰는 운영 화면 정적 사이트입니다. `internal.dfragon.com`에 올리며 배치 job 목록과 실행 이력, 수동 실행, 정기 실행 정지, 타임라인 queue와 수집 대기열을 봅니다. 화면은 같은 origin의 `/api`로 API 운영 포트를 부릅니다.

## 실행과 검증

저장소 루트에서 실행합니다.

```sh
pnpm --filter @dfragon/internal dev
pnpm --filter @dfragon/internal test
pnpm --filter @dfragon/internal lint
pnpm --filter @dfragon/internal build
pnpm --filter @dfragon/internal preview
```

`build`는 `tsc -b`와 Vite production build를 포함하므로 `typecheck`를 따로 실행할 필요가 없습니다. `pnpm verify`는 이 앱의 `test`, `build`를 실행합니다. 산출물은 `dist`에 생깁니다.

`dev` 서버(`http://localhost:5174/`)는 `/api/*` 요청을 경로를 바꾸지 않고 로컬 API 운영 포트(`http://localhost:3444`)로 넘깁니다. 다른 포트로 띄운 API를 부르려면 `OPS_PORT`를 줍니다. API는 `OPS_PORT`와 DB 설정을 넣어 띄우고([API 입력](../api/README.md)), job 이력과 진행률은 캐릭터 목록 worker가 씁니다. `preview`에는 이 proxy가 없어 화면이 비어 있습니다.

```sh
OPS_PORT=3544 pnpm --filter @dfragon/internal dev
```

## 이미지

[`Dockerfile`](Dockerfile)이 `dist`를 [`Caddyfile`](Caddyfile)의 Caddy가 내주는 이미지로 만듭니다. `/api`는 이미지가 아니라 host의 reverse proxy가 API 운영 포트로 넘깁니다. 빌드한 commit은 `SOURCE_COMMIT` 빌드 인자로 받아 `/app/build-info.json`에 남깁니다. 저장소 root에서 배포와 같은 제약으로 띄워 확인합니다.

```sh
docker build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/internal/Dockerfile -t dfragon-internal:local .
docker run --rm --read-only --user 1000:1000 --cap-drop ALL --tmpfs /tmp -p 8080:8080 dfragon-internal:local
```

## 코드 위치

- `src/OpsScreen.tsx`: 헤더, job 목록과 상세, queue, 수집 대기열을 한 화면에 둡니다.
- `src/ops-queries.ts`: 10초마다 다시 읽는 조회와 실행, 정지, 되돌리기 요청을 둡니다.
- `src/api/`: 운영 API 요청 함수와 응답 schema를 둡니다.
- `src/components/`: 화면의 표, 상세, 팝오버와 스타일을 둡니다.
- `src/format.ts`: 시각, 걸린 시간, 스케줄, 결과 요약 표시 함수를 둡니다.
- `src/run-args.ts`: 인자 schema로 입력 칸을 정하고 입력값을 인자로 바꿉니다.
- `src/testing/`: 테스트 setup과 운영 API를 흉내 내는 fake를 둡니다.
- `src/assets/fonts/`: 웹과 같은 Pretendard Variable 글꼴입니다.
