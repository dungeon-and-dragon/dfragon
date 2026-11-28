import type { OathCatalog } from '#entities/catalog/@x/ranking'

export const NO_SET_NAME = '세트 없음'

// 저장소 소유자가 #1781에서 정한 줄임말이다. 등급마다 바뀌는 세트 이름과 관계없이 Neople setItemId 하나에 하나를 쓴다.
const EQUIPMENT_SET_SHORT_NAMES: Readonly<Record<string, string>> = {
  '7f788a703a87d783079b41d0fe6448c9': '황금향',
  '11f7d203a05ea6f13300c0facb39f11e': '칠흑',
  '4ee7bd5912cda6e2a24c1f36d5202b46': '페어리',
  '93e7825053bdec4e0f4c12837cf4f57e': '여우',
  b92ca7784123b5fea9cea40144925194: '용투장',
  e23286107ba4328af86c83aabc347e9e: '무리',
  '7c9c8335b72c2907df20786f8f5b27f0': '세렌디',
  '3af7c961e7d8cd8b5b42c5f82af2a0ad': '그림자',
  '854dc8c01b1bc231e132dae5df3c52bc': '발키리',
  '2877466bc2fc8bedf7799d88167c9fe3': '한계',
  '4e65968c4d30898e6879434dc641b6e4': '자연',
  '8e9cb65cb6285d7e2f084f440aa18870': '마력'
}

// 같은 계열 장비 세트와 나란히 보이도록 장비 세트 줄임말에 맞춘다.
const OATH_SET_SHORT_NAMES: Readonly<Record<string, string>> = {
  '야망의 용투 서약': '용투장',
  '완전무결한 정화 서약': '칠흑',
  '이상이 담긴 황금 서약': '황금향',
  '태고의 페어리 서약': '페어리',
  '어둠에 잠긴 그림자 서약': '그림자',
  '영전의 발키리 서약': '발키리',
  '조화의 여우 서약': '여우',
  '운명의 행운 서약': '행운',
  '극복의 한계 서약': '한계',
  '근원에 닿은 자연 서약': '자연',
  '결속된 무리 서약': '무리',
  '경계의 마력 서약': '마력',
  '안개 서약': '안개'
}

export const SET_FAMILY_EQUIPMENT_SET_IDS: readonly string[] =
  Object.keys(EQUIPMENT_SET_SHORT_NAMES)

// 세렌디 세트의 짝은 행운 서약이다. 서약 효과가 세렌디 세트의 행운의 날개, 신의 축복을 바꾼다.
const OATH_SHORT_NAME_BY_EQUIPMENT: Readonly<Record<string, string>> = { 세렌디: '행운' }

export function sameFamilyOathShortName(equipmentShortName: string): string {
  const oathShortName = OATH_SHORT_NAME_BY_EQUIPMENT[equipmentShortName]
  if (oathShortName !== undefined) {
    return oathShortName
  }

  return equipmentShortName
}

// 서약 카탈로그는 선택지를 게임 서약 선택 화면의 왼쪽부터 오른쪽 순서로 둔다.
export const OATH_OPTION_POSITIONS = ['왼쪽', '가운데', '오른쪽'] as const

export function equipmentSetShortName(setId: string | null, name: string | null): string {
  if (setId === null) {
    return NO_SET_NAME
  }

  const shortName = EQUIPMENT_SET_SHORT_NAMES[setId]
  if (shortName !== undefined) {
    return shortName
  }

  if (name !== null) {
    return name
  }

  return setId
}

export function oathSetShortName(name: string | null): string {
  if (name === null) {
    return NO_SET_NAME
  }

  const shortName = OATH_SET_SHORT_NAMES[name]
  if (shortName !== undefined) {
    return shortName
  }

  return name
}

/** 카탈로그에 없는 선택지나 네 번째 이후 선택지는 원래 이름을 그대로 쓴다. */
export function oathOptionShortName(
  setName: string | null,
  optionName: string,
  catalogOptionNames: readonly string[]
): string {
  const position = OATH_OPTION_POSITIONS[catalogOptionNames.indexOf(optionName)]
  if (setName === null || position === undefined) {
    return optionName
  }

  return `${oathSetShortName(setName)} : ${position}`
}

export function catalogOptionNamesOf(catalog: OathCatalog | null, setId: number): string[] {
  const set = catalog?.sets.find((candidate) => candidate.setId === setId)
  if (set === undefined) {
    return []
  }

  return set.options.map(({ name }) => name)
}
