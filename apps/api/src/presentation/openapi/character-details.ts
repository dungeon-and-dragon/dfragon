import { applyDecorators } from '@nestjs/common'
import { ApiOperation, type SchemaObject } from '@nestjs/swagger'
import { characterDetailSections } from '../../characters/details/sections.js'
import {
  timestampSchema,
  objectSchema,
  successResponse,
  errorResponses,
  neopleFailures,
  textSchema,
  characterParams
} from './common.js'

const providerValue: SchemaObject = {
  description: 'Neople 섹션 값. 미장착은 null이며 시즌별 중첩 필드와 배열을 그대로 보존합니다.',
  oneOf: [
    { type: 'object', additionalProperties: true, nullable: true },
    { type: 'array', items: {} }
  ]
}

const sectionMetadata = objectSchema({
  revision: { type: 'integer', minimum: 1 },
  contentUpdatedAt: timestampSchema,
  lastSuccessfulFetchAt: timestampSchema
})

const catalogDetail = objectSchema({
  data: {
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Neople 공용 상세 원본. 캐릭터 장착 상태와 별개입니다.'
  },
  fetchedAt: { ...timestampSchema, nullable: true },
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
  ...objectSchema({
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
    skipped: { ...objectSchema({ kind: nonblankText, message: nonblankText }), nullable: true },
    approximate: {
      ...objectSchema({ value: { type: 'integer' }, source: nonblankText, warning: nonblankText }),
      nullable: true,
      description: '엔진이 점수를 건너뛰고 근사값을 낸 경우의 값, 근사 방법, 경고.'
    },
    versions: objectSchema({
      package: nonblankText,
      rulesRev: nonblankText,
      bundleId: nonblankText
    })
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

const characterCard = objectSchema({
  role: {
    type: 'string',
    enum: ['dealer', 'buffer', 'synergy'],
    nullable: true,
    description:
      'jobGrowName이 크루세이더, 인챈트리스, 패러메딕, 뮤즈(眞 접두 포함)면 buffer, 그 밖은 dealer, 직업을 모르면 null. 단 jobName이 프리스트(남)인 크루세이더는 용기의 은총을 습득했으면 dealer. synergy는 장비 점수를 쓰는 시너지 역할이며 아직 이 값으로 판정하는 직업은 없음.'
  },
  score: cardScore
})

export const characterDetailsSchemas: Record<string, SchemaObject> = {
  CatalogDetail: catalogDetail,
  CharacterDetails: objectSchema({
    freshness: objectSchema({
      lastSuccessfulFetchAt: {
        ...timestampSchema,
        description: '11개 캐릭터 섹션을 조회한 시각.'
      },
      expiresAt: {
        ...timestampSchema,
        description: 'Neople에서 받은 시각 + 1시간. 서버 캐시가 이 시각까지 같은 값을 돌려줍니다.'
      }
    }),
    character: objectSchema({
      characterId: textSchema,
      serverId: textSchema,
      serverName: { type: 'string', nullable: true },
      characterName: textSchema,
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
    status: objectSchema({ status: providerValue, buff: providerValue }),
    equipment: objectSchema({ equipment: catalogEquipment, setItemInfo: providerValue }),
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
    buff: objectSchema({
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
    sections: objectSchema(
      Object.fromEntries(characterDetailSections.map((name) => [name, sectionMetadata]))
    ),
    card: {
      ...characterCard,
      description: '카드의 역할과 점수. 역할은 직업을 모르면 null입니다.'
    }
  })
}

export function ApiCharacterDetails() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 상세 조회',
      description:
        '공개 API. Neople 11개 캐릭터 섹션을 모두 조회하여 반환합니다. 캐릭터 조회 결과는 API 메모리에 1시간 캐시하며 그동안 같은 캐릭터는 Neople을 다시 부르지 않습니다. 그동안 처음 만든 응답 본문을 그대로 보냅니다. 공용 아이템이 하나라도 unavailable인 응답은 저장하지 않습니다. sections의 시각과 freshness.lastSuccessfulFetchAt은 Neople에서 받은 시각, freshness.expiresAt은 그 1시간 뒤입니다. 캐릭터 조회 실패 시 부분 결과는 없으며 실패는 캐시하지 않습니다. 공용 아이템 상세는 API 메모리에 24시간 캐시하며 조회에 실패하면 unavailable 상태를 반환합니다. 아이템 상세는 장비, 아바타, 엠블렘, 크리쳐, 아티팩트, 서약, 결정, 버프 장착 항목에 연결합니다. 공용 아이템 상세는 최대 128개 참조이며, 동시에 들어온 요청들의 아이템을 중복 없이 15개씩 묶어 조회합니다. IP별, 서버 전체 호출 제한은 없습니다. 같은 프로세스에서 겹치는 동일 캐릭터 조회는 공유합니다.'
    }),
    ...characterParams,
    successResponse('CharacterDetails', '정제된 상세 정보, 섹션별 조회 시각과 freshness 만료 시각'),
    errorResponses({
      400: 'INVALID_CHARACTER_QUERY',
      404: 'CHARACTER_NOT_FOUND',
      ...neopleFailures
    })
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
    successResponse(
      'CharacterDetails',
      '다시 받은 상세 정보, 섹션별 조회 시각과 freshness 만료 시각'
    ),
    errorResponses({
      400: 'INVALID_CHARACTER_QUERY',
      404: 'CHARACTER_NOT_FOUND',
      ...neopleFailures
    })
  )
}
