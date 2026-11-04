---
type: rule
status: active
scope: repository
last-reviewed: 2026-11-01
---

# 던삐삐 Document Guide

## 읽기 안내

이 저장소는 제품의 동작, 구조, 실행 계약과 결정 기록을 관리한다. 누가 작업하든 참인 설치, 검증 명령과 작업 경계는 루트 [AGENTS.md](../AGENTS.md)에 두고, 개인 작업 습관은 각자 로컬에서 관리한다. 아래 표에서 변경 대상의 제품 계약과 실행 안내를 찾을 수 있다.

| 필요한 내용 | 위치 |
| --- | --- |
| formatter/linter 설정과 생성물 경계 | [도구 적용](rules/convention-tooling.md) |
| 제품 이미지 실행, 인프라 운영 원본 | [서버 이미지 안내](../apps/api/README.md#서버-이미지) |
| 명령과 현재 파일 구조 | [scripts 안내](../scripts/README.md), 각 app, package의 README |
| app, package 경계 | [Architecture Overview](architecture/overview.md) |
| API runtime, 검색 | [API runtime](rules/api-runtime.md), [캐릭터 검색](rules/character-search.md), [캐릭터 상세](rules/character-details.md), [오늘의 등급](rules/today-grade.md), 결정 [ADR 0014 API가 시작할 때 PostgreSQL migration을 TypeORM으로 적용한다](adr/0014-api-postgresql-migrations-on-startup.md) |
| 웹 클라이언트 화면 구성, 입력, 전송 정보, 플랫폼 연결, 마을 자동 인식 | [웹 클라이언트](rules/web-client.md), 결정 [ADR 0004 dfragon.com 첫 화면에 설치 없이 쓰는 웹 클라이언트를 둔다](adr/0004-web-client.md), [ADR 0005 웹에서 던파 창을 공유하는 동안 마을의 파티, 공대를 자동으로 인식한다](adr/0005-web-town-auto-recognition.md), [ADR 0006 마을 자동 인식은 지금 화면만 보고 같은 구성을 차이가 큰 픽셀 수로 정한다](adr/0006-web-town-watch-current-screen.md), [ADR 0007 마을 자동 인식의 같은 구성은 OCR과 같은 글자 이진화 결과로 비교한다](adr/0007-web-town-compare-binarized-name-crops.md), [ADR 0012 파티, 공대 화면을 카드 격자 대신 표의 행으로 그린다](adr/0012-party-raid-table-rows.md), [ADR 0013 후보 창과 서버 선택을 행 아래 팝오버로 두고 공대도 후보 창을 쓴다](adr/0013-candidate-and-server-popovers.md) |
| Desktop 중단, Web 코드 이전 결정 | [ADR 0008 Desktop을 중단하고 Web이 쓰는 코드를 client-core, client package로 옮긴다](adr/0008-desktop-discontinued.md) |
| 앱 공용 UI, 디자인 토큰, Base UI, StyleX, 시각 검증 | [Design System](rules/design-system.md), [Shared UI boundary](architecture/overview.md#shared-ui-boundary), [공통 StyleX 설정](../packages/ui/README.md#공통-stylex-설정), 결정 [ADR 0009 디자인 토큰을 게임 전적 사이트의 관습에 맞춰 바꾼다](adr/0009-design-tokens-game-site-conventions.md), [ADR 0010 상단 바를 전역 바와 게임 바 2단으로 나누고 콘텐츠 폭 1080px, 자른 모서리 없음을 화면에 적용한다](adr/0010-two-tier-header-1080-width-no-cut-corners.md), [ADR 0011 웹 글꼴을 Pretendard 하나로 통일하고 길드 이름 색 토큰을 둔다](adr/0011-pretendard-font-and-guild-color.md), [ADR 0012 파티, 공대 화면을 카드 격자 대신 표의 행으로 그린다](adr/0012-party-raid-table-rows.md) |
| React 화면, hook 책임과 앱별 진입점 | [공통 책임 기준](rules/design-system.md#react-ui-책임) |
| 제품 이름 표기, 사용자 문구 문체, 표기 검사 | [표기와 문체](rules/writing.md) |

## Document class

Rule은 동작과 제약을 정의한다. `docs/rules/**`, `docs/architecture/**`의 제품 계약이 Rule이다. 현재 code, config, command의 설명은 설명하는 코드 옆 README와 주석에 두고 `docs/`에 따로 두지 않는다. 작업의 일시적인 상태는 필요한 Issue, PR에서 관리한다.

ADR(Architecture Decision Record)은 `docs/adr/**`에 번호 순서로 두는 결정 기록이다. 맥락, 확인한 사실, 선택지, 결정, 결과를 결정 당시 기준으로 적고 뒤에 고쳐 쓰지 않는다. 결정이 바뀌면 새 ADR을 추가하고 이전 ADR의 `superseded-by`에 연결한다. Rule은 현재 계약만 적고, 결정의 이유, 날짜, Issue는 해당 ADR을 링크한다.

README의 오류는 실제 파일, 설정에 맞춰 고친다. Rule과 구현의 중요한 제품 계약 충돌은 임의로 선택하지 않고 영향받는 부분만 확인한다. 허용된 Rule 변경은 채택 범위, status를 PR에 명시해 구현, 검증하고, 다른 작업에는 사용자 merge 후 적용한다. Proposed 제품 계약의 링크, 절차 정리만으로 그 내용을 채택하지 않는다.

제품의 필수 책임 경계는 Rule에 두고, README는 해당 Rule 및 현재 대표 구현을 연결한다. 예제나 기존 코드의 우연한 형태를 다른 앱의 필수 구조로 확대하지 않는다.
