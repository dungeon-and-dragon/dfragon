import type { SchemaObject } from '@nestjs/swagger'
import { LEGION_RELEASE_ORDER, RAID_RELEASE_ORDER } from '../adventure-guild/activity.js'
import { CHARACTER_ID_PATTERN_SOURCE } from '../characters/identity.js'
import { characterDetailSections } from '../characters/details/sections.js'
import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'

const text: SchemaObject = { type: 'string' }
const timestamp: SchemaObject = { type: 'string', format: 'date-time' }
function object(properties: Record<string, SchemaObject>): SchemaObject {
  const required = Object.keys(properties)

  return {
    type: 'object',
    required,
    additionalProperties: false,
    properties
  }
}

const timelineClearKind: SchemaObject = { type: 'string', enum: ['raid', 'legion'] }
const timelineCursor: SchemaObject = { ...text, nullable: true }
const timelineEnhancement = object({
  kind: { type: 'string', enum: ['reinforce', 'amplify', 'refine'] },
  itemId: { ...text, nullable: true },
  itemName: { ...text, nullable: true },
  itemRarity: { ...text, nullable: true },
  before: { type: 'integer', nullable: true, description: '재련은 값이 없어 null' },
  after: { type: 'integer' },
  result: { type: 'boolean' },
  safe: { type: 'boolean', nullable: true, description: '재련은 값이 없어 null' },
  occurredAt: timestamp
})
const timelineAcquisition = object({
  code: { type: 'integer', description: '획득 경로의 타임라인 코드' },
  name: { ...text, description: '타임라인 코드 이름' },
  itemId: { ...text, nullable: true },
  itemName: { ...text, nullable: true },
  itemRarity: { type: 'string', enum: ['에픽', '태초'] },
  occurredAt: timestamp
})

function timelinePage(item: SchemaObject): SchemaObject {
  return object({
    items: { type: 'array', description: '최근 순으로 50개까지입니다.', items: item },
    nextCursor: { ...timelineCursor, description: '다음 이어 받기의 before. 없으면 null' }
  })
}

const providerValue: SchemaObject = {
  description: 'Neople 섹션 값. 미장착은 null이며 시즌별 중첩 필드와 배열을 그대로 보존합니다.',
  oneOf: [
    { type: 'object', additionalProperties: true, nullable: true },
    { type: 'array', items: {} }
  ]
}
const sectionMetadata = object({
  revision: { type: 'integer', minimum: 1 },
  contentUpdatedAt: timestamp,
  lastSuccessfulFetchAt: timestamp
})

const catalogDetail = object({
  data: {
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Neople 공용 상세 원본. 캐릭터 장착 상태와 별개입니다.'
  },
  fetchedAt: { ...timestamp, nullable: true },
  status: {
    type: 'string',
    enum: ['fresh', 'unavailable'],
    description: '이번 요청에서 조회함 / 조회 실패, 예산 종료'
  }
})
const catalogEquipment: SchemaObject = {
  description:
    '원본 장착 배열의 각 장비에 itemDetail을 추가합니다. 슬롯 수와 시즌별 옵션은 보존합니다.',
  oneOf: [
    {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: { itemDetail: catalogDetail },
        required: ['itemDetail']
      }
    },
    { type: 'object', additionalProperties: true, nullable: true }
  ]
}

const catalogItem: SchemaObject = {
  type: 'object',
  nullable: true,
  additionalProperties: true,
  description: '유효한 itemId가 있는 항목에 itemDetail을 추가합니다. 빈 슬롯은 그대로 보존합니다.',
  properties: { itemDetail: catalogDetail }
}
const catalogAvatar: SchemaObject = {
  ...catalogItem,
  properties: {
    itemDetail: catalogDetail,
    clone: { ...catalogItem, description: '외형 참조. 장착 옵션과 합산하지 않습니다.' },
    emblems: { type: 'array', nullable: true, items: catalogItem }
  }
}
const catalogAvatars: SchemaObject = { type: 'array', nullable: true, items: catalogAvatar }
const catalogCreature: SchemaObject = {
  ...catalogItem,
  properties: {
    itemDetail: catalogDetail,
    clone: { ...catalogItem, description: '외형 참조. 장착 옵션과 합산하지 않습니다.' },
    artifact: { type: 'array', nullable: true, items: catalogItem }
  }
}

