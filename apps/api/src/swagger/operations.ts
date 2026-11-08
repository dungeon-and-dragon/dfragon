import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger'
import { CHARACTER_ID_PATTERN_SOURCE } from '../characters/identity.js'
import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'

function success(schema: string, description: string) {
  return ApiResponse({
    status: 200,
    description,
    schema: { $ref: `#/components/schemas/${schema}` }
  })
}

function errors(definitions: Record<number, string>) {
  return applyDecorators(
    ...Object.entries(definitions).map(([status, description]) =>
      ApiResponse({
        status: Number(status),
        description,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
      })
    )
  )
}

const neopleFailures = {
  500: 'INTERNAL_SERVER_ERROR',
  502: 'NEOPLE_API_ERROR',
  503: 'NEOPLE_UNAVAILABLE',
  504: 'NEOPLE_TIMEOUT'
}

export function ApiCharacterSearch() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 검색',
      description:
        '공개 API. Neople wordType=full로 검색한 뒤 이름이 characterName으로 시작하는 캐릭터만 반환합니다. characterName이 한 글자면 wordType=full이 받지 않으므로 wordType=match로 검색해 이름이 같은 캐릭터만 반환합니다. 행의 모양은 후보 조회와 같고, 캐릭터 이름순으로 반환합니다. 검색 결과는 저장하지 않습니다. IP별, 서버 전체 호출 제한은 없습니다. 중복, 알 수 없는 query key는 거절합니다.'
    }),
    ApiQuery({
      name: 'characterName',
      required: true,
      schema: { type: 'string', minLength: 1, maxLength: 12 },
      description: 'Unicode code point 1~12개. 앞뒤 공백 불가, 정규화 없음.'
    }),
    ApiQuery({
      name: 'serverId',
      required: false,
      schema: { type: 'string', enum: ['all', ...NEOPLE_SERVER_NAMES.keys()], default: 'all' }
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 200, default: 10 },
      description: 'ASCII 십진 숫자만 허용. 선행 0 허용.'
    }),
    success('CharacterCandidatesResult', '검색 결과 (0건이면 빈 rows)'),
    errors({ 400: 'INVALID_SEARCH_QUERY', ...neopleFailures })
  )
}

export function ApiCharacterCandidates() {
  return applyDecorators(
    ApiOperation({
      summary: 'OCR 닉네임의 캐릭터 비교 후보 조회',
      description:
        '공개 API. 닉네임 하나를 전체 서버에서 정확히 일치하는 wordType=match로 검색합니다. fame이 있는 후보를 내림차순, fame이 null인 후보를 뒤에 반환하며 동률과 null 사이에는 공급자 순서를 유지합니다. jobName, jobGrowName은 Neople 검색 응답의 값이며 없으면 null입니다. adventureName은 DB에 저장된 그 캐릭터의 모험단명이며 저장되지 않았거나 DB 설정이 없으면 null입니다. Neople 상세를 조회하지 않고 후보 전체를 query 한 번으로 읽습니다. imageUrl은 zoom=1인 전체 캐릭터 이미지이며 얼굴 크롭과 비교는 Web에서 수행합니다. 반환 순서대로 비교하여 기준을 먼저 통과한 캐릭터를 선택하고, 모두 실패한 뒤 다음 OCR 닉네임을 요청합니다. 후보가 있는 Neople 검색 결과는 이름별로 API 메모리에 24시간 캐시하며, 실패와 빈 결과는 캐시하지 않습니다. 모험단명은 캐시하지 않고 응답할 때마다 DB에서 읽습니다. 이미지는 API에 저장하지 않습니다. IP별, 서버 전체 호출 제한은 없습니다. characterName 외 query key와 중복 query는 거절합니다.'
    }),
    ApiQuery({
      name: 'characterName',
      required: true,
      schema: { type: 'string', minLength: 1, maxLength: 12 },
      description: 'Unicode code point 1~12개. 앞뒤 공백 불가, 정규화 없음.'
    }),
    success(
      'CharacterCandidatesWithAdventureResult',
      '비교 순서의 후보와 이미지 URL, 모험단명 (0건이면 빈 rows)'
    ),
    errors({ 400: 'INVALID_SEARCH_QUERY', ...neopleFailures })
  )
}

const characterParams = [
  ApiParam({
    name: 'serverId',
    schema: { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] }
  }),
  ApiParam({
    name: 'characterId',
    schema: { type: 'string', pattern: CHARACTER_ID_PATTERN_SOURCE, minLength: 1, maxLength: 256 }
  })
]

