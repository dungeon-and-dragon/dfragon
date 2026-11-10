# 던삐삐 API

`apps/api`는 로그인 없는 공개 캐릭터 API(NestJS)입니다. Neople API에서 조회한 캐릭터는 API 메모리에 1시간, 공용 아이템 정보는 24시간 캐시하며, 캐시는 노드마다 따로 둡니다.
DB 설정이 있으면 상세 조회한 캐릭터의 타임라인과 기본 정보를 PostgreSQL에 저장하고, 모험단, 길드, 랭킹, 통계 경로가 저장한 값을 읽습니다.
같은 이미지의 캐릭터 수집 worker(`dist/character-collector.js`)는 캐릭터 목록 파일에 있는 캐릭터의 기본 정보를 DB에 쌓습니다.
배치 job도 이 worker에서 돕니다. Job 실행 틀은 `src/jobs/`에 있고, worker가 돌릴 job은 `src/jobs/worker-jobs.ts`에 등록합니다.
API 계약은 실행 중인 서버의 `/docs`, `/docs/openapi.json`에 있습니다.

## 코드 위치

`src/`는 계층 폴더로 나눕니다(ADR 0047).
오늘의 등급이 이 구조로 옮긴 첫 기능이고, `characters/`, `adventure-guild/` 같은 나머지 기능 폴더는 차례로 옮깁니다.
계층 폴더 사이의 import 방향은 `pnpm lint`가 검사하며, 옮기지 않은 기능 폴더는 검사하지 않습니다.
앱을 만드는 `src/http.ts`(공개 API)와 `src/ops/app.ts`(운영 포트)가 기능의 module이 아닌 파일을 import하는 것도 `pnpm lint`가 막습니다.

| 폴더 | 담는 것 |
| --- | --- |
| `src/main.ts`, `src/character-collector.ts` | API와 캐릭터 수집 worker의 진입 파일 |
| `src/domain/<기능>/` | 순수 계산, 표, 타입, 실패 종류 |
| `src/application/<기능>/` | service(use case)와 service가 받는 함수 타입(port) |
| `src/infrastructure/neople/`, `src/infrastructure/database/`, `src/infrastructure/score/` | port를 Neople 호출, DB 읽기와 쓰기, 점수 엔진으로 구현한 adapter |
| `src/presentation/http/` | controller, 요청 파싱, 실패를 HTTP 응답으로 바꾸는 표 |
| `src/presentation/openapi/` | 기능별 Swagger 설명과 schema |
| `src/presentation/events/` | 이벤트 구독자 |
| `src/runtime/` | 설정 읽기, 외부 client 생성, 앱 조립 |
| `src/runtime/modules/` | 기능별 Nest module |

기능을 하나 더하면 아래 파일을 만듭니다.
기능 폴더(`domain/<기능>/`, `application/<기능>/`, `presentation/http/<기능>/`) 안의 파일은 역할 이름으로, 여러 기능을 담는 폴더(`infrastructure/neople/`, `presentation/openapi/`, `runtime/modules/` 등) 안의 파일은 기능 이름으로 짓습니다.

| 파일 | 내용 |
| --- | --- |
| `src/domain/<기능>/<내용>.ts` | 계산, 표, 타입. 이름은 담은 내용으로 짓습니다(예: `grade.ts`, `items.ts`) |
| `src/domain/<기능>/failure.ts` | 실패 class와 실패 종류 |
| `src/application/<기능>/service.ts` | service를 만드는 `create<기능>Service` |
| `src/application/<기능>/ports.ts` | service가 받는 함수 타입 |
| `src/infrastructure/neople/<기능>.ts`, `src/infrastructure/database/<기능>.ts` | port의 구현 |
| `src/presentation/http/<기능>/controller.ts` | controller와 service 주입 token |
| `src/presentation/http/<기능>/failures.ts` | 실패 종류를 status, `error.code`, `error.message`로 바꾸는 표 |
| `src/presentation/openapi/<기능>.ts` | 경로 설명 decorator와 schema. schema 묶음은 `src/presentation/openapi/index.ts`의 목록에 더합니다 |
| `src/runtime/modules/<기능>.ts` | 기능의 Nest module. 앱을 만드는 `src/http.ts`나 `src/ops/app.ts`의 `imports`에 등록합니다 |

