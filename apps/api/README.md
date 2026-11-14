# 던삐삐 API

`apps/api`는 로그인 없는 공개 캐릭터 API(Hono)입니다. Neople API에서 조회한 캐릭터는 API 메모리에 1시간, 공용 아이템 정보는 24시간 캐시하며, 캐시는 노드마다 따로 둡니다.
DB 설정이 있으면 상세 조회한 캐릭터의 타임라인과 기본 정보를 PostgreSQL에 저장하고, 모험단, 길드, 랭킹, 통계 경로가 저장한 값을 읽습니다.
같은 이미지의 캐릭터 수집 worker(`dist/character-collector.js`)는 캐릭터 목록 파일에 있는 캐릭터의 기본 정보를 DB에 쌓습니다.
배치 job도 이 worker에서 돕니다. Job 정의와 실행 흐름은 `src/application/jobs/`, 예약과 알림은 `src/infrastructure/jobs/`, 실행 이력 DB adapter는 `src/infrastructure/database/`에 있고, worker가 돌릴 job은 `src/runtime/worker-jobs.ts`에 등록합니다.

## 코드 위치

`src/`는 계층 폴더로 나눕니다(ADR 0047, ADR 0057).
`src/` 바로 아래에는 진입 파일 `main.ts`, `character-collector.ts`와 다섯 계층 폴더만 둡니다.
진입 파일은 설정과 runtime을 연결하며, build 뒤 `dist/main.js`, `dist/character-collector.js`로 실행합니다.
계층 폴더 사이의 import 방향과 계층 밖 파일은 `pnpm lint`가 `src/` 전체에서 검사합니다.
앱을 만드는 `src/runtime/api-app.ts`가 route를 모으는 파일(`src/runtime/routes/`), 공개 app의 조립 함수(`src/runtime/api-services.ts`)가 아닌 기능 파일을 import하는 것도 `pnpm lint`가 막습니다.
운영 경로는 [운영 app](../ops/README.md)에 있습니다.

| 폴더 | 담는 것 |
| --- | --- |
| `src/main.ts`, `src/character-collector.ts` | API와 캐릭터 수집 worker의 진입 파일 |
| `src/domain/<기능>/` | 순수 계산, 표, 타입, 실패 종류 |
| `src/application/<기능>/` | Service, Service가 받는 Repository interface와 DB가 아닌 의존성의 함수 타입(port) |
| `src/infrastructure/neople/`, `src/infrastructure/database/`, `src/infrastructure/score/`, `src/infrastructure/jobs/`, `src/infrastructure/files/` | Repository와 port를 Neople 호출, DB 읽기와 쓰기, 점수 엔진, job 예약과 알림, 파일 읽기로 구현한 adapter |
| `src/presentation/http/` | Controller, 요청과 응답 DTO, 실패를 HTTP 응답으로 바꾸는 표 |
| `src/runtime/` | 설정 읽기, 외부 client 생성, 앱 조립, worker의 job 목록 |
| `src/runtime/api-services.ts` | 공개 app의 service, 타임라인 queue, 점수 엔진 조립과 종료 순서 |
| `src/runtime/routes/` | 기능의 Controller에 Service를 넘겨 공개 app에 붙이는 함수(`api.ts`) |

기능을 하나 더하면 아래 파일을 만듭니다.
기능 폴더(`domain/<기능>/`, `application/<기능>/`, `presentation/http/<기능>/`) 안의 파일은 역할 이름으로, 여러 기능을 담는 폴더(`infrastructure/neople/`, `infrastructure/database/` 등) 안의 파일은 기능 이름으로 짓습니다.

| 파일 | 내용 |
| --- | --- |
| `src/domain/<기능>/<내용>.ts` | 계산, 표, 타입. 이름은 담은 내용으로 짓습니다(예: `grade.ts`, `items.ts`) |
| `src/domain/<기능>/failure.ts` | 실패 class와 실패 종류 |
| `src/application/<기능>/service.ts` | 판단, 조합과 실패 종류를 던지는 `<기능>Service` class. constructor는 Repository, port 순서로 받습니다 |
| `src/application/<기능>/repository.ts` | Service가 받는 DB 읽기와 쓰기 `<기능>Repository` interface |
| `src/application/<기능>/ports.ts` | Neople 호출, queue처럼 DB가 아닌 의존성의 함수 타입 |
| `src/infrastructure/database/<기능>.ts` | `@dfragon/database` 함수를 부르는 `Database<기능>Repository` class |
| `src/infrastructure/neople/<기능>.ts` | port의 Neople 구현 |
| `src/presentation/http/<기능>/dto.ts` | 요청 zod schema와 `z.infer` type, 응답 type과 `to<X>Response` 함수 |
| `src/presentation/http/<기능>/controller.ts` | Service를 받아 `routes()`로 기능의 route 묶음을 만드는 `<기능>Controller` class |
| `src/presentation/http/<기능>/failures.ts` | 실패 종류를 status, `error.code`, `error.message`로 바꾸는 표 |
| `src/runtime/api-services.ts` | 공개 app 기능의 Service를 만들어 `services`에 더합니다. 닫을 것이 있으면 종료 순서에 더합니다 |
| `src/runtime/routes/api.ts` | 기능의 Controller를 만들어 공개 app의 경로에 붙입니다 |