export function ApiCharacterDetails() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 상세 조회',
      description:
        '공개 API. Neople 11개 캐릭터 섹션을 모두 조회하여 반환합니다. 캐릭터 조회 결과는 API 메모리에 1시간 캐시하며 그동안 같은 캐릭터는 Neople을 다시 부르지 않습니다. 그동안 처음 만든 응답 본문을 그대로 보냅니다. 공용 아이템이 하나라도 unavailable인 응답은 저장하지 않습니다. sections의 시각과 freshness.lastSuccessfulFetchAt은 Neople에서 받은 시각, freshness.expiresAt은 그 1시간 뒤입니다. 캐릭터 조회 실패 시 부분 결과는 없으며 실패는 캐시하지 않습니다. 공용 아이템 상세는 API 메모리에 24시간 캐시하며 조회에 실패하면 unavailable 상태를 반환합니다. 아이템 상세는 장비, 아바타, 엠블렘, 크리쳐, 아티팩트, 서약, 결정, 버프 장착 항목에 연결합니다. 공용 아이템 상세는 최대 128개 참조이며, 동시에 들어온 요청들의 아이템을 중복 없이 15개씩 묶어 조회합니다. IP별, 서버 전체 호출 제한은 없습니다. 같은 프로세스에서 겹치는 동일 캐릭터 조회는 공유합니다.'
    }),
    ...characterParams,
    success('CharacterDetails', '정제된 상세 정보, 섹션별 조회 시각과 freshness 만료 시각'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 404: 'CHARACTER_NOT_FOUND', ...neopleFailures })
  )
}

export function ApiCharacterRefresh() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 상세 강제 갱신',
      description:
        '공개 API. 캐릭터를 Neople에서 받은 지 1분 안이면 캐시한 응답을 반환합니다. 그 외에는 캐릭터 캐시를 건너뛰고 Neople 11개 캐릭터 섹션을 다시 받아 캐시를 덮어쓴 뒤 상세 조회와 같은 응답을 반환합니다. 같은 캐릭터를 이미 Neople에서 받는 중이면 그 조회를 함께 기다립니다. 공용 아이템 상세는 캐시를 그대로 쓰고, 새로 만든 응답 본문이 이후 상세 조회의 응답이 됩니다. 새로 받지 못하면 상세 조회와 같은 오류를 반환하고 기존 캐시는 그대로 둡니다. Query와 body는 읽지 않습니다.'
    }),
    ...characterParams,
    success('CharacterDetails', '다시 받은 상세 정보, 섹션별 조회 시각과 freshness 만료 시각'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 404: 'CHARACTER_NOT_FOUND', ...neopleFailures })
  )
}

export function ApiCharacterImage() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 초상화 전달',
      description:
        '공개 API. 검증한 serverId, characterId로 만든 Neople 캐릭터 이미지(zoom=1)를 받아 image/png 본문을 변환하지 않고 그대로 반환합니다. 웹 사이트는 같은 origin의 /api로 받아 얼굴 크롭과 비교할 픽셀을 읽으므로 CORS 헤더는 붙이지 않습니다. API 메모리에 캐시하거나 저장하지 않으며 Cache-Control: private, max-age=3600으로 브라우저 캐시만 씁니다. Neople 이미지가 4MiB를 넘거나 image/png가 아니면 NEOPLE_API_ERROR입니다.'
    }),
    ...characterParams,
    ApiResponse({
      status: 200,
      description: 'Neople 캐릭터 이미지 원본',
      content: { 'image/png': { schema: { type: 'string', format: 'binary' } } }
    }),
    errors({ 400: 'INVALID_CHARACTER_QUERY', ...neopleFailures })
  )
}

