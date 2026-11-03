---
type: adr
status: accepted
scope: apps/web 전역 글꼴 CSS, packages/client 글꼴 자산과 길드 이름 색, packages/ui font 토큰과 fgGuild, packages/licenses client 고지, docs/rules/design-system.md
decided: 2026-11-04
last-reviewed: 2026-11-04
superseded-by: 없음
evidence: "2026-11-04 저장소 소유자 결정(던삐삐 디자인 캔버스의 글꼴 비교 D, 길드 색 비교 C 선택, #1155)"
review-after: 라이트 모드 값을 정할 때, dfragon-design tokens.json 반영
---

# ADR 0011: 웹 글꼴을 Pretendard 하나로 통일하고 길드 이름 색 토큰을 둔다

## 상태

채택. 2026-10-26 요청(#795)으로 정한 마루미냐 한글 본문 글꼴과 2026-10-18 결정의 숫자 글꼴 Barlow Condensed를 대신한다. [ADR 0009](0009-design-tokens-game-site-conventions.md)가 정하지 않은 것으로 남긴 글꼴 항목을 정한다.

## 맥락

웹 앱은 `apps/web`의 전역 글꼴 CSS가 `--df-font-ui`를 마루미냐 한글로, `--df-font-num`을 Barlow Condensed로 덮어쓰고 있었다. `packages/ui/tokens.css`의 기본값은 이미 Pretendard였지만 웹 앱에는 쓰이지 않았다.

마루미냐 한글은 12px 비트맵 글꼴이라 13px 안팎의 본문에서 번지고, 굵기가 하나라 500 이상은 브라우저가 합성한다. 2026-11-04 표 배치 시안(#1155)에서는 13px 안팎의 숫자가 한글 라벨과 한 줄에 서므로, 숫자와 라벨의 글꼴이 다르면 굵기와 기준선이 어긋난다.

길드 이름은 아이템 등급 색 `rarityUnique`(`#FF00FF`)를 빌려 쓰고 있었다. ADR 0009의 무채색 팔레트 위에서 이 색이 가장 튀었고, 등급 색과 뜻이 다른데 같은 토큰을 공유했다.

소유자는 캔버스의 비교 보드에서 글꼴 네 조합과 길드 색 네 후보를 나란히 보고 골랐다.

| 비교 | 후보 | 선택 |
| --- | --- | --- |
| 글꼴 | A 로고만 마루미냐, B 숫자만 Barlow Condensed, C 이전 앱(마루미냐 12px와 Barlow Condensed), D 본문, 로고, 숫자 모두 Pretendard | D |
| 길드 이름 색 | A `#FF00FF` 유지, B muted `#A3A6B1`, C `#E879F9`, D 라벤더 `#BEADF2` | C |

## 결정

- 본문, "던삐삐" 로고 글자, 숫자 모두 Pretendard Variable을 쓴다. 숫자는 같은 글꼴에 `font-variant-numeric: tabular-nums`로 열을 맞춘다.
- `--df-font-ui`와 `--df-font-num`은 같은 Pretendard 대체 순서다. 숫자 자리를 표시하는 `font.num` 토큰과 `NumericText`는 그대로 둔다.
- Pretendard 1.3.9의 `PretendardVariable.woff2`(SIL OFL 1.1) 한 파일을 수정 없이 `packages/client/src/assets/fonts`에 두고 사이트에 함께 배포한다. CDN에서 받지 않는다.
- 쓰는 곳이 없어진 마루미냐 한글과 Barlow Condensed woff2, 그 license 고지를 지운다.
- 길드 이름 색은 글자 토큰 `fgGuild`(`--df-fg-guild`, `#E879F9`)다. 모험단 이름 색 `fgAdventure`(`#93E5C0`)와 짝이다. `surface`(`#1E1F24`) 위 대비는 6.7:1이다.
- 아이템 등급 토큰 `rarityUnique`는 값과 이름을 그대로 둔다.

## 정하지 않은 것

- 라이트 모드의 `fgGuild` 값은 정하지 않았다. 웹 앱은 다크 하나다.
- 글꼴이 바뀌어 숫자와 라벨의 글자 폭이 달라진다. 숫자 칸의 크기와 배치는 표 화면(#1158)에서 시안대로 맞춘다.
- dfragon-design `tokens.json`에 `fgGuild`와 글꼴 값을 반영하는 일은 그 저장소의 PR로 한다. 반영 전까지 `tokens.css` 머리말이 이 ADR을 가리킨다.

## 결과

- 웹 앱 상자 안의 모든 글자가 Pretendard로 그려진다. 굵기 400~700은 합성 없이 가변 축으로 그려진다.
- 첫 방문의 글꼴 내려받기가 약 0.53MB(마루미냐 한글과 Barlow Condensed 두 굵기)에서 약 2.06MB로 는다. `font-display: swap`이라 글꼴을 받기 전에는 시스템 글꼴로 먼저 그린다.
- 카드의 길드 이름이 `#FF00FF`에서 `#E879F9`로 바뀐다. 아이템 등급 색은 바뀌지 않는다.
- 사이트의 `notices/client/`에서 `MARUMINYA-LICENSE`, `BARLOW-LICENSE`가 빠지고 `PRETENDARD-LICENSE`가 생긴다.
- 규칙 문서의 글꼴 절과 색 토큰 목록, `packages/ui/tokens.css` 머리말, `packages/ui`, `apps/web` README가 이 결정을 따른다.
