import * as stylex from '@stylexjs/stylex'
import { isMaxLevel } from '#core/character/character-level'
import { formatJobName } from '#core/character/job-format'
import { Link } from '@tanstack/react-router'
import { CHARACTER_SERVER_NAMES, characterImageUrl } from '#core/character/character-summary'
import type { StoredCharacter } from '#core/ranking/ranking-stats'
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
  const grownJob = character.jobGrowName ?? character.jobName
  const job = grownJob != null ? formatJobName(grownJob) : null
  const showsLevel = character.level != null && !isMaxLevel(character.level)

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
          {job != null && <span {...stylex.props(styles.job)}>{job}</span>}
        </span>
        {showsLevel && <span {...stylex.props(styles.detail)}>{`Lv.${character.level}`}</span>}
      </span>
    </div>
  )
}
