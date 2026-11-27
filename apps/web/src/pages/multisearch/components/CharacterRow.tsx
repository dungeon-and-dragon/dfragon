import {
  formatApproximateScore,
  formatJobName,
  type ScoreView,
  toScoreView,
  Portrait
} from '#entities/character'
import { Link } from '@tanstack/react-router'
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react'
import {
  type CardCharacter,
  type CharacterTier,
  type SearchMode,
  type SlotCard,
  type SlotNotice,
  tierLabels,
  type LookupDraft,
  useLookupDraft,
  type SlotCardKey
} from '#features/capture-search'
import { MISSING_VALUE } from '#shared/lib/missing-value'
import { CandidatePopover } from './CandidatePopover'
import { LookupProgress } from './LookupProgress'
import { NameField } from './NameField'
import { ServerSelect } from '#shared/ui/ServerSelect'
import { SnapshotAdventureField } from './SnapshotAdventureField'
import { SnapshotBadge } from './SnapshotBadge'
import { serverOptions } from '#shared/config/server-options'
import { useServerMenu } from '#shared/ui/useServerMenu'
import { getLookupStep, type LookupStep } from '#pages/multisearch/card-presentation'

const integer = new Intl.NumberFormat('ko-KR')

const numberClass = 'num font-semibold'
const tagClass = 'badge badge-sm border border-current font-semibold'

const tierClasses: Readonly<Record<CharacterTier, string>> = {
  top: 'text-tier-top',
  ranker: 'text-tier-ranker'
}

const scoreToneClasses: Readonly<Record<NonNullable<ScoreView['tone']>, string>> = {
  dealer: 'text-score-dealer',
  buffer: 'text-score-buffer'
}

const noticeToneClasses: Readonly<Record<SlotNotice['tone'], string>> = {
  failure: 'text-card-failure',
  error: 'text-fg-danger',
  estimate: 'text-fg-warning'
}

export function CharacterRow({
  cardKey,
  card,
  slot,
  seat,
  screen,
  onLookup,
  onPickCandidate,
  onChangeSnapshotAdventure
}: {
  cardKey: SlotCardKey
  card: SlotCard
  slot: number
  seat: ReactNode
  screen: SearchMode
  onLookup: (nickname: string, serverId?: string) => void
  onPickCandidate: (serverId: string) => void
  onChangeSnapshotAdventure: (value: string) => void
}): React.JSX.Element {
  const {
    state,
    character,
    snapshotMark,
    snapshotAdventureInput,
    picker,
    picking = false,
    loading = false
  } = card
  const found = state === 'success' && character != null ? character : undefined
  const draft = useLookupDraft({
    cardKey,
    character,
    nickname: found === undefined ? card.nickname : undefined,
    onLookup
  })
  const serverMenu = useServerMenu()
  const lookupStep = getLookupStep(card)
  const notice: SlotNotice | undefined =
    draft.inputNotice === '' ? card.notice : { text: draft.inputNotice, tone: 'failure' }
  // 찾은 이름을 지우고 Enter를 누른 행은 빈 자리처럼 입력 안내만 보이고 이전 캐릭터 값을 감춘다.
  const shown = draft.inputNotice === '' ? found : undefined
  const estimated = shown !== undefined && notice?.tone === 'estimate'
  const snapshotShown =
    shown !== undefined &&
    !draft.editing &&
    !picking &&
    lookupStep === null &&
    notice?.tone !== 'error'

  return (
    <>
      <td>{seat}</td>
      {/* 초상화 옆 이름 입력칸이 셀 위아래 여백과 합쳐 행을 48px보다 높이지 않게 이 칸만 위아래 여백을 두지 않는다. */}
      <td className="py-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`portrait portrait-sm${shown === undefined ? ' bg-surface' : ''}`}>
            {shown !== undefined && (
              <RowPortrait character={shown} face={screen === 'raid' ? shown.face : undefined} />
            )}
          </div>
          <LookupName
            slot={slot}
            draft={draft}
            vacant={draft.name === '' && !loading}
            onKeyDown={serverMenu.openOnTab}
          />
          {shown?.tier !== undefined && (
            <span className={`${tagClass} ${tierClasses[shown.tier]}`}>
              {tierLabels[shown.tier]}
            </span>
          )}
          {estimated && (
            <span title={notice?.text} className={`${tagClass} text-fg-warning`}>
              추정
            </span>
          )}
          {picker !== undefined && (
            <CandidatePopover slot={slot} picker={picker} onPick={onPickCandidate} />
          )}
        </div>
      </td>
      <td>
        <ServerSelect
          label={`${slot}번 서버`}
          value={draft.serverId}
          options={serverOptions}
          open={serverMenu.open}
          onOpenChange={serverMenu.setOpen}
          onValueChange={draft.changeServer}
        />
      </td>
      <DetailCells
        slot={slot}
        card={card}
        found={shown}
        notice={notice}
        editing={draft.editing}
        lookupStep={lookupStep}
        snapshotAdventureInput={snapshotAdventureInput}
        onChangeSnapshotAdventure={onChangeSnapshotAdventure}
      />
      <td>
        {snapshotShown && snapshotMark !== undefined && (
          <SnapshotBadge mark={snapshotMark} screen={screen} />
        )}
      </td>
    </>
  )
}

