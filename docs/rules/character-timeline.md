---
type: rule
status: active
scope: apps/api character timeline sync, packages/database timeline tables
last-reviewed: 2026-11-04
evidence: "2026-11-04 #1175 결정 표; #1177 테이블과 저장 함수; #1178 Neople adapter; #1179 상세 조회와 queue 연결"
---

# 캐릭터 타임라인

캐릭터 상세 조회가 그 캐릭터의 Neople 타임라인을 API 프로세스 안에서 받아 PostgreSQL에 저장한다. 시즌별 레이드 클리어 수 같은 집계를 Neople에 매번 묻지 않고 DB에서 읽기 위해서다. 결정과 이유는 [ADR 0015](../adr/0015-character-timeline-sync-in-api.md)에 있다. 저장한 타임라인을 읽는 API와 화면은 아직 없다.

## 수집 범위와 저장 코드

- 수집은 중천 시즌 시작 `2025-01-09 06:00+09`부터 지금까지다. 이벤트와 아이템 모두 같고, 그 전 이력은 받지 않는다.
- Neople [타임라인 코드](https://developers.neople.co.kr/contents/guide/pages/all#던파-타임라인-코드) 54개를 모두 저장한다. 표에 없는 코드가 오면 응답 전체를 공급자 오류로 본다.
- 1xx, 2xx, 3xx(캐릭터, 던전, 결투장)는 `timeline_events`에, 4xx, 5xx, 55x, 6xx(강화, 획득, 서약, 룬과 탈리스만)는 `timeline_items`에 둔다. `timeline_events`는 `raid_name`을, `timeline_items`는 `item_id`, `item_name`, `item_rarity`를 열로 꺼내고 원본 `data`를 jsonb로 함께 둔다.
- `timeline_items`는 `occurred_at` 기준 시즌별 range partition이다. 시즌은 `seasons` 테이블에 있다. 테이블과 index는 [`@dfragon/database` 안내](../../packages/database/README.md#테이블)에 있다.

## 동기화

- `GET /characters/:serverId/:characterId`와 강제 갱신 `POST .../refresh`가 캐릭터의 기본정보와 섹션 10개를 받으면 그 캐릭터의 동기화를 queue에 넣는다. 캐릭터 캐시가 맞아도 넣는다. 섹션 하나라도 받지 못한 요청은 넣지 않아, 없는 캐릭터 ID로 동기화 상태 행이 생기지 않는다.
- 응답은 동기화를 기다리지 않으며 형태와 시간이 DB 설정이 없을 때와 같다. 요청 경로는 DB를 읽지 않는다. 클라이언트는 동기화 상태를 알 수 없다.
- Queue는 API 프로세스 메모리에 있다. 대기 중이거나 처리 중인 캐릭터는 서버, 캐릭터 ID로 합쳐 한 번만 처리하고, 동시에 2명까지 처리한다. 별도 worker 프로세스와 주기 갱신은 없다.
- 처리기는 `timeline_sync_state`의 마지막 성공이 1시간 이내면 Neople을 부르지 않고 끝난다.
- 아니면 `synced_until`부터 지금까지를 90일 이하 구간으로 나눠 앞 구간부터 차례로 받는다. 처음이거나 `synced_until`이 null이면 중천 시작부터 받는다. `synced_until` 분은 그때 받은 뒤 행이 더 생겼을 수 있어 그 분부터 다시 받는다.
- 구간마다 `next`를 끝까지 따라 받은 뒤 구간 교체 transaction 하나로 저장한다. 모든 구간을 저장하면 마지막 성공을 기록한다.
- Neople 호출 제한은 두지 않는다. 판단은 [공개 검색과 호출 제한](character-search.md#공개-검색과-호출-제한)과 같고, Neople 한도는 앱당 1초 1,000건이다. 처음 동기화하는 캐릭터는 구간(2026-11 기준 8개)마다 페이지 수만큼, 다시 받는 캐릭터는 보통 한 번 부른다.

## 구간 교체

타임라인 행은 시각이 분 단위이고 고유 ID가 없다. 같은 분에 같은 내용의 행이 실제로 여러 개 생길 수 있어 내용 비교로 중복을 지우지 않는다. 대신 한 transaction 안에서 그 캐릭터의 구간(양 끝 분 포함) 행을 두 테이블에서 지우고 새로 받은 행을 넣은 뒤 `synced_until`을 구간 끝으로 옮긴다. 같은 캐릭터의 교체가 겹치지 않게 transaction 안에서 캐릭터 단위 advisory lock을 잡는다.

구간 교체는 `synced_until`을 그 구간 끝으로 덮어쓰므로, 뒤 구간을 먼저 저장하면 `synced_until`이 뒤로 갈 수 있다. 동기화는 늘 앞 구간부터 차례로 저장한다.

## 실패

- Neople 오류(`neople-api`, `neople-unavailable`, `neople-internal`, `neople-timeout`)나 DB 오류(`database`)가 나면 그 자리에서 멈추고, `timeline_sync_state`에 실패 이유와 시도 시각만 기록한다. 재시도하지 않는다.
- 이미 저장한 구간은 그대로 남고 `synced_until`도 그 구간 끝까지 옮겨져 있다. 1시간 규칙은 마지막 성공 기준이라 실패한 캐릭터는 다음 상세 조회가 곧바로 이어 받는다.
- 실패 기록마저 실패하면 stdout에 `TIMELINE_SYNC_FAILED` 한 줄을 남긴다([API README의 접근 로그](../../apps/api/README.md#접근-로그)). 캐릭터 ID와 오류 원문은 남기지 않는다.

## 시작과 종료

- DB 설정이 없으면 queue를 만들지 않고 상세 조회는 동기화 없이 동작한다.
- DB 설정이 있으면 API를 만들 때 Prisma client 하나를 만들고, 종료 때 닫는다.
- 종료 때 대기열은 버리고 새 요청을 받지 않는다. 다시 시작한 뒤의 조회가 다시 넣는다.
- 진행 중인 동기화는 abort하지 않고 기다리지도 않는다. Prisma client는 닫은 뒤에도 다음 query에서 다시 연결하므로, 프로세스가 끝나기 전까지는 그 동기화가 이어서 받고 저장할 수 있다.
- 프로세스가 구간 저장 도중 끝나면 그 구간 transaction은 적용되지 않고, 다음 동기화가 그 구간부터 다시 받는다.

## 새 시즌 partition

새 시즌이 시작하기 전에 migration 하나로 partition을 더한다. 마지막 partition은 `MAXVALUE`까지 열려 있으므로, 시즌 시작 시각 이후 행이 아직 없는 동안 다음을 한 transaction(`BEGIN;`, `COMMIT;`)에서 한다.

1. 마지막 partition을 `ALTER TABLE "timeline_items" DETACH PARTITION ...`으로 뗀다.
2. 같은 테이블을 이전 시즌 시작부터 새 시즌 시작 전까지로 `ATTACH PARTITION ... FOR VALUES FROM (...) TO (...)`한다. 붙일 때 범위 밖 행이 있는지 검사하므로 시즌 시작 뒤에 하면 실패한다.
3. 새 시즌 partition을 새 시즌 시작부터 `MAXVALUE`까지로 만든다.
4. `seasons`에 새 시즌의 id, 이름, 시작 시각(Asia/Seoul)을 넣는다.

지난 시즌은 partition 단위로 떼거나 지운다. 다른 migration과 같이 이전 이미지가 새 schema로 뜨는지를 PR 위험에 적는다([ADR 0014](../adr/0014-api-postgresql-migrations-on-startup.md)).
