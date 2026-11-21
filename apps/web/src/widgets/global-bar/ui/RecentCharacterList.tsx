import { CloseIcon, Popover } from '@dfragon/ui'
import {
  characterImageUrl,
  displayJobName,
  isMaxLevel,
  ServerBadge,
  type CharacterDisplay,
  CardImage
} from '#entities/character'
import { Link } from '@tanstack/react-router'
import { type KeyboardEvent, type RefObject, useId } from 'react'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import { useFavoriteCharacterStore, FavoriteToggle } from '#features/favorite-character'
import { type RecentCharacter, useRecentCharacterStore } from '#features/recent-characters'
import { moveItemFocus } from '#shared/ui/move-item-focus'

const integer = new Intl.NumberFormat('ko-KR')
const SECTION_ROW_LIMIT = 5

const titleClass = 'm-0 flex h-8 items-center border-b border-line px-4 label'
const listClass = 'm-0 list-none p-0'

export function RecentCharacterList({
  open,
  size = 'medium',
  anchor,
  input,
  popup,
  onClose
}: {
  open: boolean
  size?: 'medium' | 'large'
  anchor: RefObject<HTMLElement | null>
  input: RefObject<HTMLInputElement | null>
  popup: RefObject<HTMLDivElement | null>
  onClose: () => void
}): React.JSX.Element {
  const large = size === 'large'
  const recentCharacters = useRecentCharacterStore((state) => state.recentCharacters)
  const removeRecentCharacter = useRecentCharacterStore((state) => state.removeRecentCharacter)

  function handleOpenChange(next: boolean): void {
    if (!next) {
      onClose()
    }
  }

  // 닫힌 뒤 초점을 이름 칸에 돌려주면 이름 칸이 목록을 또 열므로 닫을 때 초점을 옮기지 않는다. 항목에서 닫을 때만
  // 닫히기 전에 이름 칸으로 옮겨, 초점이 사라지지 않게 한다.
  function handleListKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape') {
      input.current?.focus()

      return
    }
    moveItemFocus(event)
  }

  function remove(character: RecentCharacter): void {
    removeRecentCharacter(character)
    input.current?.focus()
  }

  return (
    <Popover.Root
      open={open && (large || recentCharacters.length > 0)}
      onOpenChange={handleOpenChange}
    >
      <Popover.Popup
        anchor={anchor}
        side="bottom"
        align={large ? 'start' : 'end'}
        sideOffset={6}
        ref={popup}
        aria-label={large ? '최근 본 캐릭터와 즐겨찾기' : '최근 본 캐릭터'}
        initialFocus={input}
        finalFocus={false}
        onKeyDown={handleListKeyDown}
      >
        {/* 팝오버 테두리 1px씩을 빼 팝오버 바깥 폭이 기준 폭과 같게 한다. */}
        {large ? (
          <div className="max-h-[calc(var(--available-height)-2px)] w-[calc(var(--anchor-width)-2px)] overflow-y-auto">
            <SavedCharacterSections input={input} onPick={onClose} />
          </div>
        ) : (
          <div className="box-border max-h-[calc(min(480px,var(--available-height))-2px)] w-[min(418px,calc(var(--available-width)-2px))] overflow-y-auto py-1">
            <h3 className={titleClass}>최근 본 캐릭터</h3>
            <ul className={listClass}>
              {recentCharacters.map((character) => (
                <li key={`${character.serverId}/${character.characterId}`} className="relative">
                  <RecentItem character={character} onPick={onClose} />
                  <RemoveButton character={character} onRemove={remove} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Popover.Popup>
    </Popover.Root>
  )
}

function SavedCharacterSections({
  input,
  onPick
}: {
  input: RefObject<HTMLInputElement | null>
  onPick: () => void
}): React.JSX.Element {
  const recentCharacters = useRecentCharacterStore((state) => state.recentCharacters)
  const favoriteCharacters = useFavoriteCharacterStore((state) => state.favoriteCharacters)

  // 즐겨찾기 절에서 하트를 누르면 그 줄이 사라져 초점을 잃으므로 이름 칸으로 옮긴다.
  function focusInput(): void {
    input.current?.focus()
  }

  return (
    <>
      <SavedCharacterSection
        title="최근 본 캐릭터"
        emptyMessage="최근 본 캐릭터가 없습니다."
        characters={recentCharacters.slice(0, SECTION_ROW_LIMIT)}
        onPick={onPick}
      />
      <SavedCharacterSection
        title="즐겨찾기"
        emptyMessage="즐겨찾기한 캐릭터가 없습니다."
        characters={favoriteCharacters.slice(0, SECTION_ROW_LIMIT)}
        onPick={onPick}
        onFavoriteToggle={focusInput}
      />
    </>
  )
}

function SavedCharacterSection({
  title,
  emptyMessage,
  characters,
  onPick,
  onFavoriteToggle
}: {
  title: string
  emptyMessage: string
  characters: CharacterDisplay[]
  onPick: () => void
  onFavoriteToggle?: () => void
}): React.JSX.Element {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="border-t border-line first:border-t-0">
      <h3 id={titleId} className={`${titleClass} bg-surface`}>
        {title}
      </h3>
      {characters.length === 0 ? (
        <p className="m-0 flex h-12 items-center px-4 text-sm">{emptyMessage}</p>
      ) : (
        <ul className={listClass}>
          {characters.map((character) => (
            <li
              key={`${character.serverId}/${character.characterId}`}
              className="flex items-center gap-2 border-b border-line pr-4 transition-colors last:border-b-0 hover:bg-inset"
            >
              <RecentItem character={character} large onPick={onPick} />
              <FavoriteToggle character={character} onToggle={onFavoriteToggle} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecentItem({
  character,
  large = false,
  onPick
}: {
  character: CharacterDisplay
  large?: boolean
  onPick: () => void
}): React.JSX.Element {
  const job = displayJobName(character, character.role)
  const showsLevel = !large && character.level != null && !isMaxLevel(character.level)

  return (
    <Link
      to="/c/$serverId/$characterId"
      params={{ serverId: character.serverId, characterId: character.characterId }}
      onClick={onPick}
      className={`flex items-center pl-4 text-fg no-underline transition-colors focus-ring-inset hover:bg-inset focus-visible:bg-inset ${large ? 'box-border h-12 min-w-0 grow gap-3' : 'gap-3 py-2 pr-12'}`}
    >
      <span className="portrait portrait-sm">
        <CardImage src={characterImageUrl(character)} />
      </span>
      <span className="flex min-w-0 grow flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{character.characterName}</span>
          {job != null && (
            <span className="shrink-0 text-xs whitespace-nowrap text-fg-muted">{job}</span>
          )}
          {showsLevel && (
            <span className="shrink-0 num text-xs text-fg-subtle">{`Lv ${character.level}`}</span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <ServerBadge serverId={character.serverId} surface="control" />
          <span
            className={`num text-xs font-semibold ${character.fame == null ? 'text-fg-subtle' : 'text-game-fame'}`}
          >
            {character.fame != null ? integer.format(character.fame) : MISSING_VALUE}
          </span>
        </span>
      </span>
    </Link>
  )
}

function RemoveButton({
  character,
  onRemove
}: {
  character: RecentCharacter
  onRemove: (character: RecentCharacter) => void
}): React.JSX.Element {
  function handleClick(): void {
    onRemove(character)
  }

  return (
    <button
      type="button"
      aria-label={`${character.characterName} 최근 목록에서 지우기`}
      onClick={handleClick}
      className="absolute end-3 top-1/2 inline-flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-control text-fg-muted transition-colors focus-ring-inset hover:bg-control-hover hover:text-fg"
    >
      <CloseIcon className="size-icon-sm" />
    </button>
  )
}
