import * as stylex from '@stylexjs/stylex'
import { isMaxLevel } from '@dfragon/client-core/lib/character-level'
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
  adventureName = null,
  jobBesideName = false
}: {
  character: CharacterCellCharacter
  adventureName?: string | null
  jobBesideName?: boolean
}): React.JSX.Element {
  const grownJob = character.jobGrowName ?? character.jobName
  const job = grownJob != null ? formatJobName(grownJob) : null
  const level = character.level != null ? `Lv.${character.level}` : null
  const detailLevel = jobBesideName && isMaxLevel(character.level) ? null : level
  const detailJob = jobBesideName ? null : job
  const detail = [detailLevel, detailJob].filter((part) => part != null).join(' | ')

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
          {jobBesideName && job != null && <span {...stylex.props(styles.job)}>{job}</span>}
        </span>
        {detail !== '' && <span {...stylex.props(styles.detail)}>{detail}</span>}
      </span>
    </div>
  )
}