// 이름 칸은 편집 칸이라 링크로 만들지 않고 초상화로 상세에 간다.
function RowPortrait({
  character,
  face
}: {
  character: CardCharacter
  face: CardCharacter['face']
}): React.JSX.Element {
  const portrait = <Portrait src={character.image} face={face} />
  if (character.characterId === undefined) {
    return portrait
  }

  return (
    <Link
      to="/c/$serverId/$characterId"
      params={{ serverId: character.serverId, characterId: character.characterId }}
      aria-label={`${character.name} 상세`}
      draggable={false}
      className="absolute inset-0 cursor-pointer rounded-[inherit] focus-ring-inset"
    >
      {portrait}
    </Link>
  )
}

function LookupName({
  slot,
  draft,
  vacant,
  onKeyDown
}: {
  slot: number
  draft: LookupDraft
  vacant: boolean
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}): React.JSX.Element {
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    draft.changeName(event.target.value)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      draft.submit()

      return
    }
    onKeyDown(event)
  }

  return (
    <NameField
      vacant={vacant}
      aria-label={`${slot}번 캐릭터 이름`}
      placeholder={vacant ? '캐릭터 이름' : undefined}
      value={draft.name}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  )
}

function DetailCells({
  slot,
  card,
  found,
  notice,
  editing,
  lookupStep,
  snapshotAdventureInput,
  onChangeSnapshotAdventure
}: {
  slot: number
  card: SlotCard
  found: CardCharacter | undefined
  notice: SlotNotice | undefined
  editing: boolean
  lookupStep: LookupStep | null
  snapshotAdventureInput: string | undefined
  onChangeSnapshotAdventure: (value: string) => void
}): React.JSX.Element {
  if (lookupStep === '이름 인식' || lookupStep === '캐릭터 검색') {
    return (
      <>
        <td colSpan={3}>
          <LookupProgress slot={slot} step={lookupStep} />
        </td>
        <MissingCell end />
        <MissingCell end />
      </>
    )
  }

  if (found !== undefined && card.picking === true) {
    return (
      <>
        <td colSpan={3}>
          <LookupProgress slot={slot} step="상세 정보 확인" />
        </td>
        <FameCell fame={found.fame} tier={found.tier} />
        <MissingCell end />
      </>
    )
  }

  if (found !== undefined) {
    return (
      <FoundCells
        slot={slot}
        character={found}
        notice={notice}
        editing={editing}
        scorePending={lookupStep === '상세 정보 확인'}
        score={toScoreView(found.card, card.scorePending)}
      />
    )
  }

  return (
    <MissingCharacterCells
      slot={slot}
      notice={notice}
      snapshotAdventureInput={snapshotAdventureInput}
      onChangeSnapshotAdventure={onChangeSnapshotAdventure}
    />
  )
}

function MissingCharacterCells({
  slot,
  notice,
  snapshotAdventureInput,
  onChangeSnapshotAdventure
}: {
  slot: number
  notice: SlotNotice | undefined
  snapshotAdventureInput: string | undefined
  onChangeSnapshotAdventure: (value: string) => void
}): React.JSX.Element {
  if (snapshotAdventureInput !== undefined) {
    return (
      <>
        <td>
          <SnapshotAdventureField
            slot={slot}
            value={snapshotAdventureInput}
            notice={notice?.text ?? ''}
            onChange={onChangeSnapshotAdventure}
          />
        </td>
        <MissingCell />
        <MissingCell />
        <MissingCell end />
        <MissingCell end />
      </>
    )
  }

  if (notice === undefined) {
    return (
      <>
        <MissingCell />
        <MissingCell />
        <MissingCell />
        <MissingCell end />
        <MissingCell end />
      </>
    )
  }

  return (
    <>
      <td colSpan={3}>
        <NoticeText notice={notice} />
      </td>
      <MissingCell end />
      <MissingCell end />
    </>
  )
}

