# Internal

저장소 소유자만 쓰는 운영 화면 정적 사이트입니다. `internal.dfragon.com`에 올립니다.

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

`dev` 서버(`http://localhost:5174/`)는 `/api/*` 요청을 경로를 바꾸지 않고 로컬 운영 app(`http://localhost:3444`)으로 넘깁니다. 다른 포트로 띄운 운영 app을 부르려면 `OPS_PORT`를 줍니다. 운영 app은 `PORT`와 DB 설정을 넣어 띄웁니다([운영 app 입력](../ops/README.md)).

```sh
OPS_PORT=3544 pnpm --filter @dfragon/internal dev
```

## 이미지

[`Dockerfile`](Dockerfile)이 `dist`를 [`Caddyfile`](Caddyfile)의 Caddy가 내주는 이미지로 만듭니다. 빌드한 commit은 `SOURCE_COMMIT` 빌드 인자로 받아 `/app/build-info.json`에 남깁니다. 저장소 root에서 배포와 같은 제약으로 띄워 확인합니다.

```sh
podman build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/internal/Dockerfile -t dfragon-internal:local .
podman run --rm --read-only --user 1000:1000 --cap-drop ALL --tmpfs /tmp -p 8080:8080 dfragon-internal:local
```

## 코드 위치

다른 폴더는 `#ops-api/*`, `#ops-components/*`, `#ops-testing/*`, `src/` 바로 아래 파일은 `#ops-app/*` alias로 가져옵니다.
Alias 원본은 `tsconfig.paths.json`이며, 같은 폴더의 파일만 `./` 상대 경로로 가져옵니다.

- `src/OpsScreen.tsx`: 헤더, 수집 대기열, 탭(job 목록과 상세, 타임라인 queue, batch key, 실험실 아이템)을 한 화면에 둡니다.
- `src/ops-queries.ts`: 1초마다 다시 읽는 조회와 실행, 정지, 되돌리기, batch key 요청, 실험실 아이템과 재화의 조회, 저장 요청을 둡니다.
- `src/api/`: 운영 API 요청 함수와 응답 schema를 둡니다.
- `src/components/`: 화면의 표, 상세, 팝오버와 스타일을 둡니다.
- `src/format.ts`: 시각, 걸린 시간, 스케줄, 결과 요약 표시 함수를 둡니다.
- `src/run-args.ts`: 인자 schema로 입력 칸을 정하고 입력값을 인자로 바꿉니다.
- `src/testing/`: 테스트 setup과 운영 API를 흉내 내는 fake를 둡니다.
