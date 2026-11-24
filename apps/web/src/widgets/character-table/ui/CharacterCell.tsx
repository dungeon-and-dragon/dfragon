import {
  CHARACTER_PAGE_PATHS,
  type CharacterPage,
  characterImageUrl,
  displayJobName,
  isMaxLevel,
  Portrait,
  ServerBadge
} from '#entities/character'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { StoredCharacter } from '#entities/ranking'
import { PortraitPreview } from '#shared/ui/PortraitPreview'

export type CharacterCellCharacter = Pick<
  StoredCharacter,
  'serverId' | 'characterId' | 'characterName' | 'level' | 'jobName' | 'jobGrowName' | 'role'
>

export function CharacterCell({
  character,
  adventureName = null,
  narrowStats,
  characterPage = 'detail'
}: {
  character: CharacterCellCharacter
  adventureName?: string | null
  narrowStats?: ReactNode
  characterPage?: CharacterPage
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
      <span className="flex min-w-0 flex-col">
        {/* 600~899px에서는 칸이 좁아 서버를 윗줄에 두고 이름과 직업을 아랫줄로 내린다. */}
        <span className="flex min-w-0 items-center gap-2 sm:max-md:flex-wrap sm:max-md:gap-y-0">
          <ServerBadge serverId={character.serverId} />
          <span aria-hidden="true" className="hidden sm:max-md:block sm:max-md:basis-full" />
          <span className="flex min-w-0 items-center gap-2 sm:max-md:max-w-full">
            <Link
              to={CHARACTER_PAGE_PATHS[characterPage]}
              params={{ serverId: character.serverId, characterId: character.characterId }}
              className="link min-w-0 truncate text-sm font-semibold text-fg sm:max-md:shrink-0"
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
              <span className="shrink-0 num text-xs text-fg-subtle">{`Lv ${character.level}`}</span>
            )}
          </span>
        </span>
        {narrowStats != null && (
          <span className="flex items-center gap-2 text-xs sm:hidden">{narrowStats}</span>
        )}
      </span>
    </div>
  )
}
