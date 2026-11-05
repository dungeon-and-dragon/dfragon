import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useCharacterDetail } from '../../hooks/useCharacterDetail'
import type { CharacterTab } from './character-tabs'
import { styles } from './CharacterDetailScreen.style'
import { CharacterSummary, CharacterSummarySkeleton } from './CharacterSummary'
import { CharacterTabs, CharacterTabsSkeleton } from './CharacterTabs'

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
  switch (result.status) {
    case 'loading':
      return (
        <div aria-busy="true" {...stylex.props(styles.screen)}>
          <span role="status" {...stylex.props(shapes.srOnly)}>
            캐릭터 정보를 받는 중입니다.
          </span>
          <CharacterSummarySkeleton />
          <CharacterTabsSkeleton />
        </div>
      )
    case 'error':
      return (
        <div {...stylex.props(styles.screen, styles.error)}>
          <p role="alert" {...stylex.props(styles.message)}>
            {result.message}
          </p>
        </div>
      )
    case 'success':
      return (
        <div {...stylex.props(styles.screen)}>
          <CharacterSummary detail={result.detail} />
          <CharacterTabs tab={tab} detail={result.detail} onTabChange={onTabChange} />
        </div>
      )
  }
}
