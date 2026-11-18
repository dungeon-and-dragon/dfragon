import { Popover } from '@dfragon/ui'
import { type KeyboardEvent, useRef, useState } from 'react'
import { MISSING_VALUE } from '#core/capture/cards'
import type { CandidatePicker } from '#core/capture/candidate-picker'
import { characterImageUrl } from '#core/character/character-summary'
import type { CharacterChoice } from '#core/search/search'
import { CardImage } from './CardImage'
import { CheckIcon } from './CheckIcon'
import { ChevronDownIcon } from './ChevronDownIcon'

const integer = new Intl.NumberFormat('ko-KR')

const focusRingClass =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'

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
        className={`badge badge-sm m-0 cursor-pointer gap-1 border border-current bg-transparent font-semibold text-signal [font-family:inherit] transition-colors hover:bg-inset data-popup-open:bg-inset ${focusRingClass}`}
      >
        {`후보 ${count}`}
        <ChevronDownIcon className="size-[10px] stroke-3" />
      </Popover.Trigger>
      <Popover.Popup
        side="bottom"
        align="start"
        sideOffset={6}
        aria-label={`${slot}번 후보 고르기`}
        initialFocus={shownRef}
      >
        <div
          role="group"
          aria-label={`${slot}번 같은 이름 후보`}
          onKeyDown={moveTileFocus}
          className="flex gap-2 p-2"
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
      className={`relative m-0 box-border flex w-16 cursor-pointer flex-col rounded-control border bg-transparent p-0 text-left text-fg [font-family:inherit] transition-colors ${shown ? 'border-signal shadow-selected' : 'border-transparent hover:border-line-input'} ${focusRingClass}`}
    >
      <span className="relative block size-[62px] overflow-hidden bg-inset">
        <CardImage src={characterImageUrl(choice)} />
      </span>
      {shown && (
        <span className="absolute top-[2px] right-[2px] flex size-4 items-center justify-center rounded-control bg-signal text-on-signal">
          <CheckIcon className="size-[10px] stroke-4" />
        </span>
      )}
      <span aria-hidden="true" className="truncate px-1 pt-1 text-2xs text-fg-muted">
        {server}
      </span>
      <span
        aria-hidden="true"
        className={`px-1 pb-1 font-mono text-xs font-semibold tabular-nums ${choice.fame !== null ? 'text-game-fame' : 'text-fg-subtle'}`}
      >
        {fame}
      </span>
    </button>
  )
}
