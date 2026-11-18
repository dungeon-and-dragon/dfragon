import {
  CHARACTER_SERVER_NAMES,
  characterImageUrl,
  displayJobName,
  isMaxLevel
} from '#core/character'
import { Link } from '@tanstack/react-router'
import type { StoredCharacter } from '#core/ranking'
import { Portrait } from '#components/Portrait'

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
      <span className="portrait portrait-sm">
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
            className="link min-w-0 truncate text-sm font-semibold text-fg"
          >
            {character.characterName}
          </Link>
          {adventureName != null && (
            <Link
              to="/adventures/$adventureName"
              params={{ adventureName }}
              className="link truncate text-xs text-fg-muted"
            >
              {adventureName}
            </Link>
          )}
          {job != null && (
            <span className="min-w-0 flex-1 truncate text-xs text-fg-subtle">{job}</span>
          )}
        </span>
        {showsLevel && (
          <span className="truncate num text-xs text-fg-subtle">{`Lv.${character.level}`}</span>
        )}
      </span>
    </div>
  )
}