모험단, 길드 조회(`adventure-guild`), 캐릭터 검색(`character-search`), 캐릭터 상세(`character-detail`), 캐릭터 카탈로그(`character-catalog`), 캐릭터 이미지(`character-image`), 오늘의 등급(`today-grade`), 캐릭터 타임라인(`character-timeline`), 캐릭터 기본 정보 기록(`character-basic`)이 이 형태입니다.
worker의 job 실행과 예약, 실행 이력 정리(`jobs`), 클리어 기록 수집과 지난 기록 받기(`content-clears`), 통계 job과 스킬 스타일 수집(`ranking-stats`), 점수 계산(`character-score`)도 Controller와 DTO 없이 Service, Repository class 형태이며, Service는 기존 use case 파일에 두고 job 정의(`defineJob`)의 `run`이 Service를 부릅니다.
나머지 기능은 아직 `create<기능>Service`, `create<기능>Routes` 함수와 `ports.ts`의 Store, Reader 형태로 남아 있습니다.

여러 기능이 함께 쓰는 코드는 `src/presentation/http/disconnected-request.ts`처럼 그 계층 폴더 바로 아래에 둡니다.
여러 기능이 함께 쓰는 실패는 `src/domain/character-failure.ts`처럼 종류만 두고, 응답 표는 `src/presentation/http/character-failures.ts`처럼 둡니다.
두 앱이 함께 쓰는 access log, 404와 실패 응답, 공통 header, 공통 middleware 등록과 server 시작, 종료는 [`@dfragon/http-server`](../../packages/http-server/README.md)에 있습니다.
오류 chain 정제는 `@dfragon/lib/error-chain`, 빌드 정보 읽기는 `src/infrastructure/build-info.ts`, 버전 route는 `src/presentation/http/version/routes.ts`에 있습니다.
캐릭터 목록 수집 흐름과 port는 `src/application/character-collection/`, Neople과 DB adapter는 `src/infrastructure/neople/character-collection.ts`, `src/infrastructure/database/character-collection.ts`, 파일 읽기는 `src/infrastructure/files/character-collection.ts`에 있습니다.
Worker 설정과 연결은 `src/runtime/collector-configuration.ts`, `src/runtime/character-collector.ts`에 있습니다.
Worker가 batch Neople key마다 요청을 나눠 보내는 코드는 `src/infrastructure/neople/batch-key-pool.ts`에 있습니다.

## 준비할 입력

`.env.example`을 앱의 `.env`로 복사해 채웁니다. 실제 secret은 Git 밖에서 관리하고, 운영 credential을 개발에 쓰지 않습니다.

