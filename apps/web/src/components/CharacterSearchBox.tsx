import { Select as BaseSelect } from '@base-ui/react/select'
import { Select } from '@dfragon/ui'
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
import { RecentCharacterList } from './RecentCharacterList'
import { SearchIcon } from './SearchIcon'

const ADVENTURE = 'adventure'
const scopeOptions = [...characterSearchServerOptions, { id: ADVENTURE, label: '모험단' }]
const MAX_CHARACTER_NAME_LENGTH = 12

const iconButton =
  'm-0 inline-flex h-full shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-fg-muted outline-none -outline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal'
const SIZE_CLASSES = {
  medium: {
    box: 'h-control-sm w-[264px] max-sm:w-auto max-sm:min-w-0 max-sm:flex-1',
    server: 'gap-1 px-2 text-sm',
    divider: 'h-4',
    input: 'px-2 text-sm',
    clear: 'w-6',
    clearIcon: 'size-[14px]',
    submit: 'w-8',
    icon: 'size-4'
  },
  large: {
    box: 'h-control-lg w-[640px] max-w-full',
    server: 'gap-2 pr-3 pl-4 text-sm',
    divider: 'h-6',
    input: 'px-3 text-base',
    clear: 'w-8',
    clearIcon: 'size-4',
    submit: 'w-12',
    icon: 'size-icon-md'
  }
} as const

export function CharacterSearchBox({
  size = 'medium'
}: {
  size?: 'medium' | 'large'
}): React.JSX.Element {
  const sizeClasses = SIZE_CLASSES[size]
  const navigate = useNavigate()
  const [scope, setScope] = useState(ALL_CHARACTER_SERVERS)
  const [name, setName] = useState('')
  const [recentOpen, setRecentOpen] = useState(false)
  const boxRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
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
      event.relatedTarget instanceof Node && popupRef.current?.contains(event.relatedTarget)
    if (!fromList) {
      setRecentOpen(true)
    }
  }

  function closeRecent(): void {
    setRecentOpen(false)
  }

  function focusFirstResult(event: KeyboardEvent<HTMLInputElement>): void {
    const first = popupRef.current?.querySelector('a')
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
      className={`m-0 box-border flex shrink-0 items-center rounded-control border border-line-input bg-canvas text-fg transition-[border-color,box-shadow] duration-(--duration-hover) ease-standard focus-within:border-signal focus-within:shadow-[0_0_0_1px_var(--color-signal)] ${sizeClasses.box}`}
    >
      <BaseSelect.Root
        value={scope}
        onValueChange={handleScopeChange}
        items={scopeOptions.map((option) => ({ value: option.id, label: option.label }))}
      >
        <BaseSelect.Trigger
          aria-label="검색 대상"
          className={`m-0 inline-flex h-full shrink-0 cursor-pointer items-center border-0 bg-transparent font-medium whitespace-nowrap text-fg-muted [font-family:inherit] outline-none -outline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal ${sizeClasses.server}`}
        >
          <BaseSelect.Value />
          <ChevronDownIcon className="size-3" />
        </BaseSelect.Trigger>
        <Select.Popup aria-label="검색 대상" columns={3}>
          {scopeOptions.map((option) => (
            <Select.Item key={option.id} value={option.id}>
              <Select.ItemText>{option.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Popup>
      </BaseSelect.Root>
      <span aria-hidden="true" className={`w-px shrink-0 bg-line ${sizeClasses.divider}`} />
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
        className={`m-0 h-full min-w-0 grow border-0 bg-transparent py-0 text-inherit [font-family:inherit] outline-none placeholder:text-fg-placeholder [&::-webkit-search-cancel-button]:hidden ${sizeClasses.input}`}
      />
      {name !== '' && (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={clearName}
          className={`${iconButton} ${sizeClasses.clear}`}
        >
          <CloseIcon className={sizeClasses.clearIcon} />
        </button>
      )}
      <button type="submit" aria-label="검색" className={`${iconButton} ${sizeClasses.submit}`}>
        <SearchIcon className={sizeClasses.icon} />
      </button>
      <RecentCharacterList
        open={recentOpen && name === ''}
        size={size}
        anchor={boxRef}
        input={inputRef}
        popup={popupRef}
        onClose={closeRecent}
      />
    </form>
  )
}
