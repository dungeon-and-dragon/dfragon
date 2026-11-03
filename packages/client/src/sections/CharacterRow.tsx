import { shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react'
import { MISSING_VALUE, tierLabels } from '@dfragon/client-core/constants/cards'
import {
  type ScoreView,
  formatApproximateScore,
  toScoreView
} from '@dfragon/client-core/lib/card-score'
import type { SlotNotice } from '@dfragon/client-core/lib/character-card'
import type { SlotCard } from '@dfragon/client-core/lib/slot-cards'
import type { CardCharacter } from '@dfragon/client-core/types/cards'
import type { SearchMode } from '@dfragon/client-core/types/search-mode'
import { CandidatePopover } from '../components/CandidatePopover'
import { CardAnnouncer } from '../components/CardAnnouncer'
import { LookupProgress } from '../components/LookupProgress'
import { NameField } from '../components/NameField'
import { Portrait } from '../components/Portrait'
import { ServerSelect } from '../components/ServerSelect'
import { SnapshotAdventureField } from '../components/SnapshotAdventureField'
import { SnapshotBadge } from '../components/SnapshotBadge'
import { serverOptions } from '../constants/server-options'
import { type LookupDraft, useLookupDraft } from '../hooks/useLookupDraft'
import { useServerMenu } from '../hooks/useServerMenu'
import type { SlotCardKey } from '../hooks/useSlotCardStore'
import { getLookupStep, type LookupStep } from '../lib/card-presentation'
import { styles } from './CharacterRow.style'

const integer = new Intl.NumberFormat('ko-KR')

const shortScoreLabels: Readonly<Record<ScoreView['label'], string>> = {
  '장비 점수': '장비',
  '버프 점수': '버프'
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
      <td {...stylex.props(styles.cell, styles.seat)}>{seat}</td>
      <td {...stylex.props(styles.cell)}>
        <div {...stylex.props(styles.character)}>
          <div {...stylex.props(styles.well, shown === undefined && styles.wellEmpty)}>
            {shown !== undefined && (
              <Portrait src={shown.image} face={screen === 'raid' ? shown.face : undefined} />
            )}
          </div>
          <LookupName
            slot={slot}
            draft={draft}
            vacant={draft.name === '' && !loading}
            onKeyDown={serverMenu.openOnTab}
          />
          {shown?.tier !== undefined && (
            <span {...stylex.props(styles.badge, styles[shown.tier])}>
              {tierLabels[shown.tier]}
            </span>
          )}
          {estimated && <span {...stylex.props(styles.badge, styles.estimate)}>추정</span>}
          {picker !== undefined && (
            <CandidatePopover slot={slot} picker={picker} onPick={onPickCandidate} />
          )}
          <CardAnnouncer>
            {shown !== undefined && !draft.editing ? shown.name : (notice?.text ?? '')}
          </CardAnnouncer>
        </div>
      </td>
      <td {...stylex.props(styles.cell)}>
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
      <td {...stylex.props(styles.cell, styles.snapshot)}>
        {snapshotShown && snapshotMark !== undefined && (
          <SnapshotBadge mark={snapshotMark} screen={screen} />
        )}
      </td>
    </>
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
        <td colSpan={3} {...stylex.props(styles.cell)}>
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
        <td colSpan={3} {...stylex.props(styles.cell)}>
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
        <td {...stylex.props(styles.cell)}>
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
      <td colSpan={3} {...stylex.props(styles.cell)}>
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
      {notice?.tone === 'estimate' && !editing ? (
        <td colSpan={3} {...stylex.props(styles.cell)}>
          <span {...stylex.props(styles.adventure)}>{character.adventure}</span>
          <NoticeText notice={notice} inline />
        </td>
      ) : (
        <>
          <AdventureCell adventure={character.adventure} editing={editing} />
          <td
            {...stylex.props(styles.cell, character.guild == null ? styles.missing : styles.guild)}
          >
            {character.guild ?? MISSING_VALUE}
          </td>
          <td title={character.job} {...stylex.props(styles.cell, styles.job)}>
            {character.job}
          </td>
        </>
      )}
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
    return <td {...stylex.props(styles.cell, styles.subtle)}>Enter로 조회</td>
  }

  return (
    <td title={adventure} {...stylex.props(styles.cell, styles.adventure)}>
      {adventure}
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
      <td colSpan={2} {...stylex.props(styles.cell, styles.end)}>
        <LookupProgress slot={slot} step="상세 정보 확인" />
      </td>
    )
  }

  if (notice?.tone === 'error') {
    return (
      <td colSpan={2} {...stylex.props(styles.cell, styles.end, styles.wrap)}>
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
      {...stylex.props(styles.cell, styles.end, styles.number, tier !== undefined && styles[tier])}
    >
      {integer.format(fame)}
    </td>
  )
}

function ScoreCell({ score }: { score: ScoreView }): React.JSX.Element {
  const { value, tone, approximate, description } = score
  const note = description !== undefined && (
    <span {...stylex.props(shapes.srOnly)}>{description}</span>
  )

  return (
    <td {...stylex.props(styles.cell, styles.end)}>
      <span {...stylex.props(styles.scoreLabel)}>{shortScoreLabels[score.label]}</span>
      {value != null ? (
        <span
          title={description}
          {...stylex.props(
            styles.number,
            tone !== null && styles[tone],
            approximate && styles.approximate
          )}
        >
          {approximate ? formatApproximateScore(value) : integer.format(value)}
          {note}
        </span>
      ) : (
        <span {...stylex.props(styles.number, styles.missing)}>
          {MISSING_VALUE}
          {note}
        </span>
      )}
    </td>
  )
}

function MissingCell({ end = false }: { end?: boolean }): React.JSX.Element {
  return (
    <td {...stylex.props(styles.cell, styles.missing, end && styles.end, end && styles.number)}>
      {MISSING_VALUE}
    </td>
  )
}

function NoticeText({
  notice,
  inline = false
}: {
  notice: SlotNotice
  inline?: boolean
}): React.JSX.Element {
  return (
    <span
      title={notice.text}
      {...stylex.props(styles.notice, styles[notice.tone], inline && styles.inline)}
    >
      <span aria-hidden="true" {...stylex.props(styles.mark)}>
        !
      </span>
      {notice.text}
    </span>
  )
}