const nonblankText: SchemaObject = { type: 'string', minLength: 1 }
const cardScore: SchemaObject = {
  ...object({
    calculator: {
      type: 'string',
      enum: ['equipment', 'buff'],
      description: 'role이 buffer면 buff(버프 점수), dealer나 synergy면 equipment(장비 점수).'
    },
    value: {
      type: 'integer',
      nullable: true,
      description: '엔진이 낸 점수. 엔진이 점수를 건너뛰면 null이고 skipped에 사유가 있습니다.'
    },
    skipped: { ...object({ kind: nonblankText, message: nonblankText }), nullable: true },
    approximate: {
      ...object({ value: { type: 'integer' }, source: nonblankText, warning: nonblankText }),
      nullable: true,
      description: '엔진이 점수를 건너뛰고 근사값을 낸 경우의 값, 근사 방법, 경고.'
    },
    versions: object({ package: nonblankText, rulesRev: nonblankText, bundleId: nonblankText })
  }),
  nullable: true,
  description: 'API 점수 엔진이 계산한 점수. 엔진이 없거나 결과를 내지 못하면 null.',
  example: {
    calculator: 'equipment',
    value: 1769,
    skipped: null,
    approximate: null,
    versions: { package: 'dnfscore-native 0.4.3', rulesRev: 'rev14', bundleId: 'phase32-rev14e' }
  }
}
const characterCard = object({
  role: {
    type: 'string',
    enum: ['dealer', 'buffer', 'synergy'],
    nullable: true,
    description:
      'jobGrowName이 크루세이더, 인챈트리스, 패러메딕, 뮤즈(眞 접두 포함)면 buffer, 그 밖은 dealer, 직업을 모르면 null. 단 jobName이 프리스트(남)인 크루세이더는 용기의 은총을 습득했으면 dealer. synergy는 장비 점수를 쓰는 시너지 역할이며 아직 이 값으로 판정하는 직업은 없음.'
  },
  score: cardScore
})

const nullableText: SchemaObject = { type: 'string', nullable: true }
const serverId: SchemaObject = { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] }
const storedCharacterProperties: Record<string, SchemaObject> = {
  serverId,
  characterId: text,
  characterName: text,
  adventureName: text,
  level: { type: 'integer', nullable: true },
  jobId: nullableText,
  jobGrowId: nullableText,
  jobName: nullableText,
  jobGrowName: nullableText,
  fame: { type: 'integer', nullable: true },
  guildId: nullableText,
  guildName: nullableText,
  fetchedAt: {
    ...timestamp,
    nullable: true,
    description: '이 행의 기본 정보를 Neople에서 받은 시각(basic_fetched_at). 받지 않은 행은 null'
  }
}
const storedCharacter = object(storedCharacterProperties)
const characterCount: SchemaObject = { type: 'integer', minimum: 0 }
const clearName = object({
  kind: timelineClearKind,
  name: { ...text, description: '레이드는 raid_name, 레기온은 data.regionName' }
})
const activityCount: SchemaObject = { type: 'integer', minimum: 0 }
const releaseOrderDescription = (kind: string, releaseOrder: readonly string[]): string =>
  `${kind} 이름별 클리어 수. 출시가 최근인 것부터(${releaseOrder.join(', ')})이고, 목록에 없는 이름은 그 뒤에 많은 순, 같으면 이름 순`
