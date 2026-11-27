import type { LabItemCategory, LabItemRole } from '@dfragon/lib/lab-items'

export const CATEGORY_NAMES: Readonly<Record<LabItemCategory, string>> = {
  WEAPON: '무기',
  JACKET: '상의',
  SHOULDER: '머리어깨',
  PANTS: '하의',
  WAIST: '벨트',
  SHOES: '신발',
  AMULET: '목걸이',
  WRIST: '팔찌',
  RING: '반지',
  SUPPORT: '보조장비',
  MAGIC_STON: '마법석',
  EARRING: '귀걸이',
  TITLE: '칭호',
  CREATURE: '크리쳐',
  AURA: '오라'
}

export const ROLE_NAMES: Readonly<Record<LabItemRole, string | undefined>> = {
  dealer: '딜러',
  buffer: '버퍼',
  all: undefined
}
