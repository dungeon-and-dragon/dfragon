import type { ComponentType } from 'react'
import { AvatarCreatureTab } from './tabs/AvatarCreatureTab'
import { BuffTab } from './tabs/BuffTab'
import type { CharacterTabProps } from './tabs/character-tab-props'
import { EquipmentTab } from './tabs/EquipmentTab'
import { OathTab } from './tabs/OathTab'
import { SkillTab } from './tabs/SkillTab'
import { StatusTab } from './tabs/StatusTab'

type CharacterTabEntry = Readonly<{
  id: string
  label: string
  Content: ComponentType<CharacterTabProps>
}>

export const CHARACTER_TABS = [
  { id: 'equipment', label: '장비', Content: EquipmentTab },
  { id: 'oath', label: '서약', Content: OathTab },
  { id: 'skill', label: '스킬', Content: SkillTab },
  { id: 'avatar', label: '아바타와 크리쳐', Content: AvatarCreatureTab },
  { id: 'buff', label: '버프 강화', Content: BuffTab },
  { id: 'status', label: '스탯', Content: StatusTab }
] as const satisfies readonly CharacterTabEntry[]

export type CharacterTab = (typeof CHARACTER_TABS)[number]['id']

export type CharacterTabSearch = Readonly<{ tab?: CharacterTab | undefined }>

export const DEFAULT_CHARACTER_TAB: CharacterTab = 'equipment'

export function isCharacterTab(value: unknown): value is CharacterTab {
  return CHARACTER_TABS.some((tab) => tab.id === value)
}

// 주소창에 직접 고친 값처럼 모르는 tab은 버려 첫 탭을 연다. 라우터는 상위 route가 받은 원래 search 위에 이 결과를
// 덮으므로, 빈 객체를 돌려주면 모르는 tab이 그대로 남는다.
export function parseCharacterTabSearch(search: Record<string, unknown>): CharacterTabSearch {
  if (isCharacterTab(search.tab)) {
    return { tab: search.tab }
  }

  return { tab: undefined }
}