const RAID_ORDER_DESCRIPTION = releaseOrderDescription('레이드(201, 210)', RAID_RELEASE_ORDER)
const LEGION_ORDER_DESCRIPTION = releaseOrderDescription('레기온(209)', LEGION_RELEASE_ORDER)
const activityNameCounts = (description: string): SchemaObject => ({
  type: 'array',
  description,
  items: object({ name: text, count: activityCount })
})
const activityRaidCounts = (description: string): SchemaObject => ({
  type: 'array',
  description,
  items: object({
    name: text,
    count: { ...activityCount, description: 'hard와 normal의 합' },
    hard: { ...activityCount, description: '하드로 클리어한 수(타임라인 data.hard가 true인 행)' },
    normal: { ...activityCount, description: '하드가 아닌 클리어 수' }
  })
})
const enhancementTargets = (description: string): SchemaObject => ({
  type: 'array',
  description,
  items: object({
    target: { type: 'integer', description: '도전한 단계(타임라인 after)' },
    attempts: activityCount,
    successes: activityCount
  })
})
const backfillRanges: SchemaObject = {
  ...activityCount,
  description: '캐릭터마다 시즌 구간을 90일 이하로 나눈 구간 수의 합'
}
const activitySeasonProperties: Record<string, SchemaObject> = {
  id: { type: 'integer', description: '시즌 번호' },
  name: text,
  startsAt: timestamp,
  available: {
    type: 'boolean',
    description:
      '집계할 수 있는지. 중천(10) 이후 시즌은 늘 true, 그 전 시즌은 모험단 캐릭터가 모두 끝까지 받았을 때 true'
  },
  backfill: {
    ...object({
      done: { ...backfillRanges, description: '받은 구간 수' },
      total: backfillRanges,
      running: { type: 'boolean', description: '그 모험단 캐릭터 가운데 받는 중인 캐릭터가 있는지' }
    }),
    description: '중천 전 시즌의 옛 시즌 받기 상태. 중천 이후 시즌에는 없습니다'
  }
}
const activitySeason: SchemaObject = {
  type: 'object',
  required: ['id', 'name', 'startsAt', 'available'],
  additionalProperties: false,
  properties: activitySeasonProperties
}
const storedCharacters = (description: string): SchemaObject => ({
  type: 'array',
  description,
  items: storedCharacter
})

const characterSearchRowProperties: Record<string, SchemaObject> = {
  characterId: {
    type: 'string',
    pattern: CHARACTER_ID_PATTERN_SOURCE,
    minLength: 1,
    maxLength: 256
  },
  characterName: text,
  serverId: { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] },
  serverName: text,
  fame: { type: 'number', nullable: true },
  jobName: {
    type: 'string',
    nullable: true,
    description:
      'Neople 검색 응답의 jobName. 문자열이 아니거나 비어 있으면 null이며 상세를 조회하지 않습니다.'
  },
  jobGrowName: {
    type: 'string',
    nullable: true,
    description:
      'Neople 검색 응답의 jobGrowName. 문자열이 아니거나 비어 있으면 null이며 상세를 조회하지 않습니다.'
  },
  imageUrl: {
    type: 'string',
    format: 'uri',
    description: 'Neople 전체 캐릭터 이미지 URL. Web에서 파티원 얼굴 영역과 비교합니다.',
    example: 'https://img-api.neople.co.kr/df/servers/cain/characters/character-id?zoom=1'
  }
}
const CHARACTER_SEARCH_ORDER_DESCRIPTION =
  'fame 내림차순, null은 마지막. 동률과 null은 공급자 순서 유지.'
const characterSearchRows = (
  description: string,
  properties: Record<string, SchemaObject> = {}
): SchemaObject =>
  object({
    rows: {
      type: 'array',
      description,
      items: object({ ...characterSearchRowProperties, ...properties })
    }
  })

const skillSelectionCount = object({
  name: { ...text, description: '스킬 이름' },
  type1: { ...characterCount, description: 'type 1을 고른 캐릭터 수' },
  type2: { ...characterCount, description: 'type 2를 고른 캐릭터 수' }
})

