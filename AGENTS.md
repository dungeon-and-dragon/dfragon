# 던삐삐 저장소 안내

누가 작업하든 참인 저장소 사실만 적는다. 개인 작업 습관은 각자 로컬 지침에서 관리한다.

## 먼저 읽을 곳

- [문서 안내](docs/README.md): 주제별 제품 계약(Rule)과 결정 기록(ADR)
- 각 app, package의 README와 `package.json`: 구조, 표준 명령, 실행 안내
- [scripts 안내의 Native validation](scripts/README.md#native-validation): 로컬 실행과 변경 범위별 검증 명령

## 설치

- Node.js 26(root `package.json`의 `devEngines.runtime`이 고정한 버전을 pnpm이 내려받아 script에 쓴다. API의 `engines`는 `>=26.11.1 <27`)과 pnpm 12.11.2(root `package.json`의 `packageManager`)를 쓴다.
- 의존성은 `pnpm install --frozen-lockfile`로 설치한다.
- `pnpm verify`의 Web 빌드는 OCR 모델 submodule(`packages/models/ocr-finetuned`)이 있어야 통과한다. 점수 엔진 submodule(`packages/models/score-engine`)은 API 이미지만 쓰며, 받지 않으면 API 테스트 가운데 실제 엔진 계산과 점수 worker를 띄운 종료 확인만 건너뛴다. 둘 다 받으려면 `git submodule update --init --recursive`를 실행한다.

## 검증

- GitHub Actions에는 CI 검사 workflow가 없다. 검사는 로컬에서 실행한다.
- `pnpm verify`가 저장소 검사를 차례로 실행한다. Root `pnpm test`도 `pnpm verify`를 실행한다.
- `pnpm install`이 husky `pre-push` hook을 설치하며, hook이 push 전에 `pnpm verify --reuse-pass`를 실행한다. 같은 내용을 직접 `pnpm verify`로 통과한 직후면 다시 검사하지 않는다. Product Images는 PR 제목 scope가 `(build)`일 때만 빌드한다. 규칙은 [scripts 안내의 build-scope](scripts/README.md#build-scope)에 있다.
- 변경 범위별 명령 조합은 [Native validation](scripts/README.md#native-validation), 준비 조건은 [`verify` 안내](scripts/README.md#verify)를 따른다.

## 작업 경계

- main은 ruleset에 따라 PR로만 바꾼다. 작업 브랜치에서 PR을 열고, PR merge는 저장소 소유자가 하거나 소유자가 허락한 PR을 에이전트가 대신 한다. 에이전트는 ruleset이 요구하는 check가 있으면 현재 PR head에서 통과했을 때만 merge하며, 관리자 권한으로 ruleset을 건너뛰는 merge(`gh pr merge --admin`)는 하지 않는다.
- PR merge에는 리뷰 승인을 요구하지 않는다. `.github/CODEOWNERS`는 리뷰 요청 대상만 정한다. 저장소 관리자는 PR merge 때 이 조건을 건너뛸 수 있다.
- `v*` tag 생성과 삭제, Release 게시, main에서 이미지를 발행하는 Product Images run의 재실행은 저장소 소유자가 한다. Desktop 앱은 중단했고 소스는 `v1.0.2` tag에 있다([ADR 0008](docs/adr/0008-desktop-discontinued.md)).
- Ruleset, Secret, Environment와 저장소 설정도 저장소 소유자가 바꾼다.
- 개발과 테스트에는 실제 credential을 쓰지 않는다.
- 포맷은 `pnpm format`(Biome 포맷과 문장 간격 도구)으로만 맞춘다. Prettier 같은 다른 formatter를 실행하면 손대지 않은 코드의 줄바꿈까지 바뀐다.
- `pnpm-lock.yaml`과 `packages/lib/src/cp949-characters.ts`처럼 도구가 만든 파일은 손으로 고치지 않고 `pnpm install`, `pnpm --filter @dfragon/lib generate:cp949` 같은 생성 명령으로 다시 만든다. 생성물, vendor, license/notice의 소유 규칙은 [Convention 도구 적용](docs/rules/convention-tooling.md#설정과-소유권)을 따른다.

## PR

최근 merge된 PR처럼 요약 뒤에 항목별 문제와 변경을 적고, 실제 실행한 검증과 머지 위험을 따로 적는다. 문서와 사용자 문구는 [표기와 문체](docs/rules/writing.md)를 따른다.
