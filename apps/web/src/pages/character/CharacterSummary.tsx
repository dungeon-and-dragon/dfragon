import { Button, RefreshIcon } from '@dfragon/ui'
import {
  type CharacterDetailView,
  characterImageUrl,
  displayJobName,
  formatApproximateScore,
  toScoreView,
  ServerBadge,
  characterDisplayOf,
  Portrait
} from '#entities/character'
import { Link } from '@tanstack/react-router'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import { FavoriteToggle } from '#features/favorite-character'
import { useRefreshCharacterDetail } from './api/useCharacterDetail'
import { useRefreshingNow } from '#shared/lib/useRefreshingNow'
import { formatSeoulDateTime, formatTimeAgo } from '#shared/lib/time-format'

const integer = new Intl.NumberFormat('ko-KR')

// API도 마지막으로 받은 지 1분 안의 강제 갱신에는 Neople을 다시 부르지 않고 받아 둔 응답을 준다.
const REFRESH_INTERVAL_MS = 60_000

const SUMMARY = 'section flex flex-wrap items-center gap-6 px-4'
// 600px 미만에서는 초상화 옆 같은 줄에 두도록 기준 폭을 두지 않는다.
const IDENTITY = 'flex min-w-0 grow basis-[280px] flex-col gap-2 max-sm:basis-0'
// 600px 미만에서는 초상화와 이름 줄을 좁히지 않도록 늘 다음 줄에 둔다.
const STATS = 'flex shrink-0 gap-12 max-sm:basis-full max-sm:gap-6'
// 600px 미만에서는 라벨과 값을 한 줄에 두고 값을 14px로 줄인다.
const STAT =
  'stat min-w-[104px] items-end max-sm:min-w-0 max-sm:flex-row max-sm:items-baseline max-sm:gap-2 max-sm:[&_.stat-value]:text-sm'
const LINE = 'flex items-center gap-2 whitespace-nowrap'
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
          className="link text-fg-adventure"
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
          className="link text-fg-guild"
        >
          {character.guildName}
        </Link>
      )
    }
  ].filter((affiliation) => affiliation.name != null)

  return (
    <section aria-label="캐릭터 요약" aria-busy={refreshing || undefined} className={SUMMARY}>
      <div className="portrait portrait-lg">
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
          <ServerBadge serverId={character.serverId} />
          {affiliations.map(({ id, name, tone, link }, index) => (
            <span key={id} className="inline-flex items-center gap-2">
              {index > 0 && <span aria-hidden="true" className="h-[10px] w-px bg-line-strong" />}
              {link || <span className={tone}>{name}</span>}
            </span>
          ))}
        </div>
        {(job != null || character.level != null) && (
          <div className={LINE}>
            {job != null && <span className="text-fg-muted">{job}</span>}
            {character.level != null && (
              <span className="num text-fg-subtle">{`Lv ${character.level}`}</span>
            )}
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
        className="text-xs whitespace-nowrap text-fg-subtle max-sm:hidden"
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
      <span className="skeleton portrait-lg" />
      <div className={IDENTITY}>
        <span className="skeleton-text w-[160px]" />
        <span className="skeleton-text w-[200px]" />
        <span className="skeleton-text w-[140px]" />
      </div>
      <div className={STATS}>
        {[0, 1].map((stat) => (
          <div key={stat} className={STAT}>
            <span className="skeleton-text skeleton-text-xs w-[40px]" />
            <span className="skeleton-text w-[96px]" />
          </div>
        ))}
      </div>
    </div>
  )
}

function FameStat({ fame }: { fame: number | null }): React.JSX.Element {
  return (
    <div className={STAT}>
      <span className="stat-label">명성</span>
      {fame != null ? (
        <span className="stat-value text-game-fame">{integer.format(fame)}</span>
      ) : (
        <span className="stat-value text-fg-subtle">{MISSING_VALUE}</span>
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
      <span className="stat-label">{label}</span>
      {value != null ? (
        <span title={description} className={`stat-value ${toneClass} ${approximateClass}`}>
          {approximate ? formatApproximateScore(value) : integer.format(value)}
          {note}
        </span>
      ) : (
        <span className="stat-value text-fg-subtle">
          {MISSING_VALUE}
          {note}
        </span>
      )}
    </div>
  )
}
