import { useCharacterDetail } from '#entities/character-detail'
import { useViewedCharacter } from './hooks/useViewedCharacter'
import type { CharacterTab } from './character-tabs'
import { CharacterSummary, CharacterSummarySkeleton } from './CharacterSummary'
import { CharacterTabs, CharacterTabsSkeleton } from './CharacterTabs'

const SCREEN = 'flex flex-col'

export function CharacterDetailScreen({
  serverId,
  characterId,
  tab,
  onTabChange
}: {
  serverId: string
  characterId: string
  tab: CharacterTab
  onTabChange: (tab: CharacterTab) => void
}): React.JSX.Element {
  const result = useCharacterDetail(serverId, characterId)
  useViewedCharacter(result.status === 'success' ? result.detail : null)
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" className={SCREEN}>
          <span role="status" className="sr-only">
            캐릭터 정보를 받는 중입니다.
          </span>
          <CharacterSummarySkeleton />
          <CharacterTabsSkeleton />
        </div>
      )
    case 'error':
      return (
        <div className={SCREEN}>
          {/* 요약 구획(144px)과, 위 여백(24px), 탭 줄(49px), 빈 탭 자리(360px)를 담은 탭 구획(433px)을 합친 높이라 오류가
              나도 화면 높이가 받는 중과 같다. */}
          <div className="section box-border flex min-h-[577px] items-center justify-center">
            <p role="alert" className="state state-error">
              {result.message}
            </p>
          </div>
        </div>
      )
    case 'success':
      return (
        <div className={SCREEN}>
          <CharacterSummary detail={result.detail} />
          <CharacterTabs tab={tab} detail={result.detail} onTabChange={onTabChange} />
        </div>
      )
  }
}
