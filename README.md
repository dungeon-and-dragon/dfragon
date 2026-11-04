<img src="assets/brand/dfragon.png" width="96" height="96" alt="던삐삐" />

# 던삐삐

현재 속해있는 파티원, 공대원의 정보를 게임 화면에서 가져와 확인할 수 있는 웹 앱입니다.

## 웹에서 쓰기

[dfragon.com](https://dfragon.com) 첫 화면에서 설치 없이 바로 씁니다. 데스크톱 브라우저용이며 휴대폰은 지원하지 않습니다. 창이 좁으면 앱 상자 안에서 가로로 스크롤합니다.

1. 카드의 서버와 닉네임을 입력해 직접 검색할 수 있습니다. 서버와 닉네임은 언제든 고쳐 다시 조회할 수 있습니다.
2. 던파 창을 **Alt+PrtSc**로 찍어 **Ctrl+V**로 붙여 넣으면 지금 화면(파티, 공대)의 닉네임을 읽고 검색합니다. 전체 화면 스크린샷은 던파 창이 화면 왼쪽 위에 있을 때만 파티를 찾으므로 Alt+PrtSc를 권합니다.
3. 상단 바의 게임 연결을 눌러 던파 창을 화면 공유하면 캡처 버튼으로 공유 화면에서 한 장을 읽습니다.

공대는 공대 상세 창을 연 상태로 찍거나 공유합니다.

게임 설정의 **화면 > 폰트 설정**에서 폰트를 **돋움**으로 두어야 닉네임을 인식(OCR)할 수 있습니다.

<img src="assets/readme/game-font-dotum.png" width="594" alt="게임 설정의 폰트 설정에서 돋움을 고른 화면" />

## Desktop 앱

Windows용 Desktop 앱은 더 개발하지 않습니다. 소스는 [`v1.0.2` tag](https://github.com/dungeon-and-dragon/dfragon/tree/v1.0.2)에 있고, 이전 Release의 포터블 exe는 그대로 남아 있습니다. 중단 결정은 [ADR 0008](docs/adr/0008-desktop-discontinued.md)에 있습니다.

## 보내는 정보

- **캐릭터 검색**: 서버와 닉네임을 API(`api.dfragon.com`)에 보내고, API가 [Neople 오픈 API](https://developers.neople.co.kr)에서 조회합니다.
- **웹의 캐릭터 초상화**: 웹은 조회한 캐릭터의 서버와 캐릭터 ID를 API에 보내고, API가 네오플에서 받은 초상화를 전달합니다.
- **웹의 화면 이미지**: 붙여 넣거나 공유한 화면 이미지는 브라우저 밖으로 보내지 않고 브라우저 안에서 읽습니다.
- **사용 통계**: 보내지 않습니다.

## 개발

pnpm workspace 모노레포입니다.

| 경로 | 내용 |
| --- | --- |
| [`apps/api`](apps/api/README.md) | Neople 오픈 API를 조회해 캐시하는 공개 캐릭터 API |
| [`apps/web`](apps/web/README.md) | 웹 앱과 소개 사이트(dfragon.com) |
| [`packages/client`](packages/client/package.json) | 웹 앱의 컴포넌트, hook, OCR, 브라우저 host |
| [`packages/client-core`](packages/client-core/package.json) | 웹 앱이 쓰는 검색, 공대 로직과 타입 |
| [`packages/database`](packages/database/README.md) | API의 PostgreSQL 설정, Prisma migration과 migration CLI |
| [`packages/lib`](packages/lib/README.md) | API와 웹 앱이 함께 쓰는 입력 규칙, 게임 UI 좌표, 픽셀 계산 |
| [`packages/neople`](packages/neople/README.md) | API가 쓰는 Neople 오픈 API, 이미지 서버 client와 응답 schema |
| [`packages/ui`](packages/ui/README.md) | 디자인 토큰과 공용 컴포넌트 |
| [`packages/licenses`](packages/licenses/README.md) | 배포물에 넣는 오픈소스 고지 수집 |
| [`packages/models`](packages/models/README.md) | OCR 모델과 점수 엔진 submodule |

설치, 검증 명령과 작업 경계는 [AGENTS.md](AGENTS.md), 제품 계약과 결정 기록은 [문서 안내](docs/README.md)에서 시작합니다.

---

배포한 사이트에 포함된 오픈소스 고지의 위치는 [Web 안내의 글꼴과 고지](apps/web/README.md#글꼴과-고지)에 있습니다.

<a href="https://developers.neople.co.kr"><img src="apps/web/src/assets/neople-open-api.png" width="191" height="36" alt="Neople 오픈 API" /></a>
