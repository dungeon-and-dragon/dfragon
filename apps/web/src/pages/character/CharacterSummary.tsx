import { Button, RefreshIcon } from '@dfragon/ui'
import { displayJobName } from '#core/character/job-display'
import { Link } from '@tanstack/react-router'
import { MISSING_VALUE } from '#core/capture/cards'
import { formatApproximateScore, toScoreView } from '#core/character/card-score'
import { CHARACTER_SERVER_NAMES, characterImageUrl } from '#core/character/character-summary'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import { Portrait } from '../../components/Portrait'
import { characterDisplayOf } from '../../lib/stored-character'
import { FavoriteToggle } from '../../components/FavoriteToggle'
import { useRefreshCharacterDetail } from './hooks/useCharacterDetail'
import { useRefreshingNow } from '../../hooks/useRefreshingNow'
import { formatSeoulDateTime, formatTimeAgo } from '#core/time-format'

const integer = new Intl.NumberFormat('ko-KR')

// API도 마지막으로 받은 지 1분 안의 강제 갱신에는 Neople을 다시 부르지 않고 받아 둔 응답을 준다.
const REFRESH_INTERVAL_MS = 60_000

const SUMMARY = 'section flex flex-wrap items-center gap-6 px-4'
const WELL = 'relative h-[112px] w-[96px] shrink-0 overflow-hidden rounded-control bg-inset'
const IDENTITY = 'flex min-w-0 grow basis-[280px] flex-col gap-2'
const STATS = 'flex shrink-0 gap-12'
const STAT = 'stat min-w-[104px]'
const STAT_LABEL = 'stat-label'
const STAT_VALUE = 'stat-value font-mono tabular-nums'
const LINE = 'flex items-center gap-2 whitespace-nowrap'
const LINK = 'no-underline hover:text-fg hover:underline'
const SCORE_TONES = { dealer: 'text-score-dealer', buffer: 'text-score-buffer' } as const

