import type { GameTextLines } from '#entities/catalog/model/game-text'
import type { OathCatalog } from '#entities/catalog/model/oath-catalog'

// 서약 세트 id와 이름, 선택지 이름은 게임 데이터 그대로이고, 그림 주소와 효과 문구는 합성 값이다.

type OathEffects = OathCatalog['sets'][number]['options'][number]['effects']

function oathEffects(primitive: GameTextLines): OathEffects {
  return { rare: null, unique: null, legendary: null, epic: null, primitive }
}

const characterDetailOathCatalog: OathCatalog = {
  version: 'synthetic',
  sets: [
    {
      setId: 16204,
      name: '야망의 용투 서약',
      icon: 'https://skilltab.test/oath-set/16204.png',
      options: [
        {
          name: '용투 : 세계를 태우는 불꽃',
          icon: 'https://skilltab.test/oath/9.png',
          effects: oathEffects([
            [
              { text: '[투룡의 불꽃]', tone: 'increase' },
              { text: ' [장비 발동 옵션]', tone: 'default' }
            ],
            [{ text: '모든 속도 +20%', tone: 'rarity-primordial' }],
            [{ text: '[용투장의 난 세트] 장착 시', tone: 'disabled' }]
          ])
        },
        {
          name: '용투 : 용의 분노',
          icon: 'https://skilltab.test/oath/10.png',
          effects: oathEffects([[{ text: '분노', tone: 'rarity-primordial' }]])
        },
        {
          name: '용투 : 승리의 함성',
          icon: 'https://skilltab.test/oath/11.png',
          effects: oathEffects([[{ text: '[함성]', tone: 'increase' }]])
        }
      ]
    }
  ],
  items: [
    {
      name: '세계를 태우는 용투 서약',
      rarity: '에픽',
      icon: 'https://skilltab.test/oath-item/epic.webp'
    }
  ]
}

const NO_EFFECTS = { rare: null, unique: null, legendary: null, epic: null, primitive: null }

const CATALOG_SETS: readonly (readonly [number, string, readonly string[]])[] = [
  [16201, '어둠에 잠긴 그림자 서약', ['배후 습격', '죽음의 형상', '그림자 동화']],
  [16202, '태고의 페어리 서약', ['노블 엠프레스', '로열가드', '페어리 랜드']],
  [16203, '이상이 담긴 황금 서약', ['끝나지 않는 꿈', '황금의 세계', '숭배하라, 세상의 왕을']],
  [16204, '야망의 용투 서약', ['용제 강림', '세계를 태우는 불꽃', '싸워야만 하는 운명']],
  [16205, '완전무결한 정화 서약', ['심연의 타락', '찬란한 정화', '혼돈']],
  [16206, '운명의 행운 서약', ['찬란한 운명', '일궈낸 운명', '혼돈의 운명']],
  [16207, '극복의 한계 서약', ['압도적인 힘', '무한동력', '오버로드']],
  [16208, '근원에 닿은 자연 서약', ['자연의 벗', '기상 이변', '아마겟돈']],
  [16209, '영전의 발키리 서약', ['종말의 날', '천벌의 날개', '심판의 창']],
  [16210, '조화의 여우 서약', ['환상', '초월', '집중']],
  [16211, '결속된 무리 서약', ['고독한 사냥꾼', '길잡이의 조력자', '길잡이의 계승자']],
  [16212, '경계의 마력 서약', ['매지컬 프리즘', '미스틱 웨폰', '매직 컨트롤']]
]

const SHORT_NAMES: Readonly<Record<number, string>> = {
  16201: '그림자',
  16202: '페어리',
  16203: '황금',
  16204: '용투',
  16205: '정화',
  16206: '행운',
  16207: '한계',
  16208: '자연',
  16209: '발키리',
  16210: '여우',
  16211: '무리',
  16212: '마력'
}

const CATALOG_OATH_SETS: OathCatalog['sets'] = CATALOG_SETS.map(([setId, name, options]) => {
  const catalogOptions = options.map((option) => ({
    name: `${SHORT_NAMES[setId]} : ${option}`,
    icon: '',
    effects: NO_EFFECTS
  }))

  return { setId, name, icon: null, options: catalogOptions }
})

const setStatsOathCatalog: OathCatalog = {
  version: 'synthetic',
  sets: CATALOG_OATH_SETS,
  items: []
}

export const oathCatalogFixture = {
  characterDetail: characterDetailOathCatalog,
  setStats: setStatsOathCatalog
} as const satisfies Record<string, OathCatalog>