export function ApiCharacterTimeline() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 타임라인 조회',
      description:
        '공개 API. DB에 저장한 타임라인에서 이번 주(목요일 06:00 KST부터) 레이드(코드 201, 210)와 레기온(209) 클리어, 지금 시즌의 같은 기록을 이름별로 센 횟수, 강화(401), 증폭(402), 재련(403)과 에픽, 태초 장비 획득(501~521, 550~557)의 최근 50개씩을 반환합니다. 강화, 획득 목록에 더 오래된 기록이 남아 있으면 enhancementsCursor, acquisitionsCursor로 이어 받기 경로에서 다음 50개를 받습니다. 조회한 캐릭터의 타임라인 동기화를 시작하고(진행 중이면 그 동기화에 합치며, 마지막 성공 뒤 1시간 안이면 받지 않음), 그 캐릭터의 진행 중인 동기화가 끝난 뒤 DB를 읽습니다. 처음 조회한 캐릭터는 동기화가 끝날 때까지 몇 초 걸릴 수 있습니다. 동기화 실패는 응답에 드러나지 않고 저장한 값까지만 반환합니다. DB 설정이 없는 API는 동기화 없이 빈 배열을 반환합니다.'
    }),
    ...characterParams,
    success('CharacterTimeline', '저장한 타임라인의 클리어, 강화, 획득 기록 (없으면 빈 배열)'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

function timelinePage(list: string, label: string, schema: string) {
  return applyDecorators(
    ApiOperation({
      summary: `캐릭터 타임라인 ${label} 이어 받기`,
      description: `공개 API. 타임라인 조회나 앞선 이어 받기에서 받은 cursor를 before로 주면 그보다 오래된 ${label} 기록을 최근 순으로 50개까지 반환합니다. 동기화를 기다리지 않고 DB에 저장한 값만 읽습니다. nextCursor가 null이면 더 받을 기록이 없습니다. DB 설정이 없는 API는 빈 목록을 반환합니다.`
    }),
    ...characterParams,
    ApiQuery({
      name: 'before',
      required: true,
      schema: { type: 'string' },
      description: `타임라인 조회의 ${list}Cursor나 이어 받기의 nextCursor. 값의 형식은 정하지 않습니다.`
    }),
    success(schema, `${label} 기록과 다음 cursor`),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiCharacterTimelineEnhancements() {
  return timelinePage('enhancements', '강화, 증폭, 재련', 'TimelineEnhancementPage')
}

export function ApiCharacterTimelineAcquisitions() {
  return timelinePage('acquisitions', '에픽, 태초 획득', 'TimelineAcquisitionPage')
}

export function ApiTodayGrade() {
  return applyDecorators(
    ApiOperation({
      summary: '오늘의 등급 조회',
      description:
        '공개 API. 방어구 5, 악세서리 3, 특수장비 3부위의 엘더 페어리 장비(115레벨 레전더리) 11개를 Neople 상점 판매 정보 조회로 받아 오늘의 등급(itemGradeValue)의 평균을 반환합니다. 결과는 등급이 바뀌는 다음 0시(KST)까지 API 메모리에 캐시하고, 겹치는 조회는 공유합니다. 아이템 하나라도 실패하면 부분 결과 없이 실패하며 실패는 캐시하지 않습니다.'
    }),
    success('TodayGrade', '오늘의 등급 퍼센트와 만료 시각'),
    errors(neopleFailures)
  )
}

export function ApiAdventureCharacters() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 캐릭터 목록 조회',
      description:
        '공개 API. DB에 저장된 캐릭터 기본 정보에서 모험단 이름이 같은 캐릭터를 서버를 가리지 않고 명성이 높은 순으로 반환합니다. 명성이 없는 캐릭터는 뒤에 두고, 페이지는 없습니다. Neople을 부르지 않으며 값은 행마다 fetchedAt 시점의 것입니다. DB에 없는 모험단과 DB 설정이 없는 API는 빈 목록을 반환합니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    success('AdventureCharacters', '모험단 이름과 캐릭터 목록 (없으면 빈 목록)'),
    errors({ 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiGuild() {
  return applyDecorators(
    ApiOperation({
      summary: '길드 조회',
      description:
        '공개 API. DB에 저장된 캐릭터 기본 정보에서 길드 ID가 같은 길드원을 명성이 높은 순으로 반환하고, 길드원 수와 명성이 있는 길드원의 평균 명성을 붙입니다. 길드 ID는 서버가 달라도 같은 길드라 서버 조건이 없습니다. 명성이 없는 캐릭터는 뒤에 두고, 페이지는 없습니다. Neople을 부르지 않습니다. DB에 없는 길드와 DB 설정이 없는 API는 guildName, averageFame이 null인 빈 목록을 반환합니다.'
    }),
    ApiParam({ name: 'guildId', schema: { type: 'string' } }),
    success('Guild', '길드 이름, 길드원 수, 평균 명성과 길드원 목록 (없으면 빈 목록)'),
    errors({ 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiAdventureWeekly() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 주간 클리어 조회',
      description:
        '공개 API. DB에 저장된 그 모험단 캐릭터를 명성이 높은 순으로 반환하고, 캐릭터마다 이번 주(목요일 06:00 KST부터) 레이드, 레기온 클리어를 붙입니다. clearNames는 모든 모험단에 같은 고정 목록(디레지에 레이드, 무너진 성자 미카엘라, 아포칼립스)이고, 캐릭터별 클리어도 이 목록에 있는 이름만 붙입니다. 조회는 캐릭터마다 타임라인 동기화를 시작하고 끝나기를 기다리지 않아, 응답은 지금 저장된 값입니다. DB에 없는 모험단은 characters만 빈 목록이고, DB 설정이 없는 API는 clearNames와 characters를 모두 빈 목록으로 반환합니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    success(
      'AdventureWeekly',
      '모험단 이름, 고정 클리어 목록과 캐릭터별 이번 주 클리어 (없으면 빈 목록)'
    ),
    errors({ 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiAdventureActivity() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 시즌 활동 조회',
      description:
        '공개 API. DB에 저장된 그 모험단 캐릭터의 타임라인을 합쳐 한 시즌의 레이드, 레기온 클리어, 레전더리 이상 아이템 획득, 강화, 증폭, 재련 횟수와 활동이 있는 날(06:00 KST에 바뀜)의 횟수를 반환합니다. season이 없으면 지금 시즌입니다. 강화 단계는 타임라인의 after(도전한 단계)입니다. 중천 전 시즌은 backfill에 옛 시즌 받기 진행률이 있고, 모험단 캐릭터가 모두 끝까지 받아야 available이 true가 되어 집계하며 그 전에는 집계가 비어 있습니다. 조회는 캐릭터마다 타임라인 동기화를 시작하고 끝나기를 기다리지 않아, 응답은 지금 저장된 값입니다. DB에 없는 모험단은 집계가 비어 있고, DB 설정이 없는 API는 시즌 목록이 비고 season이 null입니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    ApiQuery({
      name: 'season',
      required: false,
      schema: { type: 'integer', minimum: 1 },
      description: '시즌 번호(중천 10, 천해천 11). 없으면 지금 시즌'
    }),
    success('AdventureActivity', '시즌 목록, 고른 시즌의 구간, 시즌 요약과 날짜별 활동'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiAdventureSeasonBackfill() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 옛 시즌 받기',
      description:
        '공개 API. DB에 저장된 그 모험단 캐릭터마다 중천 전 시즌 하나의 모든 타임라인 코드를 Neople에서 받도록 옛 시즌 받기 대기열에 넣고, 끝나기를 기다리지 않고 그 시즌의 진행률을 반환합니다. 받는 중이거나 끝까지 받은 캐릭터는 다시 넣지 않습니다. 진행률은 캐릭터마다 시즌 구간을 90일 이하로 나눈 구간 수의 합입니다. 받기는 메모리 대기열이라 API가 다시 시작되면 멈추고, 다시 요청하면 저장한 구간 뒤부터 이어 받습니다. 호출 제한은 없습니다. 중천 이후 시즌이나 시작하지 않은 시즌, DB 설정이 없는 API는 400입니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    ApiParam({
      name: 'season',
      schema: { type: 'integer', minimum: 1 },
      description: '중천 전 시즌 번호(마계 5 ~ 선계 9)'
    }),
    success('AdventureSeasonBackfill', '시즌 목록의 한 칸과 같은 모양의 그 시즌 받기 상태'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiAdventureSeasonDays() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 시즌 하루 활동 상세 조회',
      description:
        '공개 API. 고른 시즌의 기록이 있는 날마다 하루 활동 상세를 날짜 순으로 반환합니다. 하루는 06:00 KST에 바뀝니다. 옛 시즌 받기가 끝나지 않으면 목록이 비고, 시작하지 않았거나 없는 시즌은 400입니다. 타임라인 동기화는 요청하지 않습니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    ApiParam({
      name: 'season',
      schema: { type: 'integer', minimum: 1 },
      description: '시즌 번호'
    }),
    success('AdventureSeasonDays', '시즌 번호와 기록이 있는 날의 상세'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiAdventureActivityDay() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단 하루 활동 상세 조회',
      description:
        '공개 API. DB에 저장된 그 모험단 캐릭터의 타임라인에서 하루(그날 06:00 KST부터 다음 날 06:00 KST 전까지)의 레이드, 레기온 이름별 클리어 수와 레전더리 이상 아이템 획득, 강화, 증폭, 재련 기록을 시각 순으로 모두 반환합니다. 기준은 모험단 시즌 활동 조회의 days와 같고, 강화 target은 타임라인의 after(도전한 단계)입니다. 동기화는 걸지 않아 응답은 지금 저장된 값입니다. DB에 없는 모험단과 DB 설정이 없는 API는 빈 목록을 줍니다.'
    }),
    ApiParam({
      name: 'adventureName',
      schema: { type: 'string' },
      description: 'URL 인코딩한 모험단 이름'
    }),
    ApiParam({
      name: 'date',
      schema: { type: 'string', format: 'date' },
      description: '06:00 KST에 바뀌는 하루의 날짜(YYYY-MM-DD)'
    }),
    success('AdventureActivityDay', '그날의 클리어 수와 아이템, 강화 기록'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

const maleCrusaderRoleQuery = ApiQuery({
  name: 'role',
  required: false,
  schema: { type: 'string', enum: ['dealer', 'buffer'] },
  description:
    'jobId, jobGrowId가 남성 크루세이더(프리스트(남), 眞 크루세이더)일 때만 씁니다. 저장된 스킬 스타일(받을 때의 전직이 지금 전직과 같은 행)에 용기의 은총이 있으면 dealer, 없으면 buffer로 보고 그 역할의 캐릭터만 셉니다. 그런 행이 없는 캐릭터는 어느 쪽에도 넣지 않습니다. 다른 전직이나 jobGrowId 없는 요청은 400입니다.'
})

export function ApiFameRanking() {
  return applyDecorators(
    ApiOperation({
      summary: '명성 랭킹 조회',
      description:
        '공개 API. DB에 저장된 캐릭터 기본 정보에서 명성이 있는 캐릭터를 명성이 높은 순으로 100명까지 반환합니다. 명성이 같으면 서버, 캐릭터 id 순이고 rank는 1부터 매긴 순서입니다. jobId, jobGrowId로 거르며 jobGrowId는 jobId와 함께 씁니다. 서버는 통합되어 있어 서버로 거르지 않습니다. 다른 query key는 무시합니다. Neople을 부르지 않으며 값은 행마다 fetchedAt 시점의 것입니다. DB 설정이 없는 API는 빈 목록을 반환합니다.'
    }),
    ApiQuery({ name: 'jobId', required: false, schema: { type: 'string', minLength: 1 } }),
    ApiQuery({
      name: 'jobGrowId',
      required: false,
      schema: { type: 'string', minLength: 1 },
      description: 'jobId와 함께 씁니다.'
    }),
    maleCrusaderRoleQuery,
    success('FameRanking', '명성 순 캐릭터 목록 (없으면 빈 목록)'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiStats() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 통계 조회',
      description:
        '공개 API. DB에 저장된 캐릭터 기본 정보로 전체 캐릭터 수, 서버별 캐릭터 수, 직업별 캐릭터 수와 평균 명성, 명성 분포를 반환합니다. 처음 요청할 때 계산해 다음 0시(KST)까지 API 메모리에 캐시하고, 겹치는 계산은 공유합니다. 실패는 캐시하지 않습니다. DB 설정이 없는 API는 0과 빈 목록을 반환합니다.'
    }),
    success('Stats', '집계 시각과 서버, 직업, 명성 분포'),
    errors({ 500: 'INTERNAL_SERVER_ERROR' })
  )
}

export function ApiSkillStats() {
  return applyDecorators(
    ApiOperation({
      summary: '전직별 스킬 채택률 조회',
      description:
        '공개 API. 한 전직에서 명성이 있는 캐릭터 가운데 명성 상위 topCount위까지를 표본으로 삼고, 그 가운데 스킬 스타일을 받았고 받을 때의 전직이 지금 전직과 같은 캐릭터의 스킬별 배운 수와 레벨 분포, 스킬 개화와 강화를 고른 수를 반환합니다. 스킬 스타일은 상세 조회가 저장한 행만 셉니다. 채택률의 분모는 sampleSize, 개화와 강화 비율의 분모는 그 스킬의 learned입니다. 전직마다 처음 요청할 때 계산해 다음 0시(KST)까지 API 메모리에 캐시하고, 겹치는 계산은 공유합니다. 실패와 명성 있는 캐릭터가 없는 전직은 캐시하지 않습니다. Neople을 부르지 않습니다. DB 설정이 없는 API는 sampleSize 0과 빈 목록을 반환합니다.'
    }),
    ApiQuery({ name: 'jobId', required: true, schema: { type: 'string', minLength: 1 } }),
    ApiQuery({ name: 'jobGrowId', required: true, schema: { type: 'string', minLength: 1 } }),
    maleCrusaderRoleQuery,
    success('SkillStats', '집계 시각, 표본 기준과 스킬별 채택 수'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 500: 'INTERNAL_SERVER_ERROR' })
  )
}