export function CharacterSummary({ detail }: { detail: CharacterDetailView }): React.JSX.Element {
  const { character } = detail
  const favorite = characterDisplayOf(detail)
  const job = displayJobName(character, detail.card?.role ?? null)
  const { refresh, refreshing } = useRefreshCharacterDetail()
  const { lastSuccessfulFetchAt } = detail.freshness

  function refreshCharacter(): void {
    refresh({ serverId: character.serverId, characterId: character.characterId })
  }

  const affiliations = [
    {
      id: 'adventure',
      name: character.adventureName,
      tone: 'text-fg-adventure',
      link: character.adventureName != null && (
        <Link
          to="/adventures/$adventureName"
          params={{ adventureName: character.adventureName }}
          className={`text-fg-adventure ${LINK}`}
        >
          {character.adventureName}
        </Link>
      )
    },
    {
      id: 'guild',
      name: character.guildName,
      tone: 'text-fg-guild',
      link: character.guildId != null && (
        <Link
          to="/guilds/$guildId"
          params={{ guildId: character.guildId }}
          className={`text-fg-guild ${LINK}`}
        >
          {character.guildName}
        </Link>
      )
    }
  ].filter((affiliation) => affiliation.name != null)

  return (
    <section aria-label="캐릭터 요약" aria-busy={refreshing || undefined} className={SUMMARY}>
      <div className={WELL}>
        <Portrait src={characterImageUrl(character)} />
      </div>
      <div className={IDENTITY}>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="screen-title">{character.characterName ?? MISSING_VALUE}</h1>
          {favorite != null && <FavoriteToggle character={favorite} />}
          <RefreshControl
            key={lastSuccessfulFetchAt}
            fetchedAt={lastSuccessfulFetchAt}
            refreshing={refreshing}
            onRefresh={refreshCharacter}
          />
        </div>
        <div className={LINE}>
          <span className="badge bg-inset text-fg-muted">
            {CHARACTER_SERVER_NAMES[character.serverId]}
          </span>
          {job != null && <span className="text-fg-muted">{job}</span>}
          {character.level != null && (
            <span className="font-mono tabular-nums text-fg-subtle">{`Lv.${character.level}`}</span>
          )}
        </div>
        {affiliations.length > 0 && (
          <div className={LINE}>
            {affiliations.map(({ id, name, tone, link }, index) => (
              <span key={id} className="inline-flex items-center gap-2">
                {index > 0 && <span aria-hidden="true" className="h-[10px] w-px bg-line-strong" />}
                {link || <span className={tone}>{name}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={STATS}>
        <FameStat fame={character.fame} />
        <ScoreStat card={detail.card} />
      </div>
    </section>
  )
}

// 받은 시각이 바뀌면 이전 시각의 타이머를 버리도록 받은 시각을 key로 다시 그린다.
function RefreshControl({
  fetchedAt,
  refreshing,
  onRefresh
}: {
  fetchedAt: string
  refreshing: boolean
  onRefresh: () => void
}): React.JSX.Element {
  const now = useRefreshingNow(Date.parse(fetchedAt))
  const justFetched = now - Date.parse(fetchedAt) < REFRESH_INTERVAL_MS

  return (
    <div className="ml-2 flex shrink-0 items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={refreshing || justFetched}
        onClick={onRefresh}
      >
        <RefreshIcon
          className={`size-icon-sm ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`}
        />
        {refreshing ? '받는 중' : '갱신'}
      </Button>
      <time
        dateTime={fetchedAt}
        title={formatSeoulDateTime(fetchedAt, now)}
        className="text-xs whitespace-nowrap text-fg-subtle"
      >
        {justFetched ? '방금 전' : formatTimeAgo(fetchedAt, now)}
      </time>
    </div>
  )
}

// 요약과 같은 칸 크기로 그려, 받은 뒤 요약이 들어와도 아래 탭 줄이 움직이지 않게 한다.
export function CharacterSummarySkeleton(): React.JSX.Element {
  return (
    <div aria-hidden="true" className={SUMMARY}>
      <div className={WELL} />
      <div className={IDENTITY}>
        <Bone width={160} height={28} />
        <Bone width={200} height={20} />
        <Bone width={140} height={20} />
      </div>
      <div className={STATS}>
        {[0, 1].map((stat) => (
          <div key={stat} className={STAT}>
            <Bone width={40} height={16} />
            <Bone width={96} height={28} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Bone({ width, height }: { width: number; height: number }): React.JSX.Element {
  return <span className="block rounded-control bg-inset" style={{ width, height }} />
}

function FameStat({ fame }: { fame: number | null }): React.JSX.Element {
  return (
    <div className={STAT}>
      <span className={STAT_LABEL}>명성</span>
      {fame != null ? (
        <span className={`${STAT_VALUE} text-game-fame`}>{integer.format(fame)}</span>
      ) : (
        <span className={`${STAT_VALUE} text-fg-subtle`}>{MISSING_VALUE}</span>
      )}
    </div>
  )
}

function ScoreStat({ card }: { card: CharacterDetailView['card'] }): React.JSX.Element {
  const { label, tone, value, approximate, description } = toScoreView(card)
  const note = description !== undefined && <span className="sr-only">{description}</span>
  const toneClass = tone !== null ? SCORE_TONES[tone] : ''
  const approximateClass = approximate ? 'border-b border-dotted border-fg-subtle' : ''

  return (
    <div className={STAT}>
      <span className={STAT_LABEL}>{label}</span>
      {value != null ? (
        <span title={description} className={`${STAT_VALUE} ${toneClass} ${approximateClass}`}>
          {approximate ? formatApproximateScore(value) : integer.format(value)}
          {note}
        </span>
      ) : (
        <span className={`${STAT_VALUE} text-fg-subtle`}>
          {MISSING_VALUE}
          {note}
        </span>
      )}
    </div>
  )
}
