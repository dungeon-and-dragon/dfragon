import { isMaxLevel } from '#core/character/character-level'
import { displayJobName } from '#core/character/job-display'
import { Link } from '@tanstack/react-router'
import { CHARACTER_SERVER_NAMES, characterImageUrl } from '#core/character/character-summary'
import type { StoredCharacter } from '#core/ranking/ranking-stats'
import { Portrait } from '../Portrait'

export type CharacterCellCharacter = Pick<
  StoredCharacter,
  'serverId' | 'characterId' | 'characterName' | 'level' | 'jobName' | 'jobGrowName' | 'role'
>

export function CharacterCell({
  character,
  adventureName = null
}: {
  character: CharacterCellCharacter
  adventureName?: string | null
}): React.JSX.Element {
  const job = displayJobName(character, character.role)
  const showsLevel = character.level != null && !isMaxLevel(character.level)

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative h-[36px] w-8 shrink-0 overflow-hidden rounded-control bg-inset">
        <Portrait src={characterImageUrl(character)} />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="badge bg-inset text-fg-muted">
            {CHARACTER_SERVER_NAMES[character.serverId]}
          </span>
          <Link
            to="/c/$serverId/$characterId"
            params={{ serverId: character.serverId, characterId: character.characterId }}
            className="min-w-0 truncate text-sm font-semibold text-fg no-underline hover:underline"
          >
            {character.characterName}
          </Link>
          {adventureName != null && (
            <Link
              to="/adventures/$adventureName"
              params={{ adventureName }}
              className="truncate text-xs text-fg-muted no-underline hover:underline"
            >
              {adventureName}
            </Link>
          )}
          {job != null && (
            <span className="min-w-0 flex-1 truncate text-xs text-fg-subtle">{job}</span>
          )}
        </span>
        {showsLevel && (
          <span className="truncate font-mono text-xs tabular-nums text-fg-subtle">{`Lv.${character.level}`}</span>
        )}
      </span>
    </div>
  )
}
