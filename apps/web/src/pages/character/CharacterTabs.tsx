import { Tabs } from '@dfragon/ui'
import type { CharacterDetailView } from '#entities/character'
import { CHARACTER_TABS, type CharacterTab, isCharacterTab } from './character-tabs'

// 탭 안의 나란한 칸 사이 세로 선이 구획 아래 가로 선까지 닿도록 아래 여백을 두지 않고, 탭 글자 위아래 간격이 같도록
// 위 여백도 두지 않는다.
const ROOT = 'section flex flex-col py-0'
const LIST = 'shrink-0 px-1'
// 내용이 아직 없는 탭과 받는 중, 오류 상태가 같은 높이를 차지해 패널이 접히지 않게 한다. 600px 미만에서는 탭 안 모든 표의
// 칸 글자를 12px, 보통 굵기로 맞춘다.
const PANEL =
  'min-h-[360px] text-sm focus-ring-inset max-sm:[&_td]:text-xs max-sm:[&_td]:font-normal max-sm:[&_td_*]:text-xs max-sm:[&_td_*]:font-normal'

export function CharacterTabs({
  tab,
  detail,
  onTabChange
}: {
  tab: CharacterTab
  detail: CharacterDetailView
  onTabChange: (tab: CharacterTab) => void
}): React.JSX.Element {
  function handleValueChange(value: unknown): void {
    if (isCharacterTab(value)) {
      onTabChange(value)
    }
  }

  return (
    <Tabs.Root value={tab} onValueChange={handleValueChange} className={ROOT}>
      <Tabs.List aria-label="캐릭터 정보" render={<div className={LIST} />}>
        {CHARACTER_TABS.map(({ id, label }) => (
          <Tabs.Tab key={id} value={id}>
            {label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {CHARACTER_TABS.map(({ id, Content }) => (
        <Tabs.Panel key={id} value={id} className={PANEL}>
          <Content detail={detail} />
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}

export function CharacterTabsSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true" className={ROOT}>
      <div className="flex h-12 shrink-0 items-center gap-6 overflow-hidden border-b border-line px-4">
        {CHARACTER_TABS.map(({ id }) => (
          <span key={id} className="skeleton-text w-[56px]" />
        ))}
      </div>
      <div className={PANEL} />
    </div>
  )
}
