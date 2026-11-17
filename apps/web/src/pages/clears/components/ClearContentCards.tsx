import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from '../../../components/ChevronDownIcon'
import { findClearContentBackground } from '../../../lib/clear-content-background'
import type { CardStage, ContentCard } from '../clear-overview'

type Edges = Readonly<{ start: boolean; end: boolean }>

const AT_BOTH_EDGES: Edges = { start: true, end: true }

const CARD =
  'relative m-0 box-border flex h-73.5 w-49 shrink-0 cursor-pointer snap-start flex-col items-stretch overflow-hidden rounded-panel border bg-canvas p-3.5 text-left [font-family:inherit] text-fg transition-colors duration-(--duration-hover) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal'
const CARD_IDLE = 'border-line hover:border-line-input'
const CARD_SELECTED = 'border-signal shadow-[inset_0_0_0_1px_var(--color-signal)]'
const SHADE =
  'absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-canvas)_70%,transparent)_0%,color-mix(in_srgb,var(--color-canvas)_20%,transparent)_30%,color-mix(in_srgb,var(--color-canvas)_92%,transparent)_78%)]'
const PAGER =
  'absolute top-1/2 z-1 -mt-4.5 inline-flex size-9 p-0 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface text-fg transition-colors duration-(--duration-hover) ease-standard hover:bg-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal'
const TREND_CLASSES = {
  up: 'text-fg-success',
  down: 'text-fg-danger',
  flat: 'text-fg-muted'
} as const

function edgesOf(track: HTMLElement): Edges {
  const start = track.scrollLeft <= 0
  const end = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1

  return { start, end }
}

export function ClearContentCards({
  cards,
  selectedKey,
  onOpen
}: {
  cards: readonly ContentCard[]
  selectedKey?: string
  onOpen: (card: ContentCard) => void
}): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState<Edges>(AT_BOTH_EDGES)

  useEffect(() => {
    const track = trackRef.current
    if (track == null) {
      return
    }

    function update(): void {
      if (track != null) {
        setEdges(edgesOf(track))
      }
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(track)
    track.addEventListener('scroll', update, { passive: true })

    return () => {
      observer.disconnect()
      track.removeEventListener('scroll', update)
    }
  }, [])

  function page(direction: 1 | -1): void {
    const track = trackRef.current
    track?.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' })
  }

  function previous(): void {
    page(-1)
  }

  function next(): void {
    page(1)
  }

  return (
    <nav aria-label="컨텐츠" className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card) => (
          <Card key={card.key} card={card} selected={card.key === selectedKey} onOpen={onOpen} />
        ))}
      </div>
      {!edges.start && (
        <button
          type="button"
          aria-label="이전 컨텐츠"
          onClick={previous}
          className={`${PAGER} left-0 sm:-left-4.5`}
        >
          <ChevronDownIcon className="size-4 rotate-90" />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          aria-label="다음 컨텐츠"
          onClick={next}
          className={`${PAGER} right-0 sm:-right-4.5`}
        >
          <ChevronDownIcon className="size-4 -rotate-90" />
        </button>
      )}
    </nav>
  )
}

function Card({
  card,
  selected,
  onOpen
}: {
  card: ContentCard
  selected: boolean
  onOpen: (card: ContentCard) => void
}): React.JSX.Element {
  const { kind, name, backgroundId, stages } = card
  const background = findClearContentBackground(backgroundId)

  function open(): void {
    onOpen(card)
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={open}
      className={`${CARD} ${selected ? CARD_SELECTED : CARD_IDLE}`}
    >
      {background !== undefined && (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-[center_20%]"
          style={{ backgroundImage: `url("${background}")` }}
        />
      )}
      <span aria-hidden="true" className={SHADE} />
      <span className="relative text-xs font-medium text-fg">{kind}</span>
      <span className="relative mt-auto text-base font-semibold">{name}</span>
      <span className="relative mt-2.5 flex gap-5">
        {stages.map((stage) => (
          <Stage key={stage.contentId} stage={stage} />
        ))}
      </span>
    </button>
  )
}

function Stage({
  stage: { stage, rate, change, cleared }
}: {
  stage: CardStage
}): React.JSX.Element {
  return (
    <span className="flex flex-col">
      {stage !== null && <span className="text-xs font-medium text-fg-muted">{stage}</span>}
      <span className="font-mono text-xl font-semibold tabular-nums">{rate}</span>
      {change !== null && (
        <span
          className={`font-mono text-xs font-semibold tabular-nums ${TREND_CLASSES[change.trend]}`}
        >
          {change.text}
        </span>
      )}
      <span className="mt-0.5 font-mono text-xs text-fg-muted tabular-nums">{cleared}</span>
    </span>
  )
}
