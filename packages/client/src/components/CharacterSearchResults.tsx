import { Popover } from '@base-ui/react/popover'
import * as stylex from '@stylexjs/stylex'
import { Link } from '@tanstack/react-router'
import type { RefObject } from 'react'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import type { CharacterCandidate } from '@dfragon/client-core/preload/common/types/character'
import type { CharacterNameSearchState } from '../hooks/useCharacterNameSearch'
import { CardImage } from './CardImage'
import { styles } from './CharacterSearchResults.style'
import { moveItemFocus } from './move-item-focus'

const integer = new Intl.NumberFormat('ko-KR')

export function CharacterSearchResults({
  anchor,
  input,
  list,
  state,
  onClose
}: {
  anchor: RefObject<HTMLElement | null>
  input: RefObject<HTMLInputElement | null>
  list: RefObject<HTMLUListElement | null>
  state: CharacterNameSearchState
  onClose: () => void
}): React.JSX.Element {
  const open = state.status === 'choices' || state.status === 'empty' || state.status === 'error'
  const notice = state.status === 'error' ? state.message : '캐릭터를 찾지 못했습니다.'

  function handleOpenChange(next: boolean): void {
    if (!next) {
      onClose()
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="bottom"
          align="end"
          sideOffset={6}
          {...stylex.props(styles.positioner)}
        >
          <Popover.Popup
            aria-label="캐릭터 검색 결과"
            // 한글 입력을 확정하려고 Enter를 한 번 더 누르면 초점을 받은 첫 항목으로 가 버리므로 초점은 이름 칸에 둔다.
            initialFocus={input}
            finalFocus={input}
            {...stylex.props(styles.popup)}
          >
            {state.status === 'choices' ? (
              <ul ref={list} onKeyDown={moveItemFocus} {...stylex.props(styles.list)}>
                {state.rows.map((row) => (
                  <li key={`${row.serverId}/${row.characterId}`}>
                    <ResultItem row={row} onPick={onClose} />
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" {...stylex.props(styles.notice)}>
                {notice}
              </p>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ResultItem({
  row,
  onPick
}: {
  row: CharacterCandidate
  onPick: () => void
}): React.JSX.Element {
  const job = row.jobGrowName ?? row.jobName

  return (
    <Link
      to="/c/$serverId/$characterId"
      params={{ serverId: row.serverId, characterId: row.characterId }}
      onClick={onPick}
      {...stylex.props(styles.item)}
    >
      <span {...stylex.props(styles.well)}>
        <CardImage src={row.imageUrl} />
      </span>
      <span {...stylex.props(styles.identity)}>
        <span {...stylex.props(styles.name)}>{row.characterName}</span>
        {job != null && <span {...stylex.props(styles.job)}>{job}</span>}
      </span>
      <span {...stylex.props(styles.server)}>{row.serverName}</span>
      <span {...stylex.props(styles.fame, row.fame == null && styles.missing)}>
        {row.fame != null ? integer.format(row.fame) : MISSING_VALUE}
      </span>
    </Link>
  )
}