여러 기능이 함께 쓰는 코드는 `src/presentation/http/failure-response.ts`, `src/presentation/openapi/common.ts`처럼 그 계층 폴더 바로 아래에 둡니다.
여러 기능이 함께 쓰는 실패는 `src/domain/character-failure.ts`처럼 종류만 두고, 응답 표는 `src/presentation/http/character-failures.ts`처럼 둡니다.
두 앱이 함께 쓰는 access log, `Cache-Control` 설정과 전역 예외 filter 등록은 `src/runtime/http-app.ts`에 있고, 404와 실패 응답을 만드는 filter는 `src/presentation/http/failure-response.ts`에 있습니다.

## 준비할 입력

`.env.example`을 앱의 `.env`로 복사해 채웁니다. 실제 secret은 Git 밖에서 관리하고, 운영 credential을 개발에 쓰지 않습니다.

| 입력 | 필수 | 내용 |
| --- | --- | --- |
| `PORT` | 필수 | ASCII 십진 정수 1~65535 |
| `NEOPLE_API_KEY` 또는 `NEOPLE_API_KEY_FILE` | 필수 | Neople key 직접 입력 또는 key 파일의 절대 경로 |
| `LOCAL_HTTPS_CERT_FILE`, `LOCAL_HTTPS_KEY_FILE`, `API_ORIGIN` | 로컬 개발 | [로컬 개발 명령](#로컬-개발-명령) 참고 |
| `SCORE_LIBRARY_FILE` | 선택 | 점수 엔진 라이브러리(macOS `libdnfscore.dylib`, Linux `libdnfscore.so`)의 절대 경로. 없으면 점수 없이 실행합니다 |
| `SEARCH_TRUST_PROXY` | 선택 | 단일 신뢰 proxy 뒤에서만 `single-hop` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` 또는 `DB_PASSWORD_FILE` | 선택 | [DB와 migration](#db와-migration) 참고 |
| `OPS_PORT` | 선택 | 운영 경로(`/api/jobs`)를 여는 별도 포트. DB 설정이 있어야 하고 `PORT`와 달라야 합니다. 없으면 열지 않습니다 |
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
- `SEARCH_TRUST_PROXY`는 생략하거나 단일 proxy 구성에서만 `single-hop`을 씁니다.
- `OPS_PORT`는 선택입니다. 운영 경로에는 로그인이 없으므로 이 포트를 공개 인터넷에 열지 않습니다.
- 기본 CMD는 API(`node --import reflect-metadata dist/main.js`)이고, 캐릭터 수집 worker는 CMD를 `node dist/character-collector.js`로 바꿔 실행합니다.

### 실행 중인 서버의 버전 조회

`GET /version`은 서비스명과 이미지에 고정한 제품 commit을 `{"service":"api","commit":"<40자리 SHA>"}`로 돌려줍니다.
`GET /health`는 200과 `{"status":"ok"}`로 HTTP 시작만 알립니다.

### 컨테이너 검사

로컬 이미지로 이미지 실행 계약과 DB를 붙인 실행을 검사합니다.

```sh
node apps/api/test-support/container-deployment.mjs dfragon-api:local
node apps/api/test-support/container-database.mjs dfragon-api:local
```

## 비공개 스킬 패키지 검증

`pnpm --filter @dfragon/api verify:skills`는 별도로 설치한 비공개 스킬 패키지로 실제 캐릭터의 스킬 계수, 쿨타임을 계산해 보는 선택 명령입니다.
서버를 시작하지 않고 DB를 쓰지 않습니다. 비공개 패키지는 dependency와 lockfile에 넣지 않으며, 일반 `test`는 합성 입력으로만 검사합니다.
