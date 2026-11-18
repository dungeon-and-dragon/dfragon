import { characterImageUrl, displayJobName, isMaxLevel } from '#core/character'
import { Link } from '@tanstack/react-router'
import type { StoredCharacter } from '#core/ranking'
import { Portrait } from '#components/Portrait'
import { PortraitPreview } from '#components/PortraitPreview'
import { ServerBadge } from '#components/ServerBadge'

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
  const image = characterImageUrl(character)

  return (
    <div className="flex min-w-0 items-center gap-3">
      <PortraitPreview src={image}>
        <span className="portrait portrait-sm">
          <Portrait src={image} />
        </span>
      </PortraitPreview>
      <span className="flex min-w-0 items-center gap-2">
        <ServerBadge serverId={character.serverId} />
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
        {job != null && <span className="min-w-0 truncate text-xs text-fg-subtle">{job}</span>}
        {showsLevel && (
          <span className="shrink-0 num text-xs text-fg-subtle">{`Lv.${character.level}`}</span>
        )}
      </span>
    </div>
  )
}
