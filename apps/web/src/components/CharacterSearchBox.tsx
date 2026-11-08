import { Select as BaseSelect } from '@base-ui/react/select'
import { Select } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { useNavigate } from '@tanstack/react-router'
import {
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  useRef,
  useState
} from 'react'
import { ALL_CHARACTER_SERVERS, isSearchableCharacterName } from '#core/api/character-schemas'
import { characterSearchServerOptions } from '../constants/server-options'
import { ChevronDownIcon } from './ChevronDownIcon'
import { CloseIcon } from './CloseIcon'
import { styles } from './CharacterSearchBox.style'
import { RecentCharacterList } from './RecentCharacterList'
import { SearchIcon } from './SearchIcon'

const ADVENTURE = 'adventure'
const scopeOptions = [...characterSearchServerOptions, { id: ADVENTURE, label: '모험단' }]
const MAX_CHARACTER_NAME_LENGTH = 12

export function CharacterSearchBox({
  size = 'medium'
}: {
  size?: 'medium' | 'large'
}): React.JSX.Element {
  const large = size === 'large'
  const navigate = useNavigate()
  const [scope, setScope] = useState(ALL_CHARACTER_SERVERS)
  const [name, setName] = useState('')
  const [recentOpen, setRecentOpen] = useState(false)
  const boxRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const isAdventure = scope === ADVENTURE
  const fieldName = isAdventure ? '모험단 이름' : '캐릭터 이름'

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const searchName = name.trim()
    if (isAdventure) {
      if (searchName !== '') {
        await navigate({ to: '/adventures/$adventureName', params: { adventureName: searchName } })
      }

      return
    }

    if (isSearchableCharacterName(searchName)) {
      await navigate({ to: '/search', search: { characterName: searchName, serverId: scope } })
    }
  }

  function handleNameChange(event: ChangeEvent<HTMLInputElement>): void {
    setName(event.target.value)
  }

  function openRecent(event: FocusEvent<HTMLInputElement>): void {
    const fromList =
      event.relatedTarget instanceof Node && listRef.current?.contains(event.relatedTarget)
    if (!fromList) {
      setRecentOpen(true)
    }
  }

  function closeRecent(): void {
    setRecentOpen(false)
  }

  function focusFirstResult(event: KeyboardEvent<HTMLInputElement>): void {
    const first = listRef.current?.querySelector('a')
    if (event.key !== 'ArrowDown' || event.nativeEvent.isComposing || first == null) {
      return
    }
    event.preventDefault()
    first.focus()
  }

  function clearName(): void {
    setName('')
    inputRef.current?.focus()
  }

  function handleScopeChange(next: string | null): void {
    if (next != null) {
      setScope(next)
    }
  }

  return (
    <form
      ref={boxRef}
      role="search"
      aria-label={isAdventure ? '모험단 검색' : '캐릭터 검색'}
      onSubmit={handleSubmit}
      {...stylex.props(styles.box, large && styles.largeBox)}
    >
      <BaseSelect.Root
        value={scope}
        onValueChange={handleScopeChange}
        items={scopeOptions.map((option) => ({ value: option.id, label: option.label }))}
      >
        <BaseSelect.Trigger
          aria-label="검색 대상"
          {...stylex.props(styles.server, large && styles.largeServer)}
        >
          <BaseSelect.Value />
          <ChevronDownIcon {...stylex.props(styles.chevron)} />
        </BaseSelect.Trigger>
        <Select.Popup aria-label="검색 대상" columns={3}>
          {scopeOptions.map((option) => (
            <Select.Item key={option.id} value={option.id}>
              <Select.ItemText>{option.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Popup>
      </BaseSelect.Root>
      <span aria-hidden="true" {...stylex.props(styles.divider, large && styles.largeDivider)} />
      <input
        ref={inputRef}
        type="search"
        aria-label={fieldName}
        placeholder={fieldName}
        maxLength={isAdventure ? undefined : MAX_CHARACTER_NAME_LENGTH}
        autoComplete="off"
        spellCheck={false}
        value={name}
        onChange={handleNameChange}
        onFocus={openRecent}
        onKeyDown={focusFirstResult}
        {...stylex.props(styles.input, large && styles.largeInput)}
      />
      {name !== '' && (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={clearName}
          {...stylex.props(styles.clear, large && styles.largeClear)}
        >
          <CloseIcon {...stylex.props(styles.clearIcon, large && styles.largeClearIcon)} />
        </button>
      )}
      <button
        type="submit"
        aria-label="검색"
        {...stylex.props(styles.submit, large && styles.largeSubmit)}
      >
        <SearchIcon {...stylex.props(styles.icon, large && styles.largeIcon)} />
      </button>
      <RecentCharacterList
        open={recentOpen && name === ''}
        anchor={boxRef}
        input={inputRef}
        list={listRef}
        onClose={closeRecent}
      />
    </form>
  )
}
