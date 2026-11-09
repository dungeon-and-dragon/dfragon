# 던삐삐 API

`apps/api`는 공개 캐릭터 API입니다. Neople API에서 조회한 캐릭터는 API 메모리에 1시간, 공용 아이템 정보는 24시간 캐시합니다.
DB 설정이 있으면 상세 조회한 캐릭터의 [타임라인](#타임라인-동기화)과 [기본 정보](#캐릭터-기본-정보-저장)를 PostgreSQL에 저장하고, [타임라인 조회](#타임라인-조회)로 저장한 타임라인을 돌려줍니다.
같은 이미지의 [캐릭터 수집 worker](#캐릭터-수집-worker)는 캐릭터 목록 파일에 있는 캐릭터의 Neople 기본 정보를 DB에 쌓습니다.
여러 노드로 띄울 수 있지만 캐시는 노드마다 따로 둡니다. 기본 entry는 설정 검증, [DB migration](#db와-migration)(DB 설정이 있을 때), HTTP listen 순서로 시작합니다.

## Swagger와 HTTP

`/docs`, `/docs/openapi.json`은 API 계약만 제공합니다. `/health`는 200, `/auth/**`와 `/me`는 404입니다.

웹 사이트는 같은 origin의 `/api`로 API를 부르므로(운영과 dev는 node1의 host Caddy, 개발 서버는 Vite proxy가 넘깁니다) API는 CORS 헤더를 붙이지 않습니다.
`GET /characters/:serverId/:characterId/image`는 웹 클라이언트가 픽셀을 읽을 수 있게 네오플 캐릭터 이미지를 그대로 전달합니다.

## 준비할 입력

| 필수 | 선택 |
| --- | --- |
| `PORT`, Neople key | `SEARCH_TRUST_PROXY=single-hop`, local TLS, `SCORE_LIBRARY_FILE`, [DB 설정](#db와-migration) |

PORT는 ASCII 십진 정수 1~65535입니다. `.env.example`을 앱의 `.env`로 복사하고 실제 secret은 Git 밖에서 관리합니다.
Proxy 설정은 단일 신뢰 proxy를 사용할 때만 켭니다.
`SCORE_LIBRARY_FILE`은 점수 엔진 라이브러리(macOS `libdnfscore.dylib`, Linux `libdnfscore.so`)의 절대 경로입니다.
지정하면 앱을 만들 때 점수 worker 하나를 띄우고, listen을 기다리지 않고 그 worker에서 딜러, 버퍼 준비 계산을 한 번씩 합니다.
빈 값과 상대 경로는 시작 전에 거절하고, 지정하지 않으면 점수 없이 실행합니다.
계산한 점수는 캐릭터 상세 응답의 `card.score`에 들어가고 응답 본문과 함께 1시간 캐시됩니다.
점수 계산기는 카드 `role`로 고릅니다. `buffer`는 버프 점수, `dealer`와 `synergy`는 장비 점수를 계산합니다.
직업별 역할 판정은 `src/characters/domain/`의 캐릭터 class가 맡고, 남성 크루세이더처럼 스킬 구성으로 역할이 바뀌는 직업은 스킬 스타일을 봅니다.
파일을 열지 못하거나 worker가 끝나도 API는 계속 실행하고 점수를 null로 둡니다. 로컬에서는 [엔진 라이브러리를 직접 빌드해 둔](../../packages/models/README.md#점수-엔진) 파일을 지정할 수 있습니다.
[서버 이미지](#서버-이미지)는 이미지 안의 Linux 엔진 `/app/score-engine/libdnfscore.so`를 이 값으로 지정합니다.

Neople key는 시작할 때 `NEOPLE_API_KEY` 또는 `NEOPLE_API_KEY_FILE`의 절대 경로에서 읽습니다. GitHub나 특정 secret manager가
필요하지 않으며 self-host 운영자가 준비한 환경변수, 읽기 전용 파일을 사용할 수 있습니다.

두 입력을 함께 지정하면 빈 값이어도 거절합니다. 빈 값, 상대 경로, 읽을 수 없는 파일은
시작 전에 값, 경로 없이 실패합니다. 파일은 UTF-8로 읽고 끝의 LF만 제거하며, 직접 입력은 그대로 사용합니다.
비밀값은 이미지 빌드 인자나 Dockerfile의 `ENV`로 넣지 않습니다. 값 교체 후에는 앱을 다시 시작합니다.

## DB와 migration

DB는 선택입니다. `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`과 `DB_PASSWORD` 또는 `DB_PASSWORD_FILE`의 절대 경로를 모두 지정하면 PostgreSQL을 쓰고, 모두 생략하면 DB 없이 뜹니다.
일부만 지정하면 시작 전에 값 없이 실패합니다. 비밀번호는 Neople key처럼 읽되 끝의 줄바꿈과 공백까지 뺍니다.
Prisma의 migration 기록 테이블 `_prisma_migrations`와 캐릭터, 모험단 테이블(`characters`, `adventures`), 수집 대기열(`character_collection`)과 타임라인 테이블(`seasons`, `timeline_events`, `timeline_items`, `timeline_sync_state`, `timeline_season_backfill`)을 만듭니다. 테이블은 [`@dfragon/database` 안내](../../packages/database/README.md#테이블)에 있습니다.

DB 설정이 있으면 listen 전에 [`@dfragon/database`](../../packages/database/README.md)가 `prisma migrate deploy`로 적용하지 않은 migration을 적용합니다.
여러 인스턴스가 동시에 시작해도 Prisma가 잡는 PostgreSQL advisory lock으로 한 번만 적용하며, lock을 10초 안에 얻지 못한 인스턴스는 끝납니다.
연결, 인증, migration이 실패하면 `API failed to start`와 nonzero exit로 끝나며 `/health`를 열지 않습니다.
Prisma CLI의 출력은 시작 경로에서 버립니다. 실패 원인은 같은 DB 설정으로 `@dfragon/database`의 `db:migrate:status`, `db:migrate:deploy`를 실행해 봅니다.
Prisma는 실패한 migration을 실패로 기록하므로, 기록을 정리하기 전까지 다음 시작도 실패합니다. 정리 절차는 [migration 실패 복구](#migration-실패-복구)에 있습니다.
Migration은 `public` schema 안에서만 합니다. 운영 계정은 extension, schema를 만들 수 없습니다.

### 타임라인 동기화

DB 설정이 있으면 API를 만들 때 Prisma client 하나와 메모리 queue를 만들고, 종료 때 client를 닫습니다.
상세 GET과 강제 갱신은 캐릭터 11개 섹션을 받았거나 캐릭터 캐시가 맞으면 `character.fetched` 이벤트를 내고, 동기화를 기다리지 않고 응답합니다. 타임라인 구독자가 이 이벤트를 받아 queue에 넣습니다.
Queue는 같은 캐릭터를 진행 중인 동기화 하나로 합치고 다른 캐릭터는 기다리지 않고 바로 시작하며, 마지막 성공이 1시간 이내가 아닌 캐릭터만 `synced_until`부터 90일 구간씩 Neople에서 받아 `timeline_events`, `timeline_items`, `timeline_sync_state`에 저장합니다.
실패는 `timeline_sync_state.last_failure`에 남고 재시도하지 않습니다. 종료 뒤에 온 요청은 시작하지 않고 진행 중인 동기화는 기다리지 않습니다.
같은 이벤트가 강화, 증폭, 재련(401~403) 백필을 별도 queue에 넣습니다. 백필은 Neople이 주는 첫날 2017-09-21부터 중천 시작 직전까지 그 세 코드만 90일 구간씩 받아 `timeline_items`에 저장하고, 저장한 구간 끝을 `enhancement_backfilled_until`에 남깁니다.
끝까지 받은 캐릭터는 Neople을 부르지 않습니다. 실패하면 그 자리에서 멈추고, 다음 상세 조회가 저장한 구간 뒤부터 이어 받습니다.
DB 설정이 없으면 queue를 만들지 않습니다.

### 타임라인 조회

`GET /characters/:serverId/:characterId/timeline`은 그 캐릭터의 동기화를 같은 queue에 넣고, 그 캐릭터의 진행 중인 동기화가 끝난 뒤 DB를 읽어 응답합니다.
마지막 성공이 1시간 이내면 동기화는 Neople을 부르지 않고 바로 끝납니다. 처음 조회한 캐릭터는 구간 여러 개를 받으므로 응답이 몇 초 걸릴 수 있습니다.
강화 백필은 기다리지 않으므로 백필이 끝나기 전에는 중천 전 기록이 빠질 수 있습니다. 동기화 실패와 동기화 상태는 응답에 넣지 않고, 저장한 값까지만 돌려줍니다. 종료 뒤에 온 조회는 동기화 없이 바로 DB를 읽습니다.

| 필드 | 내용 |
| --- | --- |
| `weeklyClears` | 이번 주(목요일 06:00 KST부터) 레이드(코드 201, 210, `kind: "raid"`)와 레기온(209, `kind: "legion"`) 클리어, 오래된 순 |
| `seasonClears` | 지금 시즌(`seasons`에서 가장 최근에 시작한 시즌)의 같은 클리어를 `kind`, `name`, `hard`별로 센 횟수 |
| `enhancements` | 강화(401, `reinforce`), 증폭(402, `amplify`), 재련(403, `refine`), 최근 순 50개 |
| `acquisitions` | 획득 코드(501~521, 550~557) 가운데 `item_rarity`가 에픽, 태초인 행, 최근 순 50개 |

레이드 이름은 `raid_name`, 난이도 이름 `modeName`은 행의 `data.modeName`(없으면 `null`)이고, 레기온 이름은 `data.regionName`입니다.
`hard`는 레이드 행의 `data.hard`입니다. Neople은 하드로 클리어한 행에만 `hard: true`를 넣고 나머지 행에는 이 칸을 두지 않아, 칸이 없는 레이드와 레기온은 `false`입니다.
`modeName`만으로는 하드를 알 수 없습니다. 같은 난이도 이름이라도 하드 행과 아닌 행이 섞여 있고, 미카엘라 종언서처럼 `modeName`에 "(하드)"가 들어 있으면서 `hard: true`인 행도 있습니다.
재련에는 `before`, `safe`가 없어 `null`입니다. 값이 없으면 빈 배열이고, DB 설정이 없는 API는 동기화 없이 빈 배열만 돌려줍니다.

### 캐릭터 기본 정보 저장

DB 설정이 있으면 기본 정보 구독자도 `character.fetched` 이벤트를 받아, 상세 응답의 `character`와 같은 이름, 모험단, 레벨, 직업, 명성, 길드를 `@dfragon/database`의 `recordCharacterBasic`으로 `characters`에 덮어쓰고 `basic_fetched_at`을 지금으로 둡니다.
그 캐릭터가 `character_collection` 대기열에 있으면 대기열 행도 지웁니다.
캐시가 맞은 조회도 저장하고, DB에 없던 캐릭터와 모험단은 새로 만듭니다. Prisma client는 타임라인 동기화와 함께 씁니다.
응답은 저장을 기다리지 않고, 저장이 실패해도 상세 응답은 그대로이며 재시도하지 않습니다. 모험단 이름이 없는 캐릭터처럼 기본 정보 schema에 맞지 않는 응답은 저장하지 않습니다.
DB 설정이 없으면 구독자를 등록하지 않습니다.

기본 정보를 저장한 뒤 같은 구독자가 스킬 스타일 섹션을 `@dfragon/neople`의 `characterSkillStyleSchema`로 바꿔 `recordCharacterSkillStyle`로 `character_skill_styles`에 덮어씁니다.
스킬 스타일 행은 `characters`를 참조하므로 기본 정보를 저장하지 못하면 스킬 스타일도 저장하지 않습니다.
명성 상위 표본인지와 상관없이 저장하고, `fetched_at`은 캐시가 맞은 조회에서도 그 섹션을 Neople에서 받은 시각입니다.
스킬 스타일 schema에 맞지 않는 응답은 저장하지 않으며, 응답은 이 저장도 기다리지 않습니다.

### 검색 후보의 모험단명

`GET /characters/candidates`는 후보마다 DB `characters`에 저장된 그 캐릭터(서버, 캐릭터 ID)의 모험단명을 `adventureName`으로 붙입니다.
후보 전체를 query 한 번으로 읽고, Neople 상세 조회는 하지 않습니다. 저장되지 않은 캐릭터와 DB 설정이 없는 API는 `null`입니다.
Neople 검색 결과의 24시간 캐시에는 모험단명을 넣지 않고 응답할 때마다 DB에서 읽으므로, 캐시된 후보에도 새로 저장된 모험단명이 바로 붙습니다.
DB를 읽지 못하면 후보 응답도 실패합니다.

### 모험단, 길드 조회

`GET /adventures/:adventureName/characters`와 `GET /guilds/:guildId`는 Neople을 부르지 않고 DB에 저장된 캐릭터 기본 정보를 읽습니다.
모험단은 `adventures.name`이 같은 캐릭터, 길드는 `guild_id`가 같은 캐릭터이며 길드 ID는 서버가 달라도 같은 길드라 서버로 거르지 않습니다.
두 목록 모두 서버를 가리지 않고 명성이 높은 순이고, 명성이 없는 캐릭터는 뒤에 둡니다. 페이지는 없습니다.

```json
{ "adventureName": "…", "characters": [ /* 캐릭터 행 */ ] }
{ "guildId": "…", "guildName": "…", "memberCount": 42, "averageFame": 81234, "members": [ /* 캐릭터 행 */ ] }
```

캐릭터 행은 `serverId`, `characterId`, `characterName`, `adventureName`, `level`, `jobId`, `jobGrowId`, `jobName`, `jobGrowName`, `fame`, `guildId`, `guildName`, `fetchedAt`(`basic_fetched_at`), `role`입니다. 기본 정보를 받지 않은 행은 레벨, 직업, 명성, 길드와 `fetchedAt`, `role`이 `null`입니다.
`role`은 카드 `role`과 같은 전직 이름 기준으로 `dealer`나 `buffer`입니다. 남성 크루세이더는 `character_skill_styles`에 받을 때의 전직이 지금 전직과 같은 행이 있으면 그 `skills`에 `용기의 은총`이 있을 때 `dealer`, 없을 때 `buffer`이고, 그런 행이 없으면 `null`입니다.
`guildName`은 가장 최근에 받은 길드원 행의 이름이고, `averageFame`은 명성이 있는 길드원의 평균을 반올림한 값입니다. 그런 길드원이 없으면 `null`입니다.
DB에 없는 모험단과 길드, DB 설정이 없는 API는 빈 목록을 주며 이때 `guildName`, `averageFame`은 `null`입니다. 예전에 지운 `GET /adventures/characters`와는 다른 경로입니다.

### 모험단 주간 클리어 조회

`GET /adventures/:adventureName/weekly`는 모험단 조회와 같은 캐릭터 행에 이번 주(목요일 06:00 KST부터) 클리어를 붙여 명성 순으로 줍니다.
`kind`, `name`의 뜻은 [타임라인 조회](#타임라인-조회)와 같습니다.

```json
{
  "adventureName": "…",
  "clearNames": [{ "kind": "raid", "name": "디레지에 레이드" }, { "kind": "legion", "name": "베누스" }],
  "characters": [{ /* 캐릭터 행 */ "weeklyClears": [{ "kind": "raid", "name": "디레지에 레이드" }] }]
}
```

`clearNames`는 모든 모험단에 같은 고정 목록으로, 레이드(201, 210) 디레지에 레이드, 무너진 성자 미카엘라와 레기온(209) 아포칼립스 순입니다. 이름은 타임라인의 `raidName`, `regionName`과 글자까지 같아야 클리어로 셉니다.
`weeklyClears`는 `clearNames`에 있는 이름만, 같은 이름을 여러 번 클리어해도 한 번만 넣고 `clearNames`와 같은 순서입니다.
조회는 그 캐릭터들의 타임라인 동기화를 같은 queue에 넣고 끝나기를 기다리지 않습니다. 응답은 지금 저장된 값이라, 처음 여는 모험단은 비어 있다가 동기화가 끝난 뒤 다시 조회하면 채워집니다.
DB에 없는 모험단은 `characters`만 빈 목록이고, DB 설정이 없는 API는 `clearNames`와 `characters`를 모두 빈 목록으로 줍니다.

### 모험단 시즌 활동 조회

`GET /adventures/:adventureName/activity?season=<시즌 번호>`는 그 모험단 캐릭터 전체의 타임라인을 합쳐 한 시즌의 활동을 셉니다.
`season`이 없으면 지금 시즌(`seasons`에서 가장 최근에 시작한 시즌)이고, 정수가 아니거나 시작한 시즌에 없는 번호면 400 `INVALID_CHARACTER_QUERY`입니다. 다른 query key는 무시합니다.

```json
{
  "seasons": [
    { "id": 9, "name": "선계", "startsAt": "…", "available": false, "backfill": { "done": 12, "total": 30, "running": true } },
    { "id": 11, "name": "천해천", "startsAt": "…", "available": true }
  ],
  "season": { "id": 11, "startsAt": "…", "endsAt": null, "timelineStartsAt": "…" },
  "summary": {
    "raids": [{ "name": "디레지에 레이드", "count": 83, "hard": 21, "normal": 62 }],
    "legions": [{ "name": "아포칼립스", "count": 52 }],
    "items": { "legendary": 628, "epic": 412, "primeval": 6, "mythic": 1 },
    "enhancement": {
      "attempts": 510,
      "amplify": [{ "target": 13, "attempts": 4, "successes": 0 }],
      "reinforce": [{ "target": 15, "attempts": 2, "successes": 0 }],
      "amplifyBelow10": 239,
      "reinforceBelow12": 129,
      "refine": 66
    }
  },
  "days": [{ "date": "2026-07-18", "raid": 2, "legion": 1, "item": 7, "enhance": 5, "primeval": false, "mythic": false, "highEnhancement": false }]
}
```

`seasons`는 시작한 시즌을 오래된 순으로 주고, `available`은 집계할 수 있는 시즌인지입니다.
중천(10) 이후 시즌은 늘 `true`이고 `backfill`이 없습니다.
중천 전 시즌은 `backfill`에 [옛 시즌 받기](#모험단-옛-시즌-받기) 진행률을 주고, 지금 DB의 그 모험단 캐릭터가 모두 그 시즌을 끝까지 받았을 때만 `true`입니다.
`season.endsAt`은 다음 시즌 시작이며 지금 시즌은 `null`입니다. 시즌 구간은 `startsAt` 포함, `endsAt` 제외입니다.
`season.timelineStartsAt`은 기록이 있을 수 있는 첫 시각입니다. Neople 타임라인은 2017-09-21 00:00 KST부터라 마계(5)는 그 시각이고, 나머지 시즌은 `startsAt`과 같습니다.
`available`이 `false`인 시즌은 강화 백필 행이나 일부 캐릭터의 행만 있어 읽지 않고 빈 집계를 줍니다.

- 레이드(201, 210)와 레기온(209)은 [타임라인 조회](#타임라인-조회)의 `name`별 클리어 수이고, 횟수가 아니라 출시가 최근인 것부터 둡니다.
  레이드는 무너진 성자 미카엘라 (하드), (일반), (싱글/매칭), 디레지에 레이드 (하드), (일반), (매칭), 이내 황혼전, 만들어진 신 나벨 (하드), (일반), (싱글/매칭), 아스라한 (하드), (일반), (개전), 기계 혁명 (하드), (일반), (개전), 혼돈의 오즈마, 무형의 시로코, 프레이-이시스, 핀드워, 루크, 안톤 순입니다.
  레기온은 아포칼립스, 베누스, 깨어난 숲(극), 깨어난 숲(일반), 어둑섬, 차원회랑, 이스핀즈 순입니다.
  이름은 타임라인의 `raidName`, `regionName`과 글자까지 같아야 하고, 이 목록에 없는 이름은 목록에 있는 이름 뒤에 많은 순, 같으면 이름 순입니다.
  한 레이드의 본 레이드와 개전, 매칭 같은 단계는 `raidName`이 같고 `modeName`만 달라, `modeName`이 있으면 이름 뒤에 단계를 괄호로 붙입니다.
  `미카엘라 : 균열서`, `무의지의 장벽`은 `(싱글/매칭)`, `디레지에 : 서막`은 `(매칭)`, `무의 장막`, `개전`은 `(개전)`이고, 나머지 `modeName`은 본 레이드라 `hard`에 따라 `(하드)`, `(일반)`입니다.
  `modeName`이 없는 레이드는 `raidName`만 씁니다.
  레이드는 타임라인의 `hard`가 `true`인 클리어를 `hard`, 나머지를 `normal`로 나눠 세고 `count`는 둘의 합입니다. 레기온은 하드가 없어 `count`만 줍니다.
- `items`는 획득 코드(501~521, 550~557) 가운데 `item_rarity`가 레전더리, 에픽, 태초, 신화인 행의 수입니다.
- `enhancement.attempts`는 강화, 증폭, 재련(401~403) 전체 횟수입니다.
  `amplify`는 10증폭 이상, `reinforce`는 12강 이상 도전을 단계별로 센 시도와 성공이고, 그 아래는 `amplifyBelow10`, `reinforceBelow12`, 재련은 `refine`에 횟수만 셉니다.
- 단계 `target`은 타임라인의 `after`(Neople 설명: 성공 후 변경 예정 수치)입니다.
  실패도 `after`는 도전한 단계이고, 강화권, 증폭권처럼 여러 단계를 한 번에 올리는 기록은 `before + 1`보다 커서 `after`로 셉니다.
- `amplify`, `reinforce`의 단계별 시도와 성공은 강화권, 증폭권을 쓴 기록(`data.ticket`이 있고 `null`이 아닌 행)을 빼고 셉니다.
  권 기록도 `attempts`, `days`의 `enhance`, `highEnhancement`에는 들어갑니다.
- `days`는 활동이 있는 날만 오래된 순으로 줍니다. 하루는 06:00 KST에 바뀌어 05:59 기록은 전날입니다.
  `item`, `enhance`는 위와 같은 기준의 그날 횟수이고, `primeval`, `mythic`은 그날 태초, 신화를 얻었는지, `highEnhancement`는 그날 10증폭 이상이나 12강 이상 도전이 있었는지입니다.

조회는 [모험단 주간 클리어 조회](#모험단-주간-클리어-조회)처럼 캐릭터마다 타임라인 동기화를 queue에 넣고 끝나기를 기다리지 않습니다.
DB에 없는 모험단은 시즌 목록과 빈 집계를 주고, DB 설정이 없는 API는 `seasons`가 빈 목록, `season`이 `null`인 빈 집계를 줍니다.

### 모험단 옛 시즌 받기

`POST /adventures/:adventureName/activity/seasons/:season/backfill`은 지금 DB에 있는 그 모험단 캐릭터마다 중천 전 시즌(마계 5 ~ 선계 9) 하나의 모든 타임라인 코드를 Neople에서 받도록 queue에 넣고, 끝나기를 기다리지 않고 그 시즌의 받기 상태를 200으로 줍니다.
본문은 없고, 응답은 [시즌 활동 조회](#모험단-시즌-활동-조회)의 `seasons` 한 칸과 같은 모양입니다.
`season`이 정수가 아니거나, 시작하지 않았거나 중천 이후인 시즌, DB 설정이 없는 API는 400 `INVALID_CHARACTER_QUERY`입니다.

```json
{ "id": 9, "name": "선계", "startsAt": "2023-09-13T21:00:00.000Z", "available": false, "backfill": { "done": 12, "total": 30, "running": true } }
```

- 받는 구간은 시즌 시작부터 다음 시즌 시작 직전 분까지입니다. 마계는 Neople이 주는 첫 시각 2017-09-21 00:00 KST부터 받습니다.
  선계는 2025-01-09 05:59에서 끝나, 06:00부터 받는 정기 동기화 행과 겹치지 않습니다.
- 캐릭터마다 받은 위치 다음 분부터 시즌 끝까지 90일 이하 구간으로 나눠 앞 구간부터 받고, 구간마다 `next`를 끝까지 따라간 뒤 그 구간의 모든 코드 행을 바꿉니다.
  받은 위치는 `timeline_season_backfill`에 남고, 시즌 끝까지 받으면 `completed_at`을 남깁니다.
- 실패하면 그 캐릭터는 저장한 구간까지 남기고 멈춥니다. 다시 요청하면 저장한 구간 뒤부터 이어 받습니다.
- `done`, `total`은 그 모험단 캐릭터들의 90일 구간 수 합입니다. 캐릭터당 마계 4, 할렘 6, 귀환 9, THE NEXT JOURNEY 7, 선계 6구간입니다.
  `running`은 그 모험단의 캐릭터 가운데 그 시즌을 queue에서 기다리거나 받는 중인 캐릭터가 있는지입니다.
- 끝까지 받은 캐릭터는 다시 넣지 않고 다시 받지도 않습니다. 받는 중인 캐릭터와 시즌을 다시 요청하면 하나로 합칩니다.
- Queue는 정기 동기화, 강화 백필과 다른 메모리 queue이고 캐릭터와 시즌마다 합쳐 2개씩 처리합니다. 종료 때 대기열은 버리고 진행 중인 받기는 기다리지 않습니다.
  API가 다시 시작되면 받는 중이던 시즌은 멈추고, 다시 요청하면 이어 받습니다.
- 로그인이 없어 누구나 아무 모험단 이름으로 요청할 수 있고 호출 제한은 없습니다.

### 모험단 시즌 하루 활동 상세 조회

`GET /adventures/:adventureName/activity/seasons/:season/days`는 고른 시즌의 활동 기록이 있는 날마다 하루 상세를 날짜 순으로 줍니다.
하루는 06:00 KST부터 다음 날 06:00 KST 전까지입니다. 시작하지 않았거나 없는 시즌은 400 `INVALID_CHARACTER_QUERY`이고, 옛 시즌 받기가 끝나지 않으면 빈 목록을 줍니다.

```json
{
  "season": 11,
  "days": [{
    "date": "2026-07-18",
    "raids": [{ "name": "디레지에 레이드", "count": 1, "hard": 1, "normal": 0 }],
    "legions": [{ "name": "아포칼립스", "count": 1 }],
    "items": [{ "at": "2026-07-18T09:58:00+09:00", "name": "한계 : 선명한 광휘 결정", "rarity": "레전더리" }],
    "enhancements": [{ "at": "2026-07-18T10:02:00+09:00", "kind": "amplify", "target": 10, "success": true }]
  }]
}
```

- `raids`, `legions`는 그날의 이름별 클리어 수입니다. 순서와 레이드의 `hard`, `normal`은 시즌 조회와 같습니다.
- `items`는 시즌 조회의 `items`와 같은 기준(획득 코드 가운데 레전더리, 에픽, 태초, 신화)의 기록입니다.
  `name`은 `item_name`이고, `rarity`는 저장된 등급 이름 그대로입니다.
- `enhancements`는 강화, 증폭, 재련(401~403) 기록입니다.
  `kind`는 `reinforce`, `amplify`, `refine`이고, `target`은 시즌 조회와 같이 타임라인의 `after`, `success`는 `result`입니다.
- `items`, `enhancements`는 모험단 캐릭터 전체를 합쳐 시각 순이고, `at`은 `+09:00`을 붙인 KST 시각입니다.
  화면이 줄여 보여 주더라도 API는 그날 기록을 모두 줍니다.

타임라인 동기화는 요청하지 않습니다. DB에 없는 모험단은 빈 목록을 주고, DB 설정이 없는 API는 400을 줍니다.

### 명성 랭킹과 통계

`GET /rankings/fame`과 `GET /stats`도 Neople을 부르지 않고 DB에 저장된 캐릭터 기본 정보를 읽습니다.
명성은 각 행을 저장한 시점의 값입니다.

```json
{ "characters": [ { "rank": 1, /* 캐릭터 행 */ } ] }
{ "computedAt": "…", "total": 558178, "servers": [{ "serverId": "cain", "count": 231502 }], "jobs": [{ "jobId": "…", "jobGrowId": "…", "jobName": "…", "jobGrowName": "…", "count": 113107, "averageFame": 80123 }], "fameDistribution": [{ "from": 124000, "to": 125000, "count": 3123 }] }
```

랭킹은 명성이 있는 캐릭터를 명성이 높은 순(같으면 서버, 캐릭터 id 순)으로 100명까지 주고, `rank`는 1부터 매긴 순서입니다. 캐릭터 행은 모험단, 길드 조회와 같습니다.
선택 query `jobId`, `jobGrowId`로 거르며 `jobGrowId`는 `jobId`와 함께 씁니다. 서버는 통합되어 있어 서버로 거르지 않습니다. 빈 값, 같은 key의 중복과 `jobId` 없는 `jobGrowId`는 400 `INVALID_CHARACTER_QUERY`이고, `serverId`를 포함한 다른 query key는 무시합니다.
선택 query `role`(`dealer`, `buffer`)은 `jobId`, `jobGrowId`가 남성 크루세이더(프리스트(남), 眞 크루세이더)일 때만 받고, 캐릭터 행의 `role`과 같은 기준으로 그 역할인 캐릭터만 줍니다. 스킬 스타일 행이 없는 캐릭터는 어느 쪽에도 넣지 않습니다. 다른 전직, `jobGrowId` 없는 요청, 다른 값과 같은 key의 중복은 400 `INVALID_CHARACTER_QUERY`입니다.
`characters`의 `(fame DESC)`, `(job_id, fame DESC)`, `(job_id, job_grow_id, fame DESC)` index로 읽습니다. `role`이 있으면 전직 index로 명성 순으로 읽으며 행마다 스킬 스타일 PK로 역할을 거릅니다.

통계는 첫 요청 때 계산해 다음 0시(KST)까지 API 메모리에 캐시하고, 겹치는 요청은 한 계산을 함께 기다립니다. 실패는 캐시하지 않습니다. 캐시는 노드마다 따로 둡니다.
`total`과 `servers`는 모든 캐릭터 행, `jobs`는 기본 정보를 받은 행을 직업과 전직(이름 포함)별로 센 값이고 많은 순입니다. `jobs`는 랭킹의 직업 필터 목록으로도 씁니다.
`averageFame`은 명성이 있는 캐릭터의 평균을 반올림한 값이고, 그런 캐릭터가 없으면 `null`입니다.
`fameDistribution`은 명성이 있는 캐릭터를 1,000 단위 구간(`from` 포함, `to` 제외)으로 센 값이며 캐릭터가 있는 구간만 낮은 순으로 줍니다.
DB 설정이 없는 API는 빈 랭킹과, 0과 빈 목록인 통계를 줍니다.

### 스킬 채택률

`GET /stats/skills?jobId=&jobGrowId=`는 한 전직의 명성 상위 캐릭터가 스킬을 얼마나 찍었는지 줍니다.
Neople을 부르지 않고 DB의 `characters`와 `character_skill_styles`를 읽습니다.
스킬 스타일 행은 [상세 조회](#캐릭터-기본-정보-저장)가 저장한 것뿐이라, 표본 가운데 누군가 상세를 조회한 캐릭터만 셉니다.

```json
{ "computedAt": "…", "topCount": 5000, "minFame": 100028, "sampleSize": 2316,
  "skills": [{ "name": "발도", "learned": 2201, "levels": [[1, 30], [13, 2171]] }],
  "evolutions": [{ "name": "발도", "type1": 1500, "type2": 650 }],
  "enhancements": [{ "name": "발도", "type1": 300, "type2": 1800 }] }
```

- 두 query는 모두 필수이고, 빈 값과 같은 key의 중복은 400 `INVALID_CHARACTER_QUERY`입니다.
- 선택 query `role`은 [명성 랭킹](#명성-랭킹과-통계)과 같이 남성 크루세이더일 때만 받고, 표본 가운데 그 역할로 판정된 캐릭터만 셉니다. 표본(`topCount`, `minFame`)은 `role`이 없을 때와 같습니다.
- 표본은 그 전직에서 명성이 있는 캐릭터 가운데 명성 상위 `topCount`위까지(같은 명성은 같은 순위)이고, `minFame`은 표본의 최저 명성입니다(표본이 없으면 `null`).
- `sampleSize`는 표본 가운데 스킬 스타일 행이 있고, 그 행을 받을 때의 전직이 지금 전직과 같은 캐릭터 수입니다. `skills`, `evolutions`, `enhancements`도 이 캐릭터만 셉니다.
- `skills`의 `learned`는 그 스킬을 배운 캐릭터 수, `levels`는 `[레벨, 캐릭터 수]`를 레벨 순으로 둔 것입니다. 채택률의 분모는 `sampleSize`, 개화와 강화 비율의 분모는 그 스킬의 `learned`입니다.
- 목록은 모두 스킬 이름 순입니다.
- 전직과 `role`마다 첫 요청 때 계산해 다음 0시(KST)까지 API 메모리에 캐시하고, 겹치는 요청은 한 계산을 함께 기다립니다. 실패와 명성이 있는 캐릭터가 없는 전직(`minFame`이 `null`)은 캐시하지 않습니다.
- 표본은 `characters`의 `(job_id, job_grow_id, fame DESC)` index로, 스킬 스타일은 PK로 읽습니다.
- DB 설정이 없는 API는 `sampleSize` 0과 빈 목록을 줍니다.

### 캐릭터 수집 worker

`node dist/character-collector.js`는 HTTP 없이 도는 별도 프로세스입니다. API와 다른 컨테이너 하나로 띄우며 migration은 적용하지 않으므로, schema를 바꾼 API 이미지가 먼저 시작해야 합니다.
입력은 Neople key, DB 설정(필수), `CHARACTER_IMPORT_FILES`(캐릭터 목록 파일 `characters.jsonl`의 절대 경로를 쉼표로 이은 목록, 목록을 여러 컨테이너로 나눠 모으면 파일도 여러 개), `CHARACTER_COLLECTOR_REQUESTS_PER_SECOND`(Neople 초당 요청 상한, 기본 5), `CHARACTER_COLLECTOR_CONCURRENCY`(한 번에 함께 처리할 캐릭터 수, 1~32, 기본 1)입니다. 잘못된 입력은 `Character collector failed`와 nonzero exit로 끝납니다.

1. 목록 파일마다 수정 시각을 기억하고, 바뀐 파일만 줄마다 `server`, `key`를 Neople serverId, characterId로 읽어 1000개씩 `character_collection`에 넣습니다. 이미 대기열에 있거나 기본 정보를 저장한 캐릭터는 넣지 않으므로 같은 파일을 다시 읽어도 Neople을 다시 부르지 않습니다.
2. 대기열의 캐릭터를 넣은 순서(같은 시각이면 서버, 캐릭터 id 순)대로 100명씩 꺼내 `GET /df/servers/<serverId>/characters/<characterId>`를 부르고, 이름, 모험단, 레벨, 직업, 명성, 길드와 `basic_fetched_at`을 `characters`에 저장한 뒤 대기열에서 지웁니다. 한 번 저장한 캐릭터는 다시 조회하지 않습니다. 동시 처리 수만큼 묶어 함께 부르고, 묶음마다 요청 수에 맞는 간격을 채워 평균 속도가 초당 상한을 넘지 않게 합니다.
3. 없는 캐릭터나 schema가 맞지 않는 응답(모험단 이름이 없는 경우 포함)은 대기열 행의 `failure`(`neople-api`, `neople-internal`)에 남기고 재시도하지 않습니다. 한도 초과, 점검, timeout이면 기록하지 않고 1분 쉰 뒤 같은 캐릭터부터 다시 부릅니다. 대기열이 비면 1분 쉽니다.
4. 목록 파일 하나를 읽을 때마다 `CHARACTER_IMPORT_DONE`(`count`), Neople을 쓸 수 없을 때 `CHARACTER_NEOPLE_UNAVAILABLE`을 stdout JSON 한 줄로 남깁니다. DB 오류와 잘못된 목록 파일 줄은 프로세스를 끝내므로 컨테이너 재시작 정책으로 다시 띄웁니다.
5. 종료 처리는 따로 두지 않아 SIGTERM, SIGINT를 받으면 그대로 끝납니다. 진행 중인 Neople 요청은 끊지 않고 버려지며, 저장은 transaction이라 반만 남지 않습니다. 저장 전에 끝난 캐릭터는 대기열에 남아 다음 시작 때 다시 부르고, 대기열 넣기는 다시 해도 같은 결과라 목록 파일도 처음부터 다시 읽습니다.

Neople 연결 실패, 잘못된 key, 429와 503을 뺀 HTTP 오류도 `neople-api`로 분류되므로, 장애가 길면 그동안 부른 캐릭터가 모두 실패로 남습니다. 장애가 끝난 뒤 관리자가 `UPDATE character_collection SET failure = NULL, attempted_at = NULL WHERE attempted_at >= <장애 시작 시각>`으로 되돌리면 worker가 다시 부릅니다.

Migration 파일, 설정 읽기와 CLI는 `packages/database`에 있습니다. 만드는 법은 [`@dfragon/database` 안내](../../packages/database/README.md#빌드와-migration)를 따릅니다.
Migration을 더하는 PR에는 이전 이미지가 새 schema로 뜨는지와 되돌릴 수 없는 변경이 있는지를 적습니다.

## 로컬 개발 명령

API는 `https://localhost:3443`을 사용합니다. 운영 credential을 개발에 사용하지 않습니다.

```sh
pnpm --filter @dfragon/api dev
```

`LOCAL_HTTPS_CERT_FILE`, `LOCAL_HTTPS_KEY_FILE`을 신뢰한 localhost 인증서의 절대 경로로 설정하고
`API_ORIGIN=https://localhost:3443`을 지정합니다. TLS 파일의 key 일치, localhost/port 입력을 listen 전에 확인하며
client의 실제 신뢰 체인 검증을 끄지 않습니다.
별도 Node client의 개발 CA는 실행 전 `NODE_EXTRA_CA_CERTS`에 공개 CA certificate를 지정합니다.
브라우저는 OS 인증서 신뢰를 사용하며 인증서 오류를 무시하지 않습니다.

## 시작, 종료와 검증

실제 캐릭터의 스킬 계수, 쿨타임을 별도 설치한 비공개 패키지로 확인하는 선택 명령은
[스킬 패키지 검증](#비공개-스킬-패키지-검증)을 참고합니다. 서버를 시작하지 않습니다.

`build` 후 `start`로 compiled ESM entry를 실행할 수도 있습니다. 설정, listen 실패는
`API failed to start`와 nonzero exit만 남깁니다. Secret, 파일 경로, stack을 기록하지 않습니다.

`pnpm --filter @dfragon/api test`는 HTTP, 설정과 build를 검증합니다. 이미지 입력과 운영 책임은 [서버 이미지](#서버-이미지)를 따릅니다.
로컬 성공은 실제 DNS/TLS 검증을 대신하지 않습니다.

## 접근 로그

API는 요청마다 stdout에 JSON 한 줄을 남깁니다(`apps/api/src/access-log.ts`).
필드는 `time`, `service`, `method`, route template, `status`, 오류 `code`, 5xx의 정제한 `errorChain`, `durationMs`, `correlationId`, 연결이 먼저 끊긴 요청의 `aborted`입니다.
URL, query, header, body, 오류 message와 캐릭터 ID, 이름은 남기지 않습니다.

`GET /characters/:serverId/:characterId`와 `POST /characters/:serverId/:characterId/refresh`에는 Neople을 기다린 단계별 시간을 `neopleMs`에 정수 ms로 붙입니다.
`basic`은 기본정보, `sections`는 나머지 섹션 10개의 병렬 조회, `catalog`는 공용 아이템 조회입니다.
실패한 요청은 성공한 단계까지만 남습니다.
같은 캐릭터의 겹친 요청은 기본정보와 섹션 조회를 공유하므로 그 조회를 기다린 요청들에 같은 `basic`, `sections` 값이 붙고, 진행 중인 조회에 합류한 요청에는 `neopleShared: true`가 붙습니다.
캐릭터 캐시가 맞았지만 저장한 응답 본문이 없는 요청은 Neople을 기다리지 않으므로 `basic`, `sections` 없이 `catalog`만 남습니다.
저장한 응답 본문을 그대로 보낸 요청은 Neople도 공용 아이템도 기다리지 않으므로 `neopleMs` 없이 `responseCached: true`가 붙습니다.
`responseCached`는 상세 GET과 강제 갱신, 후보 검색에만 붙고, 저장한 본문 없이 새로 만든 응답에는 붙지 않습니다.
강제 갱신은 캐시를 건너뛰므로 새로 받았거나 합류한 조회의 `basic`, `sections`가 붙습니다.
`catalog`는 그 요청이 공용 아이템 정보를 기다린 시간입니다.
공용 아이템은 24시간 캐시하므로 모든 아이템이 캐시에 있으면 거의 0이고, 다른 요청이 이미 조회 중인 아이템은 그 조회를 함께 기다립니다.

`GET /characters/:serverId/:characterId/image`는 저장하지 않고 매번 네오플 이미지 서버를 부르며 `neopleMs`, `responseCached`를 붙이지 않습니다.

`GET /characters/candidates`는 이름별로 24시간 캐시하며 `neopleMs`를 붙이지 않습니다.
저장한 결과를 보낸 요청에는 `responseCached: true`, 같은 이름의 진행 중인 검색에 합류한 요청에는 `neopleShared: true`가 붙고, Neople을 직접 기다린 요청에는 둘 다 붙지 않습니다.
상세와 같은 뜻이라 같은 필드를 쓰며, 둘은 route로 구분합니다.

```json
{"time":"2026-10-29T00:00:00.000Z","service":"api","method":"GET","route":"/characters/:serverId/:characterId","status":200,"durationMs":512,"neopleMs":{"basic":88,"sections":231,"catalog":176},"correlationId":"<uuid>"}
{"time":"2026-10-29T00:00:05.000Z","service":"api","method":"GET","route":"/characters/:serverId/:characterId","status":200,"durationMs":4,"neopleMs":{"catalog":1},"correlationId":"<uuid>"}
{"time":"2026-10-29T00:00:09.000Z","service":"api","method":"GET","route":"/characters/:serverId/:characterId","status":200,"durationMs":0,"responseCached":true,"correlationId":"<uuid>"}
{"time":"2026-10-31T00:00:00.000Z","service":"api","method":"GET","route":"/characters/candidates","status":200,"durationMs":0,"responseCached":true,"correlationId":"<uuid>"}
```

점수 엔진을 열지 못하면 `SCORE_ENGINE_UNAVAILABLE`, 점수 worker가 오류로 끝나거나 엔진 결과 형식이 틀리면 `SCORE_ENGINE_FAILED`를 같은 stdout에 남깁니다.
[타임라인 동기화](#타임라인-동기화)가 실패를 DB에 기록하지 못하면 `TIMELINE_SYNC_FAILED`, 강화 백필이 실패하면 `TIMELINE_BACKFILL_FAILED`, [옛 시즌 받기](#모험단-옛-시즌-받기)가 실패하면 `TIMELINE_SEASON_BACKFILL_FAILED`, [기본 정보 저장](#캐릭터-기본-정보-저장)이 실패하면 `CHARACTER_BASIC_RECORD_FAILED`, 스킬 스타일 저장이 실패하면 `CHARACTER_SKILL_STYLE_RECORD_FAILED`를 남깁니다.
요청마다 남기는 줄과 달리 `time`, `service`, `code`만 담습니다.

```json
{"time":"2026-11-01T00:00:00.000Z","service":"api","code":"SCORE_ENGINE_UNAVAILABLE"}
```

## 서버 이미지

API와 웹([웹 이미지](../web/README.md#웹-이미지)) 이미지는 node1이 운영자가 고른 main commit을 빌드해 배포합니다.
빌드, 배포 절차와 이미지 이름, 비밀값 관리와 전달, Compose, SSH, 서버 권한의 원본은
[인프라 운영 안내](https://github.com/dungeon-and-dragon/dfragon-infra/blob/main/deploy/linux/README.md)입니다. 제품 main merge는 이미지를 빌드하거나 배포하지 않습니다.

제품은 테스트와 Dockerfile, 앱 실행 진입점을 소유합니다. node1 빌드는 테스트를 실행하지 않으며
테스트는 로컬의 `pnpm verify`가 맡습니다. 대상 플랫폼은 `linux/amd64` 하나입니다.
빌드한 제품 commit은 `SOURCE_COMMIT` 빌드 인자로 받아 이미지 내부 `/app/build-info.json`에 고정합니다.
node1은 컨테이너를 시작하지 않고 이 파일을 꺼내 서비스명과 commit을 대조합니다.

Dockerfile과 전용 ignore 파일은 `apps/api/`에 있습니다. 빌드 context는 제품 저장소 root이며
`docker-entrypoint.sh`도 앱 옆에서 관리합니다. 의존성 설치에는 registry 토큰이나 BuildKit secret이 필요하지 않습니다.
이미지는 `packages/models/score-engine/libdnfscore.so`의 Linux 엔진과 `koffi`를 넣고, 엔진의 제3자 고지(`packages/licenses/notices/score-engine`)를 `dist/notices/score-engine`에 둡니다.
Prisma schema engine이 OpenSSL 3용으로 설치되도록 빌드 단계에 `openssl`을, 런타임 이미지에 `libssl3`을 둡니다.
엔진 파일이 없으면 빌드에 실패합니다.
node1은 `packages/models/score-engine.lock.json`이 고정한 엔진 commit으로 라이브러리를 빌드해 이 경로에 둔 뒤 이미지를 빌드합니다.
로컬 빌드는 [엔진 라이브러리를 직접 빌드해](../../packages/models/README.md#점수-엔진) 같은 경로에 둔 뒤 다음과 같이 합니다.

```sh
docker build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/api/Dockerfile -t dfragon-api:local .
```

커밋 정보는 커밋한 checkout을 기준으로 넣습니다. 빌드 인자를 생략한 로컬 이미지는 `commit: null`로
정보 없음을 명시합니다. 잘못된 SHA는 빌드에 실패하며, node1이 빌드한 이미지는 정확한 SHA가
없으면 검증을 통과하지 못합니다. 비밀값은 빌드 인자로 전달하지 않습니다.

### 실행 중인 서버의 버전 조회

API는 로그인 없이 `GET /version`으로 다음 정보를 제공합니다.

```json
{
  "service": "api",
  "commit": "<40-character-commit-sha>"
}
```

응답에는 서비스명과 이미지에 고정된 제품 commit만 포함하며 `Cache-Control: no-store`를 사용합니다.
시작 시 런타임 환경변수나 최신 GitHub main에서 commit을 덮어쓰지 않습니다. 이전 이미지로
복귀하면 그 이미지에 내장된 commit이 반환됩니다. 파일이 없는 로컬 실행이나 손상된 정보는
`commit: null`로 표시하고, 이 기능이 없는 이전 서버는 `/version`을 제공하지 않을 수 있습니다.
기존 health 응답 형식은 유지합니다.

## 이미지 실행 계약

아래는 제품 이미지가 요구하는 입력과 명령입니다. 서버 자원 준비, 실행 순서와 복구 판단은 인프라 절차를 따릅니다.

`apps/api/Dockerfile`로 만들며 UID/GID `1000:1000`의 `node` 사용자로 실행합니다. 아래는 이미지 자체의 입력입니다.

- `PORT`(현재 3000)를 반드시 지정합니다. `EXPOSE 3000`은 `PORT`의 기본값을 설정하지 않습니다.
- Neople key는 위 직접 입력 또는 `_FILE` 입력을 사용합니다. 둘 다 생략한 경우에만
  entrypoint가 `/run/secrets/neople_api_key`를 기본 파일로 선택합니다. Neople key는 필수입니다.
  `SEARCH_TRUST_PROXY`는 생략하거나 기존 단일 proxy 구성에서만 `single-hop`을 사용합니다.
- DB 설정은 선택입니다. `DB_HOST`를 지정하고 비밀번호 입력을 둘 다 생략한 경우에만
  entrypoint가 `/run/secrets/db_password`를 기본 파일로 선택합니다.
- `GET /health`의 200과 `{"status":"ok"}`는 HTTP 시작 확인입니다. 요청마다 Neople 연결을
  재검사하는 readiness는 아니며, 검색 성공 검증과 구분합니다.

이미지의 기본 CMD는 `node --import reflect-metadata dist/main.js`입니다. [캐릭터 수집 worker](#캐릭터-수집-worker)는 CMD를 `node dist/character-collector.js`로 바꿔 실행하며, entrypoint의 Neople key, DB 비밀번호 기본 파일 선택은 같습니다. Migration은 이 CMD가 시작할 때 적용하며 별도 migration, cleanup 명령은 없습니다.
이미지 빌드에는 운영 설정, secret, 실데이터를 제공하지 않습니다.

이미지 실행 계약은 로컬에 있는 이미지로 `node apps/api/test-support/container-deployment.mjs dfragon-api:local`을 실행해
확인합니다. UID, 읽기 전용 파일시스템, Neople key의 ENV, FILE, 기본 파일 입력, 잘못된 입력의 거절과 정상 종료를 봅니다.
DB를 붙인 실행은 `node apps/api/test-support/container-database.mjs dfragon-api:local`로 확인합니다.
옛 시즌 받기는 합성 행으로 구간 양 끝 분의 교체, 강화 백필 행의 교체, 받은 위치 이동과 끝까지 받음 기록, 다른 캐릭터와 구간 밖 행, 정기 동기화와 강화 백필 위치를 바꾸지 않는 것을 봅니다.
모험단 조회는 합성 행을 Neople 대신 주는 fake로 옛 시즌을 받아, 모든 캐릭터가 받은 시즌의 집계와 하루 상세, 한 캐릭터만 받은 시즌의 빈 집계, 다 받은 시즌의 받기 요청을 봅니다.
검색 후보는 합성 검색 결과에 저장된 캐릭터와 없는 캐릭터의 모험단명을 붙이고, 모험단 이름이 바뀐 뒤 캐시에서 준 후보도 새 이름을 받는지 봅니다.
타임라인 조회는 합성 행으로 주간 경계 앞뒤, 시즌 경계, 최근 50개, 빈 캐릭터와 진행 중인 동기화를 기다린 조회를 봅니다.
명성 랭킹과 통계는 합성 행으로 직업과 전직 필터, 명성이 없는 캐릭터 제외, 100명 상한, 명성 구간 경계, 직업별 평균 명성과 API의 통계 캐시를 봅니다.
남성 크루세이더는 합성 딜러, 버퍼, 스킬 스타일 행이 없거나 다른 전직으로 받은 캐릭터와 여성 크루세이더로 `role`별 랭킹과 채택률, 캐릭터 행의 `role`, 여성 크루세이더 `role` query의 400, `role`별로 나뉜 채택률 캐시를 봅니다.
PostgreSQL 18.6 컨테이너에 `public` schema만 소유한 계정을 만들고, 테스트가 Prisma의 advisory lock을 잡은 동안 API 컨테이너 두 개가 기록 테이블을 만들지 않고 기다리는지 봅니다.
Lock을 풀면 migration 적용, HTTP 기동, 정상 종료를 봅니다.
실패하는 migration이 nonzero로 끝나고 실패로 기록되는지, 잘못된 비밀번호, 비밀번호 파일 누락, 일부만 있는 DB 설정이 nonzero로 끝나는지도 봅니다.
수집 worker는 빈 대기열에서 DB에 붙은 채 실행 중인지, SIGTERM으로 끝나는지, `CHARACTER_IMPORT_FILES`가 없으면 `Character collector failed`로 끝나는지 봅니다. 대기열이 비어 있어 Neople은 부르지 않습니다.

### Migration 실패 복구

새 이미지의 migration이 실패하면 배포 helper가 이전 이미지로 복귀하고, `_prisma_migrations`에 실패 기록이 남아 같은 이미지를 다시 배포해도 `P3009`로 뜨지 않습니다.
관리자(ldbadmin)가 node1에서 실패한 이미지로 아래 명령을 실행해 정리합니다. 연결 정보는 운영 API 컨테이너와 같은 env 4개와 비밀번호 파일을 쓰며, 비밀번호는 파일 mount로만 넘겨 `docker run` 명령 인자에 드러나지 않습니다. 명령이 도는 동안 schema engine의 명령 인자에는 보입니다.
Secret 파일의 host 경로와 network 이름은 [인프라 운영 안내](https://github.com/dungeon-and-dragon/dfragon-infra/blob/main/deploy/linux/README.md)의 현재 값을 확인해 씁니다.

```sh
IMAGE=localhost/dfragon/api:<실패한 이미지의 40자리 commit SHA>
prisma_admin() {
  docker run --rm --read-only --user 1000:1000 --cap-drop ALL --network dfragon_backend \
    --env DB_HOST=postgres --env DB_PORT=5432 --env DB_NAME=dfragon --env DB_USERNAME=dfragon_api \
    --mount type=bind,source=/etc/dfragon/secrets/dfragon_api_password,target=/run/secrets/db_password,readonly \
    "$IMAGE" node node_modules/@dfragon/database/dist/cli.js "$@"
}
prisma_admin migrate status
```

1. `migrate status`로 실패한 migration 이름을 확인합니다.
2. Migration이 `BEGIN`, `COMMIT`으로 감싸여 있으면 DB에 남은 변경이 없습니다. 감싸지 않은 migration이면 그 SQL에서 실행된 문장을 DB 관리자 계정으로 직접 되돌립니다.
3. `prisma_admin migrate resolve --rolled-back <migration 이름>`으로 실패 기록을 되돌린 것으로 표시합니다.
4. 원인을 고친 이미지를 다시 배포하면 시작할 때 그 migration을 다시 적용합니다.

## 비공개 스킬 패키지 검증

`apps/api`의 `verify:skills`는 GitHub Packages에 게시된 `@blahaj94/dfragon-skills`를
별도 설치 디렉터리에서 읽고, 실제 캐릭터의 스킬 계수, 쿨타임을 계산하는 선택 실행 명령입니다.
현재 `weapon_master`만 지원하며 규칙의 직업, 전직 ID와 캐릭터의 직업, 전직 ID를 정확히 비교합니다.
각성 단계의 호환 관계를 직업 이름으로 추정하지 않습니다.

### 설치와 실행

패키지 읽기 권한이 있는 인증을 별도 npm 설정에서 준비한 뒤, workspace 밖의 절대 경로에
검증할 버전을 설치합니다. 인증값과 실제 캐릭터 정보는 저장소, 문서, PR에 기록하지 않습니다.
GitHub Packages 인증 설정은 [공식 안내](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)를 따릅니다.
별도 npm 설정에서는 `@blahaj94:registry=https://npm.pkg.github.com`으로 scope만 지정하고,
`ajv` 등 일반 의존성이 설치되도록 기본 registry는 npmjs로 유지합니다.

```sh
npm install --prefix /absolute/path/to/skill-package --save-exact \
  @blahaj94/dfragon-skills@0.1.0

NEOPLE_API_KEY_FILE=/absolute/path/to/neople-key \
  pnpm --filter @dfragon/api verify:skills \
  --server siroco --character '<캐릭터명>' --profile weapon_master \
  --package-directory /absolute/path/to/skill-package
```

`--package-directory`는 패키지 소스 경로가 아니라 `npm install --prefix`로 사용한 디렉터리입니다.
Node 26과 기존 workspace 의존성이 필요합니다. 명령은 먼저 API를 빌드하며, 이미 빌드했다면
`pnpm --filter @dfragon/api exec node --import reflect-metadata test-support/verify-skill-calculation.mjs`에 같은 인자를
전달할 수 있습니다. `NEOPLE_API_KEY` 직접 입력도 지원하나 `_FILE`과 동시에 지정하면 실패합니다.
PORT, DB 설정, HTTP 서버, DB 연결은 사용하지 않습니다.

정규 dependency와 lockfile에 비공개 패키지를 추가하지 않습니다. GitHub Actions의 배포 workflow와 Docker build에는
패키지 권한이나 secret이 필요하지 않으며, 일반 `test`에는 합성 입력을 사용하는 회귀 검사만 포함됩니다.

### 입력과 결과의 의미

- 기존 Neople 검색, 11개 상세, 스킬 카탈로그 adapter를 재사용합니다. 검색, 상세는 HTTP client 기본 timeout을 따르고,
  스킬 상세도 ky의 HTTP client 기본 timeout을 따릅니다. 필요한 모든 스킬 상세를 한 번에 동시에
  조회하며 실패를 재시도하지 않습니다. DB에 저장하지 않습니다.
- active, passive의 API 레벨을 `selectedLevel`로 전달합니다. 무기의 극의 등 패시브 효과는
  패키지가 순서대로 적용하며 결과의 `effectiveLevel`을 함께 표시합니다.
- evolution의 type은 `vp`, enhancement의 type은 `up`에 전달합니다. 미지원 선택, 범위 밖 레벨,
  필수 목록 누락은 실패합니다. 프로필 밖 일반 스킬은 `excluded`에 명시합니다.
- 모드는 API 자료로 추정하지 않고 패키지의 무기별 기본 모드를 사용합니다. 스킬 체인 선택은
  반영하지 않으며 이 한계를 결과에 표시합니다.
- JSON 요약에는 패키지 버전, 캐릭터 확인값, 계산, 보류, 비공격, 미습득, 제외 개수와 습득 스킬별
  계수, 쿨타임, 경고를 담습니다. 보류는 0으로 바꾸지 않습니다. 실패는 고정 코드, 문구와 종료 코드 1이며
  API 원문, key, URL, stack을 출력하지 않습니다.

이 검증은 실제 API 입력을 패키지에 연결하는 범위입니다. 장비, 스탯, 대상 방어를 합산한 데미지,
최적 모드, 인게임 실측과의 일치를 보장하지 않습니다. 캐릭터 상세와 여러 스킬 API 호출이 같은 순간의
snapshot이라는 보장도 없습니다.
장비의 스킬 레벨, 스탯, 추가 쿨타임 감소, 특수 무기 보정은 별도로 입력하지 않으며,
API가 보고한 스킬 레벨과 장착 무기 종류를 사용합니다. 특수 무기 분류, 보정은 현재 패키지의
공개 계산 입력에서 지정할 수 없습니다.

합성 입력 변환, 실패, 동시성 검사는 API `test`에 포함됩니다. 이미 빌드된 상태에서는 다음 명령으로
해당 범위만 확인할 수 있습니다.

```sh
node --test apps/api/test-support/skill-calculation.test.mjs
```

### 저장된 입력과 실측의 오프라인 비교

`verify-skill-measurement.mjs`는 저장된 스킬 상세로 다시 계산하고, 기준 스킬 한 개의 실측으로
공통 배율을 구해 다른 스킬의 실측과 비교합니다. Neople 호출, credential, DB를 사용하지 않습니다.
API build 후 다음 명령을 사용합니다. 세 경로는 모두 절대 경로입니다.

```sh
pnpm --filter @dfragon/api exec node --import reflect-metadata \
  test-support/verify-skill-measurement.mjs \
  --package-directory /absolute/path/to/skill-package \
  --snapshot /absolute/path/to/snapshot.json \
  --observations /absolute/path/to/observations.json
```

Snapshot은 `details.character`의 `jobId`, `jobGrowId`, `details.equipment.equipment`,
`details.skillStyle.style`, `details.status.status`와 `catalog`를 갖습니다. `catalog`에는 패키지가
요구하는 모든 스킬의 `{key: {kind: "skill", jobId, skillId}, payload}`가 있어야 합니다.
캐릭터 이름, ID는 필요하지 않습니다. Snapshot과 실측 원문은 저장소 밖에서 보관합니다.

아래 관측 예시는 **합성 값**입니다. 실제 입력에는 패키지의 정확한 스킬 ID와 확인한 값을 사용합니다.
두 측정의 `contextId`와 `targetLevel`은 공통 `context`와 일치해야 하며, 서로 다른 대상 레벨에서
측정한 결과를 섞으면 실패합니다. 장비, 버프, 도핑, 치명타, 전체 명중 조건의 동일성은 사용자가
확인해 `conditions`에 적습니다. 이 입력만으로 환경이 같았다는 사실을 자동 검증하지 않습니다.
`context.id`, `conditions`, `source`는 로컬 결과에 표시되므로 개인정보, 비밀값, 개인 파일 경로를 넣지 않습니다.

```json
{
  "context": {
    "id": "synthetic-session",
    "target": { "kind": "sandbag", "level": 110 },
    "conditions": ["동일한 합성 장비", "전체 명중", "도핑 없음"],
    "status": [{ "name": "힘", "value": 2000 }]
  },
  "levelOverrides": [
    { "skillId": "reference-id", "level": 2, "source": "합성 인게임 관측" },
    { "skillId": "comparison-id", "level": 3, "source": "합성 인게임 관측" },
    { "skillId": "passive-id", "level": 8, "source": "합성 장비 레벨 보정" }
  ],
  "reference": {
    "skillId": "reference-id", "level": 2,
    "contextId": "synthetic-session", "targetLevel": 110,
    "damage": 100, "multiplier": { "value": 1, "source": "추가 보정 없음" }
  },
  "comparison": {
    "skillId": "comparison-id", "level": 3,
    "contextId": "synthetic-session", "targetLevel": 110,
    "damage": 330, "multiplier": { "value": 1.5, "source": "합성 장비의 해당 스킬 증가" }
  }
}
```

`reference.level`, `comparison.level`은 인게임 표시 레벨이며 패키지 결과의 `effectiveLevel`과
비교합니다. `levelOverrides[].level`은 패키지에 전달할 **selectedLevel**입니다. 다른 패시브가
가산하는 레벨은 중복 입력하지 않고 출처에 환산 근거를 적습니다. 결과에는 API 원래 레벨,
입력한 레벨, 패키지가 계산한 최종 레벨과 출처를 함께 표시합니다. `context.status`의 이름은
snapshot 상태명과 정확히 일치해야 하며, 원래 상태값과 관측값을 나란히 표시할 뿐 산식에 재곱하지 않습니다.

계산은 `보정값 = 기준 실측 / (기준 effectiveCoefficient × 기준 개별 배율)`,
`비교 예측 = 비교 effectiveCoefficient × 비교 개별 배율 × 보정값` 순서입니다.
비교 스킬 실측은 오차 계산에만 사용합니다. 오차율은 `(예측 − 실측) / 실측 × 100`이며,
음수는 예측이 실측보다 작다는 뜻입니다. `panelMultiplier`는 이미 계수에 포함되어 다시 곱하지 않습니다.
칭호 등 스킬별 추가 배율은 `multiplier`로 한 번 적용하며, 패키지에 이미 포함된 증가를 중복 입력하면 안 됩니다.

이 방법은 동일 환경의 공통 배율을 실측으로 흡수합니다. 절대 데미지 공식, 전체 장비 효과, 대상 방어를
재현한 검증이 아닙니다. 현재 맹룡 개화의 추가 회오리와 모델 타수의 대응은 확인되지 않았고,
감전 피해는 별도로 포함하지 않습니다. 패키지의 연구 모델, 보류 경고를 유지합니다.

기존 입력 변환과 오프라인 비교 회귀 검사는 다음 명령으로 확인합니다.

```sh
node --test apps/api/test-support/skill-calculation.test.mjs \
  apps/api/test-support/skill-measurement.test.mjs
```
