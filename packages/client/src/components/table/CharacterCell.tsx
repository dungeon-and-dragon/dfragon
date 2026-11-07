import * as stylex from '@stylexjs/stylex'
import { formatJobName } from '@dfragon/client-core/lib/job-format'
import { Link } from '@tanstack/react-router'
import {
  CHARACTER_SERVER_NAMES,
  characterImageUrl
} from '@dfragon/client-core/preload/common/search/character-summary'
import type { StoredCharacter } from '@dfragon/client-core/shared/ranking/ranking-stats'
import { Portrait } from '../Portrait'
import { styles } from './CharacterCell.style'

export type CharacterCellCharacter = Pick<
  StoredCharacter,
  'serverId' | 'characterId' | 'characterName' | 'level' | 'jobName' | 'jobGrowName'
>

export function CharacterCell({
  character,
  adventureName = null
}: {
  character: CharacterCellCharacter
  adventureName?: string | null
}): React.JSX.Element {
  const job = character.jobGrowName ?? character.jobName
  const details = [
    character.level != null ? `Lv.${character.level}` : null,
    job != null ? formatJobName(job) : null
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
          {adventureName != null && (
            <Link
              to="/adventures/$adventureName"
              params={{ adventureName }}
              {...stylex.props(styles.adventure)}
            >
              {adventureName}
            </Link>
          )}
        </span>
        <span {...stylex.props(styles.detail)}>{details.join(' | ')}</span>
      </span>
    </div>
  )
}
