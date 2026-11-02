---
type: adr
status: accepted
scope: dfragon.com web client round start while sharing the game window
decided: 2026-11-03
last-reviewed: 2026-11-03
superseded-by: 없음
evidence: "Issue #1105 정한 것, 동작, 구조, 확인한 사실(https://github.com/dungeon-and-dragon/dfragon/issues/1105) ; 저장소 소유자 결정(2026-11-03) ; hidden 페이지의 프레임 읽기, timer 실험(2026-11-03, macOS Chrome 155, DevTools Protocol) ; 판정, OCR 비용 측정(Node, Apple M3 Max)"
review-after: Desktop 자동 인식, 마을 밖 자동 인식, 바뀐 자리만 다시 조회하는 부분 회차를 넣기 전, Chrome의 hidden 페이지 timer, freezing 정책이 바뀔 때
---

# ADR 0005: 웹에서 던파 창을 공유하는 동안 마을의 파티, 공대를 자동으로 인식한다

## 상태

채택. 계약은 [웹 클라이언트](../rules/web-client.md#마을-자동-인식)에 둔다. 화면 공유 중 회차를 시작하는 방식에 한해 [ADR 0004](0004-web-client.md)를 대체한다. 구현은 [Issue #1105](https://github.com/dungeon-and-dragon/dfragon/issues/1105)의 sub-issue로 나눠 진행한다.

## 맥락

Desktop은 게임 중 전역 단축키 Alt+R로 회차(캡처, OCR, 검색)를 시작한다. 웹에는 전역 단축키가 없고, 게임 창이 앞에 있는 동안 브라우저 페이지는 키를 받지 못한다.

- 웹은 던파 창을 화면 공유로 연결해도 회차마다 브라우저로 돌아와 캡처 버튼이나 Alt+R을 눌러야 한다. [ADR 0004](0004-web-client.md#결정)는 이 게임 중 Alt+Tab 흐름을 범위에서 뺐다.
- 웹 클라이언트 Rule은 "캡처 버튼과 Alt+R은 프레임 한 장만 읽어 회차를 시작한다. 연속 인식과 자동 재인식은 하지 않는다"로 정해져 있었다.
- 파티와 공대 구성은 주로 마을에서 바뀐다. 마을에서는 파티 프레임에 전투 이펙트가 겹치지 않는다.

## 확인한 사실

- 게임 중 브라우저 창은 게임에 가려져 hidden이 된다. hidden 페이지에서 프레임 읽기와 timer가 도는지 실험했다(2026-11-03, macOS Chrome 155, Playwright 없이 DevTools Protocol로 창 공유를 켜고 브라우저 창을 최소화해 `document.hidden`이 true인 상태 390초).

  | 항목 | 결과 |
  | --- | --- |
  | 메인 스레드 timer(`setInterval`, 체인 `setTimeout`) | 1초에 1번으로 묶이고, 5분이 지나도 1분에 1번으로 더 묶이지 않음 |
  | 숨은 `<video>`에서 지금 프레임 읽기 | 매초 새 프레임 |
  | `ImageCapture.grabFrame` | 매초 새 프레임 |
  | `requestVideoFrameCallback` | 멈춤 |
  | worker로 넘긴 `MediaStreamTrackProcessor.readable` | 약 29 fps로 계속 오고 worker timer는 묶이지 않음 |

  캡처 중인 페이지는 Chrome이 화상 회의 페이지로 보아 freezing과 강한 timer 제한에서 빼는 것으로 보인다([Chrome freezing 예외](https://developer.chrome.com/blog/freezing-on-energy-saver)).
- Chrome 155는 `MediaStreamTrack`을 worker로 transfer하지 못한다(`DataCloneError`). Worker에서 프레임을 받으려면 메인에서 만든 `MediaStreamTrackProcessor`의 `readable`만 넘겨야 한다.
- Playwright가 띄운 Chrome은 탭 전환, 최소화, 다른 창으로 가림 어느 것도 hidden이 되지 않았다. hidden 동작 실험은 Playwright 없이 해야 한다.
- Windows에서 다른 창에 완전히 가린 창은 occluded이며 renderer에는 hidden으로 전달된다([Chromium 문서](https://chromium.googlesource.com/chromium/src/+/master/docs/windows_native_window_occlusion_tracking.md)). 게임이 브라우저를 덮은 Windows 실제 상황은 구현 뒤 dev 사이트에서 확인한다.
- 판정 비용(Node, Apple M3 Max): 파티 검출 실패 경로는 0.4~0.6 ms, 공대 heading 검색 실패 경로는 1066×600에서 4~13 ms, 1920×1080에서 12~82 ms다.
- OCR은 WASM 1 thread에서 장당 약 138 ms다. 파티 회차 4장은 약 0.6초, 공대 회차 24장(이름 12, 직업 12)은 약 3.3초다. WebGPU면 더 빠르다.
- 화면 공유 프레임은 같은 화면에서도 색이 1~3 정도 흔들린다([Issue #1076](https://github.com/dungeon-and-dragon/dfragon/issues/1076)).
- 파티 프레임 검출은 HP, MP가 가득 찬 화면에서만 된다. 던전 전투 중에는 마을 판정과 별개로 파티를 찾지 못한다.

## 선택지

| 선택지 | 고르지 않은 이유 |
| --- | --- |
| A. 캡처 버튼과 Alt+R만 유지한다 | 회차마다 게임에서 브라우저로 돌아와야 하는 흐름이 그대로 남는다. |
| B. 약 1초마다 마을을 판정하고, 구성이 같은지는 이름 crop의 픽셀로 비교한다 | 채택 |
| C. 판정마다 OCR로 이름을 읽어 비교한다 | WASM 1 thread OCR이 장당 약 138 ms라 공대 이름 12장만 읽어도 약 1.7초로 판정 주기를 넘는다. 마을에서는 이름 crop이 전투 이펙트 없이 같게 보이므로, 색 흔들림을 허용 오차로 받는 픽셀 비교로 충분하다. |
| D. Worker에서 `MediaStreamTrackProcessor`로 프레임을 받아 판정한다 | hidden 페이지에서도 메인 스레드 timer가 1초에 1번 돌고 숨은 `<video>` 읽기가 매초 새 프레임을 주므로, 지금 host의 `<video>` 읽기 경로로 약 1초 판정이 된다. Track을 transfer하지 못해 `readable`을 넘기는 별도 경로를 새로 두어야 하고, 판정 비용은 최악 82 ms로 1초 주기 안에 든다. |

## 결정

B를 채택한다(2026-11-03 저장소 소유자 결정).

- **범위**: 웹에서 던파 창을 화면 공유로 연결한 동안 항상 자동으로 인식한다. 켜고 끄는 토글과 설정은 두지 않는다. Desktop에는 넣지 않고 전역 Alt+R을 그대로 쓴다.
- **마을 판정**: 게임 화면 오른쪽 위의 지구본 아이콘이 보일 때만 마을로 본다. 마을이 아니면 자동으로 검색하지 않고 화면도 바꾸지 않는다. 지구본 아이콘은 공대 창 heading처럼 템플릿을 정규화 상관으로 찾는 순수 함수로 `packages/lib`에 두고, 템플릿 PNG는 공대 템플릿처럼 저장소에 둔다. 게임 스크린샷 원본은 저장소와 Issue에 넣지 않는다.
- **공대 우선**: 공대 상세 창이 보이면 공대를 먼저 본다. 공대 창의 구성이 새로우면 공대 화면으로 바꾸고 공대 회차를 시작한다. 공대 창이 없고 파티 프레임의 구성이 새로우면 파티 화면으로 바꾸고 파티 회차를 시작한다. 둘 다 없거나 구성이 같으면 화면과 카드를 그대로 둔다. 공대 창을 닫는 것만으로는 파티 화면으로 돌아가지 않는다.
- **같은 구성**: 이름 crop의 픽셀을 자리별로 비교한다. 위치는 기존 검출기가 준다(파티는 `detectPartyFrameGeometry`의 자리별 이름 영역, 공대는 `cropDNFRaidParticipantNicknames`의 행별 이름 crop). 비교 기준은 그 화면(파티, 공대)의 마지막 회차가 읽은 프레임의 이름 crop이며, 자동 회차, 캡처 버튼, Alt+R, 붙여넣기로 시작한 회차가 모두 기준을 바꾼다. 자리 수가 다르거나, 한 자리라도 crop 크기가 다르거나 픽셀 평균 차이가 허용 오차를 넘으면 다른 구성이다.
- **2번 연속**: 새 구성은 2번 연속 같은 crop으로 보일 때만 회차를 시작한다. 화면이 바뀌는 순간의 프레임으로 회차를 시작하지 않게 하려는 것이다.
- **회차**: 구성이 바뀌면 Alt+R과 같은 전체 회차를 시작해 모든 자리를 비우고 다시 채운다. 구성이 같으면 회차가 없으므로 사용자가 직접 고친 자리가 남는다. 자동 회차도 회차로 세어 모험단 스냅샷의 회차 번호가 오른다.
- **진행 중과 실패**: 회차가 진행 중이면 판정하지 않는다. 회차가 실패로 끝나도(글자 인식 실패, 공대 창 미확인) 그 프레임이 기준이 되어 같은 장면을 다시 시도하지 않는다. 다시 시도는 캡처 버튼이나 Alt+R로 한다.
- **캡처 버튼과 Alt+R**: 남긴다. 누르면 같은 구성이어도 바로 다시 인식한다.
- **주기**: 브라우저 host가 약 1초마다 공유 화면의 지금 프레임 한 장을 메인 스레드에서 읽는다. 판정 주기를 ms 단위로 맞추는 timeout과 그 테스트는 두지 않는다.
- **구조**: 감시는 브라우저 host가 맡는다. 판정과 비교 규칙(마을, 공대 우선, crop 비교, 2번 연속)은 host와 분리한 순수 모듈로 두고 합성 입력으로 테스트한다. 자동 회차는 붙여넣기 회차의 길을 그대로 써서, host가 판정에 쓴 프레임을 들고 있다가 그 회차의 `readCaptureFrame`으로 돌려준다. 화면 전환은 웹 entry가 검색 모드 store로 한다. Renderer 주입 지점은 세 개 그대로이고, 그 밖의 renderer 코드와 Desktop의 동작은 바뀌지 않는다.
- **상태 문구**: 던파 창을 연결한 뒤와 회차를 마친 뒤의 게임 연결 칩 문구는 자동 인식을 안내한다. 정확한 문구는 구현에서 [표기와 문체](../rules/writing.md)를 따라 정한다.
- **하지 않는 것**: 마을이 아닌 곳(던전, 전투)의 자동 인식, 바뀐 자리만 다시 조회하는 부분 회차는 넣지 않는다. 검색 코어의 회차 시작이 모든 자리를 비우는 규칙은 그대로다.

## 결과

- 화면 공유를 연결해 두면 마을에서 파티나 공대가 바뀔 때 브라우저로 돌아오지 않아도 카드가 채워진다.
- 구성이 바뀌면 사용자가 직접 고친 자리도 비워진다. 자동 회차마다 회차 번호가 오른다.
- 실패한 장면은 자동으로 다시 시도하지 않으므로, 사용자가 캡처 버튼이나 Alt+R로 다시 인식해야 한다.
- 마을이 아니거나(던전 전투 중 포함), 마을에서 공대 상세 창과 파티 프레임을 모두 찾지 못하면 아무 일도 일어나지 않는다.
- 공유하는 동안 매초 프레임 읽기와 판정이 메인 스레드에서 돈다. 1920×1080에서 공대 heading 검색은 최악 82 ms다.
- hidden 페이지 동작은 macOS Chrome에서만 확인했다. 게임이 브라우저를 덮은 Windows 실제 상황은 dev 사이트에서 확인해야 하고, Chrome이 화면 공유 중인 페이지를 freezing 예외에서 빼면 판정 주기가 길어질 수 있다.
