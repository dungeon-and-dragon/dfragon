# scripts

저장소에서 반복적으로 사용하는 local 도구입니다. 새 dependency 없이 Node.js와 기존 Git, GitHub CLI, pnpm command를 사용합니다.

서버 이미지 빌드, 실행 입력은 [제품 이미지 안내](../apps/api/README.md#서버-이미지)를 따릅니다. 서버 배포, SSH, timer, 백업, 복구 도구는 그 안내에서 연결한 인프라 저장소가 담당합니다.

## 루트 도구 회귀 검증

`pnpm test:tooling`은 `scripts/test/*.test.mjs`를 모두 실행하며, 어느 테스트든 실패하면 실패합니다. Root `pnpm test`는 [`pnpm verify`](#verify)를 실행합니다.

## `verify`

`pnpm verify`는 저장소 검사를 로컬에서 차례로 실행합니다. GitHub Actions에는 CI 검사가 없으므로 이 명령이 기본 검사이고, Root `pnpm test`도 같은 명령입니다. 명령 목록은 `scripts/verify.mjs`에 있습니다.

```bash
pnpm verify
```

- 의존성은 `pnpm install --frozen-lockfile`로 먼저 설치합니다.
- Web 빌드가 OCR 자산을 만들므로 OCR 모델 submodule(`packages/models/ocr-finetuned`)이 없으면 web job이 실패합니다. `git submodule update --init --recursive`로 받습니다.
- API 테스트 가운데 실제 점수 엔진 계산과 점수 worker를 띄운 종료 확인은 이 플랫폼의 엔진 파일이 `packages/models/score-engine/`에 있을 때만 실행합니다.
- 한 job에서 명령이 실패하면 그 job의 남은 명령을 건너뛰고, 끝에 실패를 모아 출력한 뒤 non-zero로 종료합니다.

`pnpm install`이 설치하는 husky `pre-push` hook이 push 전에 `pnpm verify --reuse-pass`를 실행하고, 실패하면 push가 중단됩니다.
`pnpm verify`가 통과하면 검사한 작업 트리 내용을 기록하고, `--reuse-pass`는 커밋하지 않은 변경이 없고 HEAD 내용이 기록과 같으면 검사를 건너뜁니다.
의존성 설치 상태, `.env`처럼 Git이 무시하는 파일, Node.js 같은 실행 환경은 기록에 들어가지 않으므로 이것만 바꾼 뒤에는 `pnpm verify`를 직접 다시 실행합니다.

로컬 통과는 node1의 이미지 빌드를 대신하지 않습니다. Windows에서는 `node scripts/verify.mjs` 대신 `pnpm verify`로 실행합니다.

## Native validation

로컬 API는 `pnpm --filter @dfragon/api dev`로 실행하며 앱의 `.env`를 읽습니다. 최초 준비는 [API 로컬 실행](../apps/api/README.md#로컬-개발-명령)을 참고합니다.

변경 범위에 맞는 command를 고릅니다. 아래 조합은 workspace 전반의 검사가 필요할 때의 예이며 매 수정의 필수 목록이 아닙니다. [pnpm regex selector와 `--sequential`](https://pnpm.io/cli/run)은 고른 script를 이름순으로 하나씩 실행하고 실패하면 non-zero로 종료합니다.

| 변경 범위 | Repository root에서 실행할 command |
| --- | --- |
| 저장소 전체 | `pnpm verify` |
| API | `pnpm --filter @dfragon/api run --sequential '/^(lint\|test)$/'` |
| Web | `pnpm --filter @dfragon/web run --sequential '/^(test\|lint\|build)$/'` |
| 루트 도구 | `pnpm test:tooling`과 고친 스크립트의 `node --check` |

정적 검사만 실행할 때는 `pnpm check:static`을 씁니다. `lint`, `format:check`, `check:writing`, `check:docs`를 `pnpm verify`와 같은 순서로 실행하고 먼저 실패한 검사에서 멈춥니다.

API의 `test`는 `build`로 `dist`를 새로 만든 뒤 test를 compile, 실행하므로 같은 입력의 typecheck를 따로 반복하지 않아도 됩니다. Web의 `build`는 `tsc -b`로 typecheck한 뒤 Vite production build를 실행합니다. 문서만 바꿨으면 app build를 반복하지 않아도 됩니다.

API 이미지의 실행 계약과 DB를 붙인 실행은 아래 명령으로 검사합니다. Node.js 26, 같은 host의 Docker daemon(Docker Desktop 포함)과 로컬에 있는 Linux 앱 이미지가 필요하고, DB 검사는 PostgreSQL 이미지를 받을 수 있어야 합니다. 이미지는 [제품 이미지 안내](../apps/api/README.md#서버-이미지)로 빌드하거나, 인자를 미리 pull한 이미지 reference로 바꿉니다.

```bash
node apps/api/test-support/container-deployment.mjs dfragon-api:local
node apps/api/test-support/container-database.mjs dfragon-api:local
```

두 검사는 이미지를 빌드하지 않고 합성 Neople key, 합성 비밀번호만 씁니다. 운영 credential은 입력하지 않습니다. 만든 컨테이너와 network는 스스로 지우지만 강제 종료나 Docker 장애 때는 남을 수 있습니다.

## `check-writing`

제품 이름 표기와 사용자 문구의 문체를 검사합니다. 인자가 없으면 Git이 추적하는 파일을 모두 읽고, 경로를 주면 현재 디렉터리 기준으로 그 파일만 검사합니다. 이진 파일과 submodule은 건너뜁니다.
위반은 `경로:줄: 규칙: 내용`으로 출력하고 non-zero로 종료합니다. `pnpm verify`가 `pnpm check:writing`을 실행합니다.

```bash
pnpm check:writing
node scripts/check-writing.mjs apps/web/README.md
```

## `check-docs`

`*.md`의 상대 링크가 저장소의 파일, 디렉터리를 가리키는지와 `#anchor`가 대상 문서의 heading과 맞는지 검사합니다. Anchor는 GitHub와 같은 규칙으로 만듭니다.
Code span 전체가 `apps/`, `packages/`, `.github/`로 시작하는 저장소 경로이면 그 경로가 있는지도 봅니다. 외부 URL, code block 안의 링크, glob과 플레이스홀더는 검사하지 않습니다.
위반은 `경로:줄: 규칙: 링크나 경로`로 출력하고 non-zero로 종료합니다. `pnpm verify`가 `pnpm check:docs`를 실행합니다.

```bash
pnpm check:docs
```

## `statement-spacing`

공통 Biome 포맷 뒤에 실행하는 문장 간격 도구입니다. Biome가 하지 않는 `return` 앞과 연속된 블록 `if` 사이의 빈 줄만 더합니다.
Root와 각 workspace의 `format`, `format:check`가 Biome 다음에 실행하므로 따로 부르지 않습니다. 에디터의 Biome 포맷은 이 빈 줄을 더하지 않으니 `pnpm format`으로 적용합니다. Biome를 갱신하거나 정책을 바꾸면 아래를 실행합니다.

```sh
pnpm test:format-policy
```

## Biome lint 플러그인

`scripts/biome/`의 GritQL 플러그인 여섯 개(`return-expression`, `regex-literal-constant`, `let-branch-assignment`, `hidden-screen-prop`, `jsx-prop-callback`, `absent-first-conditional`)를 root `biome.json`이 등록하며 `pnpm lint`가 실행합니다.

## `start-task`

Issue 기반 branch와 worktree를 한 번에 준비하는 선택 도구입니다. 일반 개발의 선행 조건이 아닙니다. Git와 인증된 GitHub CLI가 필요합니다.

```bash
node scripts/start-task.mjs <project> <Issue 번호> <description> <새 worktree 경로>
node scripts/start-task.mjs api 123 fix-character-search ../dfragon-worktrees/api-123-fix-character-search
```

`project`는 `api`, `web`, `ui`, `cross`, `repo` 가운데 하나입니다. 같은 이름의 branch나 경로가 이미 있으면 거절합니다.

## `format-date`

UTC ISO 시각을 한국 시간(`Asia/Seoul`)의 `2026년 9월 9일 00시 35분` 형식으로 출력합니다. 인자를 생략하면 현재 시각을 씁니다.

```bash
node scripts/format-date.mjs '2026-09-08T15:35:00Z'
```

## `dependency-snapshot`

[`dependency-snapshot.yml`](../.github/workflows/dependency-snapshot.yml)이 main의 의존성 변경을 Dependabot alerts에 반영하려고, pnpm의 CycloneDX SBOM을 GitHub Dependency submission snapshot으로 바꿀 때 씁니다. 저장소 검사가 아닙니다.

```bash
node scripts/dependency-snapshot.mjs <cyclonedx-sbom-file> <snapshot-file>
```

## `server-build-info`

Docker 빌드에서 제품 commit과 서비스명(`api`, `web`)을 고정 JSON 파일로 기록합니다. 빈 SHA를 주면 `commit: null`을 기록합니다.

```sh
node scripts/server-build-info.mjs api "$(git rev-parse HEAD)" build-info.json
```

실행 중인 서버 조회는 [제품 이미지 안내](../apps/api/README.md#실행-중인-서버의-버전-조회)를 참고합니다.

## `create-app`

`apps/<app-name>`에 새 애플리케이션 workspace를 만듭니다. 패키지명은 `@dfragon/<app-name>` 형식이고, 기존 디렉터리가 있으면 만들지 않습니다. 비어 있는 `dev`, `build`, `test` script는 생성 뒤 채웁니다.

```bash
pnpm create-app --name @dfragon/party-api
```
