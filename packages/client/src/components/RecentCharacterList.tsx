import { Popover } from '@base-ui/react/popover'
import * as stylex from '@stylexjs/stylex'
import { isMaxLevel } from '@dfragon/client-core/lib/character-level'
import { formatJobName } from '@dfragon/client-core/lib/job-format'
import { Link } from '@tanstack/react-router'
import type { KeyboardEvent, RefObject } from 'react'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import {
  CHARACTER_SERVER_NAMES,
  characterImageUrl
} from '@dfragon/client-core/preload/common/search/character-summary'
import { type RecentCharacter, useRecentCharacterStore } from '../hooks/useRecentCharacterStore'
import { CardImage } from './CardImage'
import { moveItemFocus } from './move-item-focus'
import { styles } from './RecentCharacterList.style'

const integer = new Intl.NumberFormat('ko-KR')

export function RecentCharacterList({
  open,
  anchor,
  input,
  list,
  onClose
}: {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  input: RefObject<HTMLInputElement | null>
  list: RefObject<HTMLUListElement | null>
  onClose: () => void
}): React.JSX.Element {
  const recentCharacters = useRecentCharacterStore((state) => state.recentCharacters)
  const removeRecentCharacter = useRecentCharacterStore((state) => state.removeRecentCharacter)

  function handleOpenChange(next: boolean): void {
    if (!next) {
      onClose()
    }
  }

  // 닫힌 뒤 초점을 이름 칸에 돌려주면 이름 칸이 목록을 또 열므로 닫을 때 초점을 옮기지 않는다. 항목에서 닫을 때만
  // 닫히기 전에 이름 칸으로 옮겨, 초점이 사라지지 않게 한다.
  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
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
    <Popover.Root open={open && recentCharacters.length > 0} onOpenChange={handleOpenChange}>
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          align="end"
          sideOffset={6}
          {...stylex.props(styles.positioner)}
        >
          <Popover.Popup
            aria-label="최근 본 캐릭터"
            initialFocus={input}
            finalFocus={false}
            {...stylex.props(styles.popup)}
          >
            <h3 {...stylex.props(styles.title)}>최근 본 캐릭터</h3>
            <ul ref={list} onKeyDown={handleListKeyDown} {...stylex.props(styles.list)}>
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function RecentItem({
  character,
  onPick
}: {
  character: RecentCharacter
  onPick: () => void
}): React.JSX.Element {
  const job = character.jobGrowName ?? character.jobName
  const showsLevel = character.level != null && !isMaxLevel(character.level)

  return (
    <Link
      to="/c/$serverId/$characterId"
      params={{ serverId: character.serverId, characterId: character.characterId }}
      onClick={onPick}
      {...stylex.props(styles.item)}
    >
      <span {...stylex.props(styles.well)}>
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
