import { Popover } from '@base-ui/react/popover'
import * as stylex from '@stylexjs/stylex'
import { isMaxLevel } from '#core/character/character-level'
import { formatJobName } from '#core/character/job-format'
import { grownJobName } from '#core/character/male-crusader'
import { Link } from '@tanstack/react-router'
import { type KeyboardEvent, type RefObject, useId } from 'react'
import { MISSING_VALUE } from '#core/capture/cards'
import { CHARACTER_SERVER_NAMES, characterImageUrl } from '#core/character/character-summary'
import { useFavoriteCharacterStore } from '../hooks/useFavoriteCharacterStore'
import { type RecentCharacter, useRecentCharacterStore } from '../hooks/useRecentCharacterStore'
import type { CharacterDisplay } from '../lib/stored-character'
import { CardImage } from './CardImage'
import { FavoriteToggle } from './FavoriteToggle'
import { moveItemFocus } from './move-item-focus'
import { styles } from './RecentCharacterList.style'

const integer = new Intl.NumberFormat('ko-KR')
const SECTION_ROW_LIMIT = 5

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
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          align={large ? 'start' : 'end'}
          sideOffset={6}
          {...stylex.props(styles.positioner)}
        >
          <Popover.Popup
            ref={popup}
            aria-label={large ? '최근 본 캐릭터와 즐겨찾기' : '최근 본 캐릭터'}
            initialFocus={input}
            finalFocus={false}
            onKeyDown={handleListKeyDown}
            {...stylex.props(styles.popup, large && styles.largePopup)}
          >
            {large ? (
              <SavedCharacterSections input={input} onPick={onClose} />
            ) : (
              <>
                <h3 {...stylex.props(styles.title)}>최근 본 캐릭터</h3>
                <ul {...stylex.props(styles.list)}>
                  {recentCharacters.map((character) => (
                    <li
                      key={`${character.serverId}/${character.characterId}`}
                      {...stylex.props(styles.row)}
                    >
                      <RecentItem character={character} onPick={onClose} />
                      <RemoveButton character={character} onRemove={remove} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
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

  // 즐겨찾기 절에서 별을 누르면 그 줄이 사라져 초점을 잃으므로 이름 칸으로 옮긴다.
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
    <section aria-labelledby={titleId} {...stylex.props(styles.section)}>
      <h3 id={titleId} {...stylex.props(styles.title, styles.sectionTitle)}>
        {title}
      </h3>
      {characters.length === 0 ? (
        <p {...stylex.props(styles.empty)}>{emptyMessage}</p>
      ) : (
        <ul {...stylex.props(styles.list)}>
          {characters.map((character) => (
            <li
              key={`${character.serverId}/${character.characterId}`}
              {...stylex.props(styles.sectionRow)}
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
  const job = grownJobName(character, character.role)
  const showsLevel = !large && character.level != null && !isMaxLevel(character.level)

  return (
    <Link
      to="/c/$serverId/$characterId"
      params={{ serverId: character.serverId, characterId: character.characterId }}
      onClick={onPick}
      {...stylex.props(styles.item, large && styles.largeItem)}
    >
      <span {...stylex.props(styles.well, large && styles.largeWell)}>
        <CardImage src={characterImageUrl(character)} />
      </span>
      <span {...stylex.props(styles.identity)}>
        <span {...stylex.props(styles.line)}>
          <span {...stylex.props(styles.server)}>{CHARACTER_SERVER_NAMES[character.serverId]}</span>
          <span {...stylex.props(styles.name)}>{character.characterName}</span>
          {job != null && <span {...stylex.props(styles.job)}>{formatJobName(job)}</span>}
        </span>
        {showsLevel && <span {...stylex.props(styles.level)}>{`Lv.${character.level}`}</span>}
      </span>
      <span {...stylex.props(styles.fame, character.fame == null && styles.missing)}>
        {character.fame != null ? integer.format(character.fame) : MISSING_VALUE}
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
      {...stylex.props(styles.remove)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" {...stylex.props(styles.removeIcon)}>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  )
}