| 입력 | 필수 | 내용 |
| --- | --- | --- |
| `PORT` | 필수 | ASCII 십진 정수 1~65535 |
| `NEOPLE_API_KEY` 또는 `NEOPLE_API_KEY_FILE` | 필수 | Neople key 직접 입력 또는 key 파일의 절대 경로 |
| `LOCAL_HTTPS_CERT_FILE`, `LOCAL_HTTPS_KEY_FILE`, `API_ORIGIN` | 로컬 개발 | [로컬 개발 명령](#로컬-개발-명령) 참고 |
| `SCORE_LIBRARY_FILE` | 선택 | 점수 엔진 라이브러리(macOS `libdnfscore.dylib`, Linux `libdnfscore.so`)의 절대 경로. API는 없으면 점수 없이 실행하고, 캐릭터 수집 worker는 없으면 점수 계산 job만 실패로 끝냅니다 |
| `SCORE_CALCULATION_SCHEDULE` | 선택 | 캐릭터 수집 worker의 점수 계산 job 일정(Asia/Seoul cron 식). 없으면 수요일 22:00입니다 |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` 또는 `DB_PASSWORD_FILE` | 선택 | [DB와 migration](#db와-migration) 참고 |
| `JOB_ALERT_DISCORD_WEBHOOK_URL` 또는 `JOB_ALERT_DISCORD_WEBHOOK_URL_FILE` | 선택 | 캐릭터 수집 worker가 job 알림을 보낼 Discord 웹훅 https URL. 없으면 알림 없이 실행합니다 |

Secret은 직접 입력과 `_FILE` 가운데 하나만 지정합니다. 둘 다 지정하거나 빈 값, 상대 경로, 읽을 수 없는 파일이면 값과 경로 없이 시작 전에 실패합니다.
파일은 UTF-8로 읽고 끝의 줄바꿈을 뺍니다. DB 비밀번호는 끝의 공백까지 뺍니다. 값을 바꾸면 앱을 다시 시작합니다.
로컬 점수 엔진은 [`@dfragon/models` 안내](../../packages/models/README.md)대로 직접 빌드한 파일을 지정합니다.

## DB와 migration

DB는 선택입니다. DB 입력 다섯 개를 모두 지정하면 PostgreSQL을 쓰고, 모두 생략하면 DB 없이 뜹니다. 일부만 지정하면 시작 전에 실패합니다.
DB 설정이 있으면 listen 전에 [`@dfragon/database`](../../packages/database/README.md)가 적용하지 않은 migration을 적용합니다(ADR 0014). Migration은 `public` schema 안에서만 합니다.
연결, 인증, migration이 실패하면 `API failed to start`와 nonzero exit로 끝나고 `/health`를 열지 않습니다.
시작 경로는 Prisma 출력을 버리므로, 원인은 같은 DB 설정으로 `@dfragon/database`의 `db:migrate:status`, `db:migrate:deploy`를 실행해 봅니다.
Migration 파일, 설정 읽기와 CLI는 `packages/database`에 있습니다.

## 로컬 개발 명령

API는 `https://localhost:3443`을 사용합니다.

```sh
pnpm --filter @dfragon/api dev
```

`LOCAL_HTTPS_CERT_FILE`, `LOCAL_HTTPS_KEY_FILE`을 신뢰한 localhost 인증서의 절대 경로로, `API_ORIGIN`을 `https://localhost:3443`으로 지정합니다.
TLS 파일의 key 일치와 localhost, port 입력은 listen 전에 확인하며 client의 신뢰 체인 검증을 끄지 않습니다.
별도 Node client는 실행 전 `NODE_EXTRA_CA_CERTS`에 개발 CA의 공개 certificate를 지정하고, 브라우저는 OS 인증서 신뢰를 씁니다.
`build` 뒤 `start`로 compiled ESM entry를 실행할 수도 있습니다.

## 테스트

```sh
pnpm --filter @dfragon/api test
```

HTTP, 설정과 build를 검증합니다. `packages/models/score-engine/`에 엔진 라이브러리가 없으면 실제 엔진 계산과 점수 worker를 띄운 종료 확인만 건너뜁니다.
변경 범위별 명령 조합은 [Native validation](../../scripts/README.md#native-validation)을 따릅니다. 로컬 성공은 실제 DNS, TLS 검증을 대신하지 않습니다.

## 서버 이미지

API 이미지는 node1이 운영자가 고른 main commit을 빌드해 배포합니다. 제품 main merge는 이미지를 빌드하거나 배포하지 않습니다.
빌드, 배포 절차와 이미지 이름, 비밀값 전달, Compose, 서버 권한은 [인프라 운영 안내](https://github.com/dungeon-and-dragon/dfragon-infra/blob/main/deploy/linux/README.md)를 따릅니다.

로컬 빌드는 [엔진 라이브러리를 직접 빌드해](../../packages/models/README.md) `packages/models/score-engine/libdnfscore.so`에 둔 뒤 실행합니다. 엔진 파일이 없으면 빌드에 실패합니다.

```sh
docker build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/api/Dockerfile -t dfragon-api:local .
```

`SOURCE_COMMIT`을 생략한 이미지는 commit 정보 없이(`commit: null`) 만들어집니다. 비밀값은 빌드 인자나 Dockerfile `ENV`로 넣지 않습니다.

이미지는 UID/GID `1000:1000`으로 실행하며 다음 입력을 받습니다.

- `PORT`(운영은 3000)는 반드시 지정합니다. `EXPOSE 3000`은 기본값이 아닙니다.
- Neople key는 직접 입력이나 `_FILE`로 받고, 둘 다 생략하면 `/run/secrets/neople_api_key`를 읽습니다.
- DB 설정은 선택입니다. `DB_HOST`를 지정하고 비밀번호 입력을 둘 다 생략하면 `/run/secrets/db_password`를 읽습니다.
- 기본 CMD는 API(`node dist/main.js`)이고, 캐릭터 수집 worker는 CMD를 `node dist/character-collector.js`로 바꿔 실행합니다.

### 실행 중인 서버의 버전 조회

`GET /version`은 서비스명과 이미지에 고정한 제품 commit을 `{"service":"api","commit":"<40자리 SHA>"}`로 돌려줍니다.
`GET /health`는 200과 `{"status":"ok"}`로 HTTP 시작만 알립니다.

### 컨테이너 검사

로컬 이미지로 이미지 실행 계약과 DB를 붙인 실행을 검사합니다. DB 검사는 [운영 app 이미지](../ops/README.md#서버-이미지)도 함께 띄웁니다.

```sh
node apps/api/test-support/container-deployment.mjs dfragon-api:local
node apps/api/test-support/container-database.mjs dfragon-api:local dfragon-ops:local
```

## 비공개 스킬 패키지 검증

`pnpm --filter @dfragon/api verify:skills`는 별도로 설치한 비공개 스킬 패키지로 실제 캐릭터의 스킬 계수, 쿨타임을 계산해 보는 선택 명령입니다.
서버를 시작하지 않고 DB를 쓰지 않습니다. 비공개 패키지는 dependency와 lockfile에 넣지 않으며, 일반 `test`는 합성 입력으로만 검사합니다.
