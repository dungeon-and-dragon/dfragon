import * as stylex from '@stylexjs/stylex'
import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from '../../../components/ChevronDownIcon'
import { findClearContentBackground } from '../../../lib/clear-content-background'
import type { CardStage, ContentCard } from '../clear-overview'
import { styles } from './ClearContentCards.style'

type Edges = Readonly<{ start: boolean; end: boolean }>

const AT_BOTH_EDGES: Edges = { start: true, end: true }

function edgesOf(track: HTMLElement): Edges {
  const start = track.scrollLeft <= 0
  const end = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1

  return { start, end }
}

export function ClearContentCards({
  cards,
  onOpen
}: {
  cards: readonly ContentCard[]
  onOpen: (contentId: string) => void
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
    <nav aria-label="컨텐츠" {...stylex.props(styles.cards)}>
      <div ref={trackRef} {...stylex.props(styles.track)}>
        {cards.map((card) => (
          <Card key={card.key} card={card} onOpen={onOpen} />
        ))}
      </div>
      {!edges.start && (
        <button
          type="button"
          aria-label="이전 컨텐츠"
          onClick={previous}
          {...stylex.props(styles.pager, styles.previous)}
        >
          <ChevronDownIcon {...stylex.props(styles.pagerIcon, styles.previousIcon)} />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          aria-label="다음 컨텐츠"
          onClick={next}
          {...stylex.props(styles.pager, styles.next)}
        >
          <ChevronDownIcon {...stylex.props(styles.pagerIcon, styles.nextIcon)} />
        </button>
      )}
    </nav>
  )
}

function Card({
  card: { kind, name, backgroundId, stages },
  onOpen
}: {
  card: ContentCard
  onOpen: (contentId: string) => void
}): React.JSX.Element {
  const background = findClearContentBackground(backgroundId)
  const single = stages.length === 1

  function open(): void {
    const first = stages[0]
    if (first !== undefined) {
      onOpen(first.contentId)
    }
  }

  return (
    <button type="button" onClick={open} {...stylex.props(styles.card)}>
      {background !== undefined && (
        <span aria-hidden="true" {...stylex.props(styles.image, styles.imageUrl(background))} />
      )}
      <span aria-hidden="true" {...stylex.props(styles.shade)} />
      <span {...stylex.props(styles.layer, styles.kind)}>{kind}</span>
      <span {...stylex.props(styles.layer, styles.name)}>{name}</span>
      <span {...stylex.props(styles.layer, styles.stages)}>
        {stages.map((stage) => (
          <Stage key={stage.contentId} stage={stage} single={single} />
        ))}
      </span>
    </button>
  )
}

function Stage({
  stage: { stage, rate, change, cleared },
  single
}: {
  stage: CardStage
  single: boolean
}): React.JSX.Element {
  return (
    <span {...stylex.props(styles.stage)}>
      {stage !== null && <span {...stylex.props(styles.stageName)}>{stage}</span>}
      <span {...stylex.props(styles.rate, single && styles.rateOne)}>{rate}</span>
      {change !== null && (
        <span
          {...stylex.props(
            styles.change,
            change.trend === 'up' && styles.up,
            change.trend === 'down' && styles.down
          )}
        >
          {change.text}
        </span>
      )}
      <span {...stylex.props(styles.cleared)}>{cleared}</span>
    </span>
  )
}