function FoundCells({
  slot,
  character,
  notice,
  editing,
  scorePending,
  score
}: {
  slot: number
  character: CardCharacter
  notice: SlotNotice | undefined
  editing: boolean
  scorePending: boolean
  score: ScoreView
}): React.JSX.Element {
  return (
    <>
      <AdventureCell adventure={character.adventure} editing={editing} />
      <GuildCell guildId={character.guildId} guild={character.guild} />
      <td title={formatJobName(character.job)} className="text-fg-muted">
        {formatJobName(character.job)}
      </td>
      <StatCells
        slot={slot}
        character={character}
        notice={notice}
        scorePending={scorePending}
        score={score}
      />
    </>
  )
}

function AdventureCell({
  adventure,
  editing
}: {
  adventure: string
  editing: boolean
}): React.JSX.Element {
  if (editing) {
    return <td className="text-fg-subtle">Enter로 조회</td>
  }

  return (
    <td title={adventure} className="text-fg-adventure">
      {adventure === MISSING_VALUE ? (
        adventure
      ) : (
        <Link
          to="/adventures/$adventureName"
          params={{ adventureName: adventure }}
          draggable={false}
          className="link"
        >
          {adventure}
        </Link>
      )}
    </td>
  )
}

function GuildCell({
  guildId,
  guild
}: {
  guildId: string | null | undefined
  guild: string | null | undefined
}): React.JSX.Element {
  if (guild == null) {
    return <td className="text-fg-subtle">{MISSING_VALUE}</td>
  }

  return (
    <td className="text-fg-guild">
      {guildId != null ? (
        <Link to="/guilds/$guildId" params={{ guildId }} draggable={false} className="link">
          {guild}
        </Link>
      ) : (
        guild
      )}
    </td>
  )
}

function StatCells({
  slot,
  character,
  notice,
  scorePending,
  score
}: {
  slot: number
  character: CardCharacter
  notice: SlotNotice | undefined
  scorePending: boolean
  score: ScoreView
}): React.JSX.Element {
  if (scorePending) {
    return (
      <td colSpan={2} className="text-right">
        <LookupProgress slot={slot} step="상세 정보 확인" />
      </td>
    )
  }

  if (notice?.tone === 'error') {
    return (
      <td colSpan={2} className="text-right text-xs whitespace-normal">
        <NoticeText notice={notice} />
      </td>
    )
  }

  return (
    <>
      <FameCell fame={character.fame} tier={character.tier} />
      <ScoreCell score={score} />
    </>
  )
}

function FameCell({
  fame,
  tier
}: {
  fame: number | null
  tier: CardCharacter['tier']
}): React.JSX.Element {
  if (fame == null) {
    return <MissingCell end />
  }

  return (
    <td
      className={`text-right ${numberClass} ${tier !== undefined ? tierClasses[tier] : 'text-game-fame'}`}
    >
      {integer.format(fame)}
    </td>
  )
}

function ScoreCell({ score }: { score: ScoreView }): React.JSX.Element {
  const { value, tone, approximate, description } = score

  return (
    <td className="text-right">
      {value != null ? (
        <span
          title={description}
          className={`${numberClass}${tone !== null ? ` ${scoreToneClasses[tone]}` : ''}${approximate ? ' border-0 border-b border-dotted border-fg-subtle' : ''}`}
        >
          {approximate ? formatApproximateScore(value) : integer.format(value)}
        </span>
      ) : (
        <span title={description} className={`${numberClass} text-fg-subtle`}>
          {MISSING_VALUE}
        </span>
      )}
    </td>
  )
}

function MissingCell({ end = false }: { end?: boolean }): React.JSX.Element {
  return (
    <td className={end ? `text-right ${numberClass} text-fg-subtle` : 'text-fg-subtle'}>
      {MISSING_VALUE}
    </td>
  )
}

function NoticeText({ notice }: { notice: SlotNotice }): React.JSX.Element {
  return (
    <span
      title={notice.text}
      className={`overflow-hidden text-ellipsis ${noticeToneClasses[notice.tone]}`}
    >
      <span aria-hidden="true" className="mr-2 font-semibold">
        !
      </span>
      {notice.text}
    </span>
  )
}