export const apiSchemas: Record<string, SchemaObject> = {
  CatalogDetail: catalogDetail,
  ApiError: object({ error: object({ code: text, message: text }) }),
  CharacterCandidatesResult: characterSearchRows(CHARACTER_SEARCH_ORDER_DESCRIPTION),
  CharacterCandidatesWithAdventureResult: characterSearchRows(CHARACTER_SEARCH_ORDER_DESCRIPTION, {
    adventureName: {
      type: 'string',
      nullable: true,
      description:
        'DB에 저장된 그 캐릭터(서버, 캐릭터 ID)의 모험단명. 저장되지 않은 캐릭터와 DB 설정이 없는 API는 null입니다. 응답할 때마다 DB에서 읽어 24시간 후보 캐시에 들지 않습니다.'
    }
  }),
  CharacterDetails: object({
    freshness: object({
      lastSuccessfulFetchAt: {
        ...timestamp,
        description: '11개 캐릭터 섹션을 조회한 시각.'
      },
      expiresAt: {
        ...timestamp,
        description: 'Neople에서 받은 시각 + 1시간. 서버 캐시가 이 시각까지 같은 값을 돌려줍니다.'
      }
    }),
    character: object({
      characterId: text,
      serverId: text,
      serverName: { type: 'string', nullable: true },
      characterName: text,
      ...Object.fromEntries(
        [
          'level',
          'jobId',
          'jobGrowId',
          'jobName',
          'jobGrowName',
          'fame',
          'adventureName',
          'guildId',
          'guildName'
        ].map((name) => [name, { description: 'Neople 기본정보 값. 누락 시 null.' }])
      )
    }),
    status: object({ status: providerValue, buff: providerValue }),
    equipment: object({ equipment: catalogEquipment, setItemInfo: providerValue }),
    avatar: catalogAvatars,
    creature: catalogCreature,
    oath: {
      type: 'object',
      nullable: true,
      additionalProperties: true,
      properties: {
        info: catalogItem,
        crystal: { type: 'array', nullable: true, items: catalogItem },
        setInfo: {
          ...providerValue,
          description: '현재 적용된 서약 세트 원본.'
        }
      }
    },
    mistAssimilation: providerValue,
    skillStyle: providerValue,
    buff: object({
      equipment: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        description: 'Neople skill.buff 값. 장비마다 itemDetail을 추가합니다.',
        properties: { equipment: catalogEquipment }
      },
      avatar: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        properties: { avatar: catalogAvatars }
      },
      creature: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        properties: { creature: { type: 'array', nullable: true, items: catalogCreature } }
      }
    }),
    sections: object(
      Object.fromEntries(characterDetailSections.map((name) => [name, sectionMetadata]))
    ),
    card: {
      ...characterCard,
      description: '카드의 역할과 점수. 역할은 직업을 모르면 null입니다.'
    }
  }),
  CharacterTimeline: object({
    weeklyClears: {
      type: 'array',
      description: '이번 주 클리어. 오래된 순입니다.',
      items: object({
        kind: timelineClearKind,
        name: { ...text, description: '레이드는 raid_name, 레기온은 data.regionName' },
        modeName: { ...text, nullable: true, description: '레이드의 data.modeName. 레기온은 null' },
        hard: {
          type: 'boolean',
          description: '레이드의 data.hard. 칸이 없는 레이드와 레기온은 false'
        },
        occurredAt: timestamp
      })
    },
    seasonClears: {
      type: 'array',
      description:
        '지금 시즌(가장 최근에 시작한 시즌) 클리어를 kind, name, hard별로 센 횟수. 시즌에 처음 클리어한 순입니다.',
      items: object({
        kind: timelineClearKind,
        name: text,
        hard: { type: 'boolean', description: '하드 클리어와 아닌 클리어를 따로 셉니다.' },
        count: { type: 'integer', minimum: 1 }
      })
    },
    enhancements: {
      type: 'array',
      description: '강화, 증폭, 재련 기록. 최근 순으로 50개까지입니다.',
      items: timelineEnhancement
    },
    enhancementsCursor: {
      ...timelineCursor,
      description: '강화 이어 받기의 before. 더 오래된 기록이 없으면 null'
    },
    acquisitions: {
      type: 'array',
      description: '에픽, 태초 장비 획득 기록. 최근 순으로 50개까지입니다.',
      items: timelineAcquisition
    },
    acquisitionsCursor: {
      ...timelineCursor,
      description: '획득 이어 받기의 before. 더 오래된 기록이 없으면 null'
    }
  }),
  TimelineEnhancementPage: timelinePage(timelineEnhancement),
  TimelineAcquisitionPage: timelinePage(timelineAcquisition),
  TodayGrade: object({
    percent: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: '11부위 대표 아이템 오늘의 등급(itemGradeValue)의 평균을 반올림한 값'
    },
    expiresAt: { ...timestamp, description: '등급이 바뀌는 다음 0시(KST)' }
  }),
  AdventureCharacters: object({
    adventureName: text,
    characters: storedCharacters(
      'DB에 저장된 그 모험단의 캐릭터. 서버를 가리지 않고 명성이 높은 순이며 명성이 없는 캐릭터는 뒤입니다.'
    )
  }),
  Guild: object({
    guildId: text,
    guildName: {
      ...nullableText,
      description: '가장 최근에 기본 정보를 받은 길드원의 길드 이름. 길드원이 없으면 null'
    },
    memberCount: { type: 'integer', minimum: 0 },
    averageFame: {
      type: 'integer',
      nullable: true,
      description: '명성이 있는 길드원의 평균을 반올림한 값. 그런 길드원이 없으면 null'
    },
    members: storedCharacters(
      'DB에 저장된 길드원. 서버를 가리지 않고 명성이 높은 순이며 명성이 없는 캐릭터는 뒤입니다.'
    )
  }),
  AdventureWeekly: object({
    adventureName: text,
    clearNames: {
      type: 'array',
      description:
        '모든 모험단에 같은 고정 레이드, 레기온 목록. 디레지에 레이드, 무너진 성자 미카엘라, 아포칼립스 순입니다.',
      items: clearName
    },
    characters: {
      type: 'array',
      description:
        'DB에 저장된 그 모험단의 캐릭터. 서버를 가리지 않고 명성이 높은 순이며 명성이 없는 캐릭터는 뒤입니다.',
      items: object({
        ...storedCharacterProperties,
        weeklyClears: {
          type: 'array',
          description:
            '이번 주(목요일 06:00 KST부터) 클리어한 이름. 여러 번 클리어해도 한 번이며 clearNames와 같은 순서입니다.',
          items: clearName
        }
      })
    }
  }),
  AdventureActivity: object({
    seasons: {
      type: 'array',
      description: '시작한 시즌, 오래된 순',
      items: activitySeason
    },
    season: {
      ...object({
        id: { type: 'integer' },
        startsAt: timestamp,
        endsAt: { ...timestamp, nullable: true, description: '다음 시즌 시작. 지금 시즌은 null' },
        timelineStartsAt: {
          ...timestamp,
          description:
            '타임라인 기록이 있을 수 있는 첫 시각. Neople이 2017-09-21 00:00 KST부터 주므로 마계(5)는 그 시각이고, 나머지는 startsAt과 같습니다'
        }
      }),
      nullable: true,
      description: '집계한 시즌. 시즌이 없는 DB 설정 없는 API에서만 null'
    },
    summary: object({
      raids: activityRaidCounts(RAID_ORDER_DESCRIPTION),
      legions: activityNameCounts(LEGION_ORDER_DESCRIPTION),
      items: object({
        legendary: activityCount,
        epic: activityCount,
        primeval: { ...activityCount, description: '태초' },
        mythic: { ...activityCount, description: '신화' }
      }),
      enhancement: object({
        attempts: { ...activityCount, description: '강화, 증폭, 재련(401~403) 전체 횟수' },
        amplify: enhancementTargets(
          '10증폭 이상 도전의 단계별 시도와 성공, 낮은 단계 순. 강화권, 증폭권 기록(data.ticket이 있는 행)은 뺍니다'
        ),
        reinforce: enhancementTargets(
          '12강 이상 도전의 단계별 시도와 성공, 낮은 단계 순. 강화권, 증폭권 기록(data.ticket이 있는 행)은 뺍니다'
        ),
        amplifyBelow10: activityCount,
        reinforceBelow12: activityCount,
        refine: activityCount
      })
    }),
    days: {
      type: 'array',
      description: '활동이 있는 날만, 오래된 순. 하루는 06:00 KST에 바뀝니다.',
      items: object({
        date: { type: 'string', format: 'date' },
        raid: activityCount,
        legion: activityCount,
        item: { ...activityCount, description: '레전더리 이상 아이템 획득 수' },
        enhance: { ...activityCount, description: '강화, 증폭, 재련 횟수' },
        primeval: { type: 'boolean', description: '태초를 얻었는지' },
        mythic: { type: 'boolean', description: '신화를 얻었는지' },
        highEnhancement: {
          type: 'boolean',
          description: '10증폭 이상이나 12강 이상 도전이 있었는지'
        }
      })
    }
  }),
  AdventureSeasonBackfill: activitySeason,
  AdventureActivityDay: object({
    date: { type: 'string', format: 'date', description: '06:00 KST에 바뀌는 하루' },
    raids: activityRaidCounts(RAID_ORDER_DESCRIPTION),
    legions: activityNameCounts(LEGION_ORDER_DESCRIPTION),
    items: {
      type: 'array',
      description: '레전더리 이상 아이템 획득, 시각 순',
      items: object({
        at: { ...timestamp, description: '+09:00 offset을 붙인 KST 시각' },
        name: { ...text, nullable: true, description: 'item_name' },
        rarity: { type: 'string', enum: ['레전더리', '에픽', '태초', '신화'] }
      })
    },
    enhancements: {
      type: 'array',
      description: '강화, 증폭, 재련(401~403) 기록, 시각 순',
      items: object({
        at: { ...timestamp, description: '+09:00 offset을 붙인 KST 시각' },
        kind: { type: 'string', enum: ['reinforce', 'amplify', 'refine'] },
        target: { type: 'integer', description: '도전한 단계(타임라인 after)' },
        success: { type: 'boolean' }
      })
    }
  }),
  FameRanking: object({
    characters: {
      type: 'array',
      description:
        'DB에 저장된 명성이 있는 캐릭터. 명성이 높은 순(같으면 서버, 캐릭터 id 순)으로 100명까지입니다.',
      items: object({
        rank: { type: 'integer', minimum: 1, description: '1부터 매긴 순서' },
        ...storedCharacterProperties
      })
    }
  }),
  Stats: object({
    computedAt: { ...timestamp, description: '집계를 계산한 시각' },
    total: { ...characterCount, description: 'DB에 저장된 캐릭터 수' },
    servers: {
      type: 'array',
      description: '서버별 캐릭터 수. 많은 순입니다.',
      items: object({ serverId, count: characterCount })
    },
    jobs: {
      type: 'array',
      description: '직업, 전직별 캐릭터 수. 기본 정보가 없는 캐릭터는 빠지며 많은 순입니다.',
      items: object({
        jobId: text,
        jobGrowId: text,
        jobName: text,
        jobGrowName: text,
        count: characterCount,
        averageFame: {
          type: 'integer',
          nullable: true,
          description: '명성이 있는 캐릭터의 평균을 반올림한 값. 그런 캐릭터가 없으면 null'
        }
      })
    },
    fameDistribution: {
      type: 'array',
      description:
        '명성이 있는 캐릭터를 10,000 단위 구간으로 센 수. 캐릭터가 있는 구간만 낮은 순입니다.',
      items: object({
        from: { type: 'integer', description: '구간 시작(포함)' },
        to: { type: 'integer', description: '구간 끝(제외)' },
        count: characterCount
      })
    }
  }),
  SkillStats: object({
    computedAt: { ...timestamp, description: '집계를 계산한 시각' },
    topCount: { type: 'integer', description: '표본으로 삼은 전직 안 명성 상위 순위' },
    minFame: {
      type: 'integer',
      nullable: true,
      description: '표본의 최저 명성. 명성이 있는 캐릭터가 없으면 null'
    },
    sampleSize: {
      ...characterCount,
      description: '표본 가운데 스킬 스타일을 받았고, 받을 때의 전직이 지금 전직과 같은 캐릭터 수'
    },
    skills: {
      type: 'array',
      description: '표본 캐릭터가 배운 스킬. 이름 순입니다.',
      items: object({
        name: { ...text, description: '스킬 이름' },
        learned: { ...characterCount, description: '이 스킬을 배운 캐릭터 수' },
        levels: {
          type: 'array',
          description: '[레벨, 캐릭터 수] 쌍. 레벨이 낮은 순입니다.',
          items: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 }
        }
      })
    },
    evolutions: {
      type: 'array',
      description: '스킬 개화를 고른 캐릭터 수. 이름 순이며 비율의 분모는 skills의 learned입니다.',
      items: skillSelectionCount
    },
    enhancements: {
      type: 'array',
      description: '스킬 강화를 고른 캐릭터 수. 이름 순이며 비율의 분모는 skills의 learned입니다.',
      items: skillSelectionCount
    }
  })
}
