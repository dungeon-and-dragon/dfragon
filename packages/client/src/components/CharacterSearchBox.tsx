import { Select as BaseSelect } from '@base-ui/react/select'
import { Select } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useRef, useState } from 'react'
import { serverOptions } from '../constants/server-options'
import { useCharacterNameSearch } from '../hooks/useCharacterNameSearch'
import { ChevronDownIcon } from './ChevronDownIcon'
import { CharacterSearchResults } from './CharacterSearchResults'
import { styles } from './CharacterSearchBox.style'
import { SearchIcon } from './SearchIcon'

const ALL_SERVERS = 'all'
const searchServerOptions = [{ id: ALL_SERVERS, label: '전체' }, ...serverOptions]

export function CharacterSearchBox(): React.JSX.Element {
  const [serverId, setServerId] = useState(ALL_SERVERS)
  const [name, setName] = useState('')
  const boxRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const { state, search, close } = useCharacterNameSearch()

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const characterName = name.trim()
    if (characterName === '') {
      return
    }
    await search({ characterName, serverId: serverId === ALL_SERVERS ? null : serverId })
  }

  function handleNameChange(event: ChangeEvent<HTMLInputElement>): void {
    setName(event.target.value)
  }

  function focusFirstResult(event: KeyboardEvent<HTMLInputElement>): void {
    const first = listRef.current?.querySelector('a')
    if (event.key !== 'ArrowDown' || event.nativeEvent.isComposing || first == null) {
      return
    }
    event.preventDefault()
    first.focus()
  }

  function handleServerChange(next: string | null): void {
    if (next != null) {
      setServerId(next)
    }
  }

  return (
    <form
      ref={boxRef}
      role="search"
      aria-label="캐릭터 검색"
      onSubmit={handleSubmit}
      {...stylex.props(styles.box)}
    >
      <BaseSelect.Root
        value={serverId}
        onValueChange={handleServerChange}
        items={searchServerOptions.map((option) => ({ value: option.id, label: option.label }))}
      >
        <BaseSelect.Trigger aria-label="검색할 서버" {...stylex.props(styles.server)}>
          <BaseSelect.Value />
          <ChevronDownIcon {...stylex.props(styles.chevron)} />
        </BaseSelect.Trigger>
        <Select.Popup aria-label="검색할 서버" columns={3}>
          {searchServerOptions.map((option) => (
            <Select.Item key={option.id} value={option.id}>
              <Select.ItemText>{option.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Popup>
      </BaseSelect.Root>
      <span aria-hidden="true" {...stylex.props(styles.divider)} />
      <input
        ref={inputRef}
        type="search"
        aria-label="캐릭터 이름"
        placeholder="캐릭터 이름"
        maxLength={12}
        autoComplete="off"
        spellCheck={false}
        value={name}
        onChange={handleNameChange}
        onKeyDown={focusFirstResult}
        {...stylex.props(styles.input)}
      />
      <button
        type="submit"
        aria-label="검색"
        disabled={state.status === 'searching'}
        {...stylex.props(styles.submit)}
      >
        <SearchIcon {...stylex.props(styles.icon)} />
      </button>
      <CharacterSearchResults
        anchor={boxRef}
        input={inputRef}
        list={listRef}
        state={state}
        onClose={close}
      />
    </form>
  )
}
