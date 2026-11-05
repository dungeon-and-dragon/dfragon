import * as stylex from '@stylexjs/stylex'
import { Link } from '@tanstack/react-router'
import {
  CHARACTER_SERVER_NAMES,
  characterImageUrl
} from '@dfragon/client-core/preload/common/search/character-summary'
import type { StoredCharacter } from '@dfragon/client-core/shared/ranking/ranking-stats'
import { Portrait } from '../Portrait'
import { styles } from './CharacterCell.style'

export function CharacterCell({ character }: { character: StoredCharacter }): React.JSX.Element {
  const details = [
    character.level != null ? `Lv.${character.level}` : null,
    character.jobGrowName ?? character.jobName
  ].filter((part) => part != null)

  return (
    <div {...stylex.props(styles.cell)}>
      <span {...stylex.props(styles.well)}>
        <Portrait src={characterImageUrl(character)} />
      </span>
      <span {...stylex.props(styles.identity)}>
        <span {...stylex.props(styles.line)}>
          <span {...stylex.props(styles.server)}>{CHARACTER_SERVER_NAMES[character.serverId]}</span>
          <Link
            to="/c/$serverId/$characterId"
            params={{ serverId: character.serverId, characterId: character.characterId }}
            {...stylex.props(styles.name)}
          >
            {character.characterName}
          </Link>
        </span>
        <span {...stylex.props(styles.detail)}>{details.join(' | ')}</span>
      </span>
    </div>
  )
}
