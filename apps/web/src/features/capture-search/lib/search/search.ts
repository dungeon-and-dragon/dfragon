import type {
  CharacterPortrait,
  CharacterSearchRow,
  SelectedCharacterSummary
} from '#entities/character'
import type { SearchError } from '#shared/api/api-error'

export const SEARCH_SLOT_COUNTS = { party: 4, raid: 12 } as const
export type SearchSlotCount = (typeof SEARCH_SLOT_COUNTS)[keyof typeof SEARCH_SLOT_COUNTS]

export const SEARCH_ACTIONS = {
  READ: 'read',
  BEGIN: 'begin',
  END: 'end',
  LOOKUP: 'lookup'
} as const

export const CHARACTER_SELECTION_METHODS = [
  'portrait',
  'job',
  'fame',
  'highest-fame',
  'manual'
] as const
export type CharacterSelectionMethod = (typeof CHARACTER_SELECTION_METHODS)[number]

export const SELECTED_DETAILS_STATES = ['pending', 'failed'] as const
export type SelectedDetailsState = (typeof SELECTED_DETAILS_STATES)[number]

/** 서버 칩으로 고른 조회는 `serverId`를 보내고, 이름 칸 Enter는 서버 없이 보내 그 자리의 OCR 관측으로 고르게 한다. */
export type ManualCharacterLookup = SearchObservation & Readonly<{ serverId?: string }>

export type SearchControl =
  | Readonly<{ action: typeof SEARCH_ACTIONS.READ }>
  | Readonly<{ action: typeof SEARCH_ACTIONS.BEGIN }>
  | (Readonly<{ action: typeof SEARCH_ACTIONS.LOOKUP }> & ManualCharacterLookup)
  | Readonly<{ action: typeof SEARCH_ACTIONS.END; captureId: string }>

export type SearchObservation = Readonly<{
  captureId: string
  slot: number
  observationRevision: number
  nickname: string
}>

export const RAID_VALUE_COLUMNS = ['fame', 'equipment-score', 'unknown'] as const
export type RaidValueColumn = (typeof RAID_VALUE_COLUMNS)[number]

/** 직업명 칸에는 이보다 긴 글자가 들어가지 않는다. */
export const MAX_RAID_JOB_TEXT_LENGTH = 32
export const RAID_VALUE_TEXT_PATTERN = /^[0-9,.K]{1,16}$/

export type RaidRowObservation = Readonly<{
  jobText: string | null
  valueColumn: RaidValueColumn
  valueText: string | null
}>

export type OcrSearchInput = Readonly<{
  candidateNicknames: readonly string[]
  portrait: CharacterPortrait | null
  raidRow?: RaidRowObservation
}>
export type OcrSearchObservation = SearchObservation & OcrSearchInput

export type CharacterChoice = CharacterSearchRow & Readonly<{ adventureName: string | null }>

export const SEARCH_SLOT_STATES = ['idle', 'pending', 'success', 'empty', 'failure'] as const
type SearchSlotState = (typeof SEARCH_SLOT_STATES)[number]

export type SearchSlot = Readonly<{
  slot: number
  observationRevision: number
  requestId: string | null
  nickname: string | null
  state: SearchSlotState
  rows: readonly CharacterSearchRow[]
  error: SearchError | null
  selected?: SelectedCharacterSummary
  selectionMethod?: CharacterSelectionMethod
  choices?: readonly CharacterChoice[]
  details?: SelectedDetailsState
  detailsError?: SearchError
}>

export type SearchSnapshot = Readonly<{
  revision: number
  captureId: string | null
  slots: readonly SearchSlot[]
}>

export const SEARCH_COMMAND_ERRORS = {
  INVALID_SEARCH_COMMAND: 'INVALID_SEARCH_COMMAND',
  SEARCH_NOT_ALLOWED: 'SEARCH_NOT_ALLOWED',
  STALE_SEARCH: 'STALE_SEARCH'
} as const

export type SearchCommandError = (typeof SEARCH_COMMAND_ERRORS)[keyof typeof SEARCH_COMMAND_ERRORS]

export type SearchCommandResult =
  | Readonly<{ ok: true; snapshot: SearchSnapshot }>
  | Readonly<{ ok: false; error: { code: SearchCommandError }; snapshot: SearchSnapshot }>

export type SearchApi = {
  controlCharacterSearch: (control: SearchControl) => Promise<SearchCommandResult>
  onCharacterSearchChanged: (listener: (snapshot: SearchSnapshot) => void) => () => void
}

export type SearchView = {
  ready: boolean
  slots: readonly SearchSlot[]
  /** 마지막 회차 시작이나 종료 뒤 사용자가 서버와 이름으로 조회한 슬롯. 회차의 OCR 결과가 덮지 않는다. */
  manualSlots: readonly boolean[]
  connectionFailed: boolean
}
