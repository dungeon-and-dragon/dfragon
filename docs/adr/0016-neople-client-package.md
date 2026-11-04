---
type: adr
status: accepted
scope: Neople Open API와 이미지 서버 호출, packages/neople, apps/api의 Neople adapter
decided: 2026-11-04
last-reviewed: 2026-11-05
superseded-by: 없음
evidence: "Issue #1182(https://github.com/dungeon-and-dragon/dfragon/issues/1182) ; 저장소 소유자 결정(2026-11-04, 폴더 대신 package)"
review-after: API 말고 다른 서버 프로세스가 Neople을 부를 때, Neople이 응답 형식을 바꿀 때
---

# ADR 0016: Neople 호출을 `@dfragon/neople` package에 모은다

## 상태

채택.

## 맥락

API에는 Neople Open API를 부르는 adapter가 기능마다 따로 있었다.
캐릭터 검색, 상세, 타임라인, 공용 아이템, 오늘의 등급, 캐릭터 이미지, 스킬 검증 script가 각자 `ky.create` 설정, Neople 오류 분류, timeout과 연결 오류 처리, 테스트용 `fetch` 주입을 반복했다.
설정도 조금씩 달랐다. 검색만 redirect를 `manual`로 두었고, 공용 아이템은 오류를 분류하지 않았다.
응답 검증은 `isRecord`와 `assert`로 손으로 써서 Neople 응답의 타입이 코드에 드러나지 않았다.

Neople을 부르는 곳은 API 앱 하나다.
API key를 헤더에 싣기 때문에 브라우저에서는 부를 수 없고, Desktop 앱은 중단했다([ADR 0008](0008-desktop-discontinued.md)).

## 결정

- **위치**: Neople 호출은 workspace package `packages/neople`(`@dfragon/neople`)에 둔다.
  `ky`, `zod` 의존성은 이 package가 갖고, API의 `dependencies`에서 `ky`를 뺀다.
  오류 body 모양 검사에 `@dfragon/lib`의 `isRecord`를 쓰므로 `@dfragon/neople`은 `@dfragon/lib`에 의존한다.
  Package는 API의 오류 클래스, 캐시, Nest, DB를 import하지 않는다.
- **transport**: API key 헤더, redirect를 따라가지 않음, retry 0회, ky 기본 timeout, JSON 파싱, Neople 오류 code 분류를 package의 transport 하나가 맡는다.
- **endpoint와 schema**: package가 endpoint 메서드와 Neople 응답 schema를 갖고, API 기능 코드는 schema에서 추론된 타입을 받는다.
  Schema는 코드가 읽는 필드만 적고 나머지 필드는 그대로 통과시킨다.
  상세의 섹션 값은 API가 해석하지 않고 web과 점수 엔진에 넘기므로 객체이거나 null인지만 본다.
- **기능 쪽에 남는 것**: 요청한 캐릭터와 응답이 같은지, `match` 검색의 이름 비교, 저장할 타임라인 code, 시각 변환, 등급 값 범위처럼 던삐삐가 정한 규칙은 API 기능 코드에 남긴다.
- **오류**: package는 실패를 `NeopleRequestFailure`(`internal`, `api`, `unavailable`, `timeout`)로 던진다.
  API 기능 코드는 이를 자기 오류로 바꾸되, `NeopleRequestFailure`가 아니라 그 원래 원인을 넘겨 접근 로그의 오류 chain이 이전과 같게 한다.
- **이미지**: 이미지 서버는 key를 받지 않고 PNG 바이트를 4MiB 상한과 함께 받으므로 같은 package 안의 별도 client로 둔다.
- **테스트 주입**: `fetch`와 origin을 바꾸는 생성 함수는 package에만 둔다. `globalThis.fetch`를 바꾸는 전역 방식은 쓰지 않는다.

## 결과

- Neople 응답을 받는 기능은 `unknown` 대신 추론된 타입을 받는다.
- 검색의 3xx 응답은 이제 fetch가 redirect를 거절해 실패한다. 응답은 이전처럼 502이고 요청도 한 번이다.
- 공용 아이템도 Neople 오류를 분류한다. 실패는 이전처럼 모두 `Catalog lookup failed`로 바뀐다.
- 오늘의 등급의 timeout 오류에 ky의 `TimeoutError`를 원인으로 남기지 않는다.
- Package는 `@dfragon/lib`처럼 `dist`를 build하므로 API의 build, typecheck, Dockerfile, 이미지 빌드 경로와 `pnpm verify`가 이 package를 함께 다룬다.
- Neople이 schema에 적은 필드의 형식을 바꾸면 그 endpoint는 502가 된다. Schema에 적지 않은 필드는 영향이 없다.
