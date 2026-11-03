import { Popover } from '@base-ui/react/popover'
import * as stylex from '@stylexjs/stylex'
import { type KeyboardEvent, useRef, useState } from 'react'
import { MISSING_VALUE } from '@dfragon/client-core/constants/cards'
import type { CandidatePicker } from '@dfragon/client-core/lib/candidate-picker'
import { characterImageUrl } from '@dfragon/client-core/preload/common/search/character-summary'
import type { CharacterChoice } from '@dfragon/client-core/preload/common/types/search'
import { CardImage } from './CardImage'
import { CheckIcon } from './CheckIcon'
import { ChevronDownIcon } from './ChevronDownIcon'
import { styles } from './CandidatePopover.style'

const integer = new Intl.NumberFormat('ko-KR')

const TILE_STEPS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1
}

function moveTileFocus(event: KeyboardEvent<HTMLDivElement>): void {
  const step = TILE_STEPS[event.key]
  const tiles = [...event.currentTarget.querySelectorAll('button')]
  const index = tiles.findIndex((tile) => tile === event.target)
  if (step === undefined || index < 0) {
    return
  }
  event.preventDefault()
  tiles[(index + step + tiles.length) % tiles.length].focus()
}

export function CandidatePopover({
  slot,
  picker,
  onPick
}: {
  slot: number
  picker: CandidatePicker
  onPick: (serverId: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const shownRef = useRef<HTMLButtonElement>(null)
  const count = picker.choices.length
  const handleOpenChange = (next: boolean): void => setOpen(next)
  const handlePick = (serverId: string): void => {
    setOpen(false)
    onPick(serverId)
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        aria-label={`${slot}번 후보 고르기, 후보 ${count}`}
        {...stylex.props(styles.chip)}
      >
        {`후보 ${count}`}
        <ChevronDownIcon {...stylex.props(styles.chevron)} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          {...stylex.props(styles.positioner)}
        >
          <Popover.Popup
            aria-label={`${slot}번 후보 고르기`}
            initialFocus={shownRef}
            {...stylex.props(styles.popup)}
          >
            <div
              role="group"
              aria-label={`${slot}번 같은 이름 후보`}
              onKeyDown={moveTileFocus}
              {...stylex.props(styles.tiles)}
            >
              {picker.choices.map((choice) => {
                const shown = choice.serverId === picker.shownServerId

                return (
                  <CandidateTile
                    key={choice.serverId}
                    ref={shown ? shownRef : undefined}
                    choice={choice}
                    shown={shown}
                    onPick={handlePick}
                  />
                )
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function CandidateTile({
  ref,
  choice,
  shown,
  onPick
}: {
  ref?: React.Ref<HTMLButtonElement>
  choice: CharacterChoice
  shown: boolean
  onPick: (serverId: string) => void
}): React.JSX.Element {
  const server = choice.serverName ?? choice.serverId
  const fame = choice.fame !== null ? integer.format(choice.fame) : MISSING_VALUE
  const adventure = choice.adventureName !== null ? `, 모험단 ${choice.adventureName}` : ''
  const state = shown ? ', 지금 행에 보이는 후보' : ''
  const handleClick = (): void => onPick(choice.serverId)

  return (
    <button
      ref={ref}
      type="button"
      aria-label={`${server}, 명성 ${fame}${adventure}${state}`}
      aria-pressed={shown}
      onClick={handleClick}
      {...stylex.props(styles.tile, shown && styles.shown)}
    >
      <span {...stylex.props(styles.well)}>
        <CardImage src={characterImageUrl(choice)} />
      </span>
      {shown && (
        <span {...stylex.props(styles.check)}>
          <CheckIcon {...stylex.props(styles.checkIcon)} />
        </span>
      )}
      <span aria-hidden="true" {...stylex.props(styles.server)}>
        {server}
      </span>
      <span aria-hidden="true" {...stylex.props(styles.fame)}>
        {fame}
      </span>
    </button>
  )
}
