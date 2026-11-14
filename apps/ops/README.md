# 던삐삐 운영 app

`apps/ops`는 운영 화면(`apps/internal`)이 부르는 job, 타임라인 queue 현황, 수집 대기열, batch Neople key 경로(`/api/*`)를 내는 Hono app입니다.
로그인이 없으므로 공개 인터넷에 열지 않습니다.

## 코드 위치

`src/`는 API와 같은 계층 폴더로 나눕니다(ADR 0047, ADR 0057).
기능(`jobs`, `queues`, `collection`, `batch-neople-keys`)마다 아래 파일을 둡니다.
계층 사이의 import 방향과 presentation의 Repository import는 `pnpm lint`가 막습니다.

| 역할 | 파일 | 내용 |
| --- | --- | --- |
| DTO | `src/presentation/http/<기능>/dto.ts` | 요청 zod schema와 `z.infer` type, 응답 type과 `to<X>Response` 함수 |
| Controller | `src/presentation/http/<기능>/controller.ts` | `<기능>Controller`. `routes()`가 Hono route 묶음을 만듭니다 |
| Service | `src/application/<기능>/service.ts` | `<기능>Service`. 쪽 나누기, 기본값, 실패 종류 던지기 |
| Repository 계약 | `src/application/<기능>/repository.ts` | Service가 받는 `<기능>Repository` interface |
| Repository 구현 | `src/infrastructure/database/<기능>.ts` | `@dfragon/database` 함수를 부르는 `Database<기능>Repository` |

여러 기능이 함께 쓰는 실패 종류는 `src/domain/failure.ts`, 실패 응답 표는 `src/presentation/http/failures.ts`, JSON 본문 검사와 읽기는 `src/presentation/http/json-request.ts`에 있습니다.
`src/runtime/application.ts`가 Repository를, `src/runtime/routes/ops.ts`가 Service와 Controller를 `new`로 만들어 경로에 붙입니다.

## 입력

| 입력 | 필수 | 내용 |
| --- | --- | --- |
| `PORT` | 필수 | ASCII 십진 정수 1~65535 |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` 또는 `DB_PASSWORD_FILE` | 필수 | [API의 DB 입력](../api/README.md#db와-migration)과 같습니다 |

## 로컬 개발 명령

```bash
pnpm --filter @dfragon/ops dev
```

`.env.example`을 앱의 `.env`로 복사해 채웁니다. `dev`는 build 뒤 `.env`를 읽어 `dist/main.js`를 실행합니다.
운영 화면 dev 서버는 `http://localhost:3444`로 요청을 넘기므로([운영 화면 안내](../internal/README.md)), 로컬에서는 `PORT=3444`로 띄웁니다.

## 검증

```bash
pnpm --filter @dfragon/ops run --sequential '/^(lint|test)$/'
```

`test`는 `build`로 `dist`를 새로 만든 뒤 test를 compile, 실행합니다.

## 서버 이미지

운영 app 이미지는 node1이 운영자가 고른 main commit을 빌드해 배포합니다.
빌드, 배포 절차는 [인프라 운영 안내](https://github.com/dungeon-and-dragon/dfragon-infra/blob/main/deploy/linux/README.md)를 따릅니다.

```sh
docker build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/ops/Dockerfile -t dfragon-ops:local .
```

이미지는 UID/GID `1000:1000`으로 실행합니다.
`DB_HOST`를 지정하고 비밀번호 입력을 둘 다 생략하면 `/run/secrets/db_password`를 읽습니다.
실제 PostgreSQL을 붙인 검사는 [API 컨테이너 검사](../api/README.md#컨테이너-검사)가 API 이미지와 함께 실행합니다.
