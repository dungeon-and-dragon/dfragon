export type RunBody = {
  id: number
  trigger: 'schedule' | 'catchup' | 'manual'
  status: 'requested' | 'running' | 'succeeded' | 'failed' | 'interrupted'
  args: unknown
  requestedAt: string
  startedAt: string | null
  finishedAt: string | null
  progress: { done: number; total: number | null } | null
  summary: Record<string, string | number | boolean | null> | null
  error: Array<{ name: string; code?: string; frames?: string[] }> | null
}

export type JobBody = {
  name: string
  displayName: string
  description: string
  schedule: string | null
  paused: boolean
  nextRunAt: string | null
  argsSchema: object
  delayMinutes: number
  neopleApi: { group: string; endpoints: string[] } | null
  activeRun: RunBody | null
  lastFinishedRun: RunBody | null
}

export type CollectionBody = {
  waiting: number
  oldestQueuedAt: string | null
  failures: Array<{ failure: string; count: number; lastAttemptedAt: string | null }>
}

export type BatchKeyBody = {
  id: number
  label: string
  keySuffix: string
  enabled: boolean
  createdAt: string
  rejectedAt: string | null
}

export type LabItemBody = {
  itemName: string
  cost: { currencyId: number; count: number } | null
}

export type LabItemGroupBody = {
  category: string
  role: string
  tier: string
  items: LabItemBody[]
}

export type LabCurrencyBody = {
  id: number
  name: string
  description: string | null
  updatedAt: string
}

type LabItemCardBody = {
  slots: string[]
  enchants: { upgrade: number; status: { name: string; value: string }[] }[]
}

export type LabItemDetailBody = {
  itemName: string
  description: string | null
  itemRarity: string | null
  itemTypeDetail: string | null
  availableLevel: number | null
  fame: number | null
  card: LabItemCardBody | null
  hasIcon: boolean
  updatedAt: string
}

type LabItemDetailRequest = {
  itemName: string
  description: string
  itemRarity: string | null
  itemTypeDetail: string
  availableLevel: number | null
  fame: number | null
  card: LabItemCardBody | null
  icon?: string | null
}

type LabCurrencyRequest = { name: string; description: string; icon?: string }

export type LabCandidateBody = {
  itemName: string
  kind: 'TITLE' | 'CREATURE' | 'AURA' | 'ENCHANT'
  categories: string[]
  roles: string[]
  itemRarity: string | null
  fame: number | null
  availableLevel: number | null
  itemTypeDetail: string | null
  options: { name: string; value: string }[]
  buffLines: string[]
  card: LabItemCardBody | null
  description: string | null
  sourceItemId: string
  versionId: string
  importedAt: string
  hasIcon: boolean
  iconUpdatedAt: string | null
  itemId: string | null
  unitPrice: number | null
  checkedAt: string | null
  previousPrice: { itemId: string | null; unitPrice: number | null; checkedAt: string } | null
  wearCount: number | null
  wearCountedAt: string | null
  recommendedTier: '종결' | '준종결' | null
  badge: '미조회' | '검색 없음' | '매물 없음' | null
}

export type PriceHistoryBody = {
  id: number
  itemName: string
  itemId: string | null
  unitPrice: number | null
  checkedAt: string
}

/** 추천 등급과 배지는 운영 app이 계산하므로 테스트가 기대하는 값을 그대로 넣는다. */
export function labCandidate(
  overrides: Partial<LabCandidateBody> & Pick<LabCandidateBody, 'itemName'>
): LabCandidateBody {
  return {
    kind: 'TITLE',
    categories: ['TITLE'],
    roles: ['all'],
    itemRarity: '레어',
    fame: 100,
    availableLevel: null,
    itemTypeDetail: null,
    options: [],
    buffLines: [],
    card: null,
    description: null,
    sourceItemId: 'synthetic-item',
    versionId: 'synthetic-version',
    importedAt: '2026-11-10T00:00:00.000Z',
    hasIcon: false,
    iconUpdatedAt: null,
    itemId: 'synthetic-item',
    unitPrice: 1_000_000,
    checkedAt: '2026-11-10T05:00:00.000Z',
    previousPrice: null,
    wearCount: null,
    wearCountedAt: null,
    recommendedTier: null,
    badge: null,
    ...overrides
  }
}

const CANDIDATE_KINDS: readonly string[] = ['TITLE', 'CREATURE', 'AURA']

/** 운영 app처럼 종류 밖의 query 키를 받지 않고, 마법부여는 부위와 역할을 함께 받는다. */
function isCandidateQuery(query: Record<string, string>): boolean {
  const keys = Object.keys(query).sort().join(',')

  if (query.kind === 'ENCHANT') {
    return keys === 'category,kind,role'
  }

  return keys === 'kind' && CANDIDATE_KINDS.includes(query.kind ?? '')
}

/** 운영 app처럼 빈 설명과 아이템 종류는 값 없음으로 둔다. */
function storedText(value: string): string | null {
  const trimmed = value.trim()

  if (trimmed === '') {
    return null
  }

  return trimmed
}

export type RecordedRequest = {
  method: string
  path: string
  contentType: string | null
  body: unknown
}

export const NO_ARGS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {},
  additionalProperties: false
}

export function run(overrides: Partial<RunBody> & Pick<RunBody, 'id'>): RunBody {
  return {
    trigger: 'schedule',
    status: 'succeeded',
    args: {},
    requestedAt: '2026-11-09T15:00:00.000Z',
    startedAt: '2026-11-09T15:00:00.000Z',
    finishedAt: '2026-11-09T15:02:41.000Z',
    progress: null,
    summary: null,
    error: null,
    ...overrides
  }
}

export function job(overrides: Partial<JobBody> & Pick<JobBody, 'name'>): JobBody {
  return {
    displayName: overrides.name,
    description: '',
    schedule: '0 0 * * *',
    paused: false,
    nextRunAt: '2026-11-10T15:00:00.000Z',
    argsSchema: NO_ARGS_SCHEMA,
    delayMinutes: 10,
    neopleApi: null,
    activeRun: null,
    lastFinishedRun: null,
    ...overrides
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const API_PREFIX_PATTERN = /^\/api\//
const JOB_ACTION_PATH_PATTERN = /^jobs\/([^/]+)\/(runs|pause|resume)$/
const BATCH_KEY_PATH_PATTERN = /^batch-neople-keys\/(\d+)(?:\/(enable|disable))?$/
const LAB_CURRENCY_PATH_PATTERN = /^lab-currencies\/(\d+)$/

const failure = (status: number, code: string) => json(status, { error: { code } })

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** 운영 포트의 경로와 응답 형태를 흉내 내는 메모리 API다. 화면이 보낸 요청은 `requests`에 남는다. */
export class FakeOpsApi {
  workerSeenAt: string | null = '2026-11-10T05:31:00.000Z'
  jobs: JobBody[] = []
  runs: Record<string, RunBody[]> = {}
  runPageSize = 20
  queues = [
    { name: 'timeline-sync', waiting: 0, running: 4 },
    { name: 'enhancement-backfill', waiting: 0, running: 1 },
    { name: 'season-backfill', waiting: 9870, running: 1 }
  ]
  collection: CollectionBody = { waiting: 0, oldestQueuedAt: null, failures: [] }
  batchKeys: BatchKeyBody[] = []
  labItems: LabItemGroupBody[] = []
  labCurrencies: LabCurrencyBody[] = []
  labCurrencyIcons = new Map<number, string>()
  labItemDetails: LabItemDetailBody[] = []
  labCandidates: LabCandidateBody[] = []
  labCandidateHistory: Record<string, PriceHistoryBody[]> = {}
  labCandidateQueries: Record<string, string>[] = []
  now = () => new Date().toISOString()
  requests: RecordedRequest[] = []
  private nextRunId = 1000
  private nextBatchKeyId = 100
  private readonly batchKeyValues = new Map<number, string>()

  readonly fetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const text = await request.text()
    const body: unknown = text !== '' ? JSON.parse(text) : undefined
    this.requests.push({
      method: request.method,
      path: url.pathname,
      contentType: request.headers.get('content-type'),
      body
    })

    return this.respond(request.method, url, body)
  }

  /** 원문은 중복 판정에만 쓰고 목록 응답에는 싣지 않는다. */
  addBatchKey(label: string, key: string, overrides: Partial<BatchKeyBody> = {}): BatchKeyBody {
    const id = this.nextBatchKeyId++
    const keySuffix = key.slice(-4)
    const added: BatchKeyBody = {
      id,
      label,
      keySuffix,
      enabled: true,
      createdAt: '2026-11-10T05:20:00.000Z',
      rejectedAt: null,
      ...overrides
    }
    this.batchKeys.push(added)
    this.batchKeyValues.set(added.id, key)

    return added
  }

  writes(): RecordedRequest[] {
    return this.requests.filter(({ method }) => method !== 'GET')
  }

  private respond(method: string, url: URL, body: unknown): Response {
    const path = url.pathname.replace(API_PREFIX_PATTERN, '')
    if (method === 'GET' && path === 'jobs') {
      return json(200, { workerSeenAt: this.workerSeenAt, jobs: this.jobs })
    }

    if (method === 'GET' && path === 'queues') {
      return json(200, { queues: this.queues })
    }

    if (method === 'GET' && path === 'collection') {
      return json(200, this.collection)
    }

    if (method === 'POST' && path === 'collection/requeue') {
      return this.requeue(body)
    }

    if (method === 'GET' && path === 'batch-neople-keys') {
      return json(200, { keys: this.batchKeys })
    }

    if (method === 'POST' && path === 'batch-neople-keys') {
      return this.addBatchKeyRequest(body)
    }

    if (method === 'GET' && path === 'lab-items') {
      return json(200, { groups: this.labItems })
    }

    if (method === 'PUT' && path === 'lab-items') {
      return this.replaceLabItems(body as LabItemGroupBody)
    }

    if (method === 'GET' && path === 'lab-item-details') {
      return json(200, { details: this.labItemDetails })
    }

    if (method === 'PUT' && path === 'lab-item-details') {
      return this.saveLabItemDetail(body as LabItemDetailRequest)
    }

    if (method === 'GET' && path === 'lab-candidates') {
      return this.readLabCandidates(url)
    }

    if (method === 'GET' && path === 'lab-candidates/history') {
      const itemName = url.searchParams.get('itemName') ?? ''
      const history = this.labCandidateHistory[itemName] ?? []

      return json(200, { history })
    }

    if (method === 'GET' && path === 'lab-candidates/icon') {
      return this.readLabCandidateIcon(url)
    }

    if (method === 'GET' && path === 'lab-currencies') {
      return json(200, { currencies: this.labCurrencies })
    }

    if (method === 'POST' && path === 'lab-currencies') {
      return this.addLabCurrency(body as LabCurrencyRequest & { icon: string })
    }

    if (method === 'PUT' && LAB_CURRENCY_PATH_PATTERN.test(path)) {
      const [, id] = LAB_CURRENCY_PATH_PATTERN.exec(path) ?? []

      return this.updateLabCurrency(Number(id), body as LabCurrencyRequest)
    }

    if (BATCH_KEY_PATH_PATTERN.test(path)) {
      return this.changeBatchKey(method, path)
    }

    if (method === 'GET' && path === 'jobs/runs') {
      return this.runPage(url)
    }

    const [, name, action] = JOB_ACTION_PATH_PATTERN.exec(path) ?? []
    const target = this.jobs.find((candidate) => candidate.name === decodeURIComponent(name ?? ''))
    if (target === undefined) {
      return failure(404, 'JOB_NOT_FOUND')
    }

    if (method === 'POST' && action === 'runs') {
      return this.requestRun(target, body)
    }

    if (method === 'POST' && (action === 'pause' || action === 'resume')) {
      target.paused = action === 'pause'
      target.nextRunAt = target.paused ? null : '2026-11-10T15:00:00.000Z'

      return new Response(null, { status: 204 })
    }

    return failure(404, 'NOT_FOUND')
  }

  private runPage(url: URL): Response {
    const before = Number(url.searchParams.get('before') ?? Number.POSITIVE_INFINITY)
    const runs = Object.entries(this.runs)
      .flatMap(([jobName, jobRuns]) => jobRuns.map((entry) => ({ ...entry, jobName })))
      .filter(({ id }) => id < before)
      .sort((left, right) => right.id - left.id)
    const page = runs.slice(0, this.runPageSize)
    const nextBefore = runs.length > this.runPageSize ? (page.at(-1)?.id ?? null) : null

    return json(200, { runs: page, nextBefore })
  }

  private requestRun(target: JobBody, body: unknown): Response {
    if (target.activeRun !== null) {
      return failure(409, 'JOB_ALREADY_RUNNING')
    }
    const args = (body as { args?: unknown }).args ?? {}
    const requested = run({
      id: this.nextRunId++,
      trigger: 'manual',
      status: 'requested',
      args,
      requestedAt: '2026-11-10T05:32:00.000Z',
      startedAt: null,
      finishedAt: null
    })
    target.activeRun = requested
    this.runs[target.name] = [requested, ...(this.runs[target.name] ?? [])]

    return json(202, { id: requested.id })
  }

  private requeue(body: unknown): Response {
    const { failure: kind } = body as { failure?: string }
    const matched = this.collection.failures.filter(
      (entry) => kind === undefined || entry.failure === kind
    )
    const requeued = matched.reduce((total, { count }) => total + count, 0)
    this.collection = {
      ...this.collection,
      waiting: this.collection.waiting + requeued,
      failures: this.collection.failures.filter((entry) => !matched.includes(entry))
    }

    return json(200, { requeued })
  }

  private addBatchKeyRequest(body: unknown): Response {
    const { label, key } = body as { label?: string; key?: string }
    const trimmedLabel = label?.trim() ?? ''
    const trimmedKey = key?.trim() ?? ''

    if (trimmedLabel === '' || trimmedKey === '') {
      return failure(400, 'INVALID_REQUEST')
    }

    if ([...this.batchKeyValues.values()].includes(trimmedKey)) {
      return failure(409, 'BATCH_NEOPLE_KEY_DUPLICATE')
    }

    const added = this.addBatchKey(trimmedLabel, trimmedKey, {
      createdAt: '2026-11-10T05:32:00.000Z'
    })

    return json(201, { id: added.id })
  }

  private readLabCandidates(url: URL): Response {
    const query = Object.fromEntries(url.searchParams)
    this.labCandidateQueries.push(query)

    if (!isCandidateQuery(query)) {
      return failure(400, 'INVALID_REQUEST')
    }

    const { kind, category, role } = query
    const candidates = this.labCandidates.filter(
      (candidate) =>
        candidate.kind === kind &&
        (category === undefined || candidate.categories.includes(category)) &&
        (role === undefined || candidate.roles.includes(role))
    )

    return json(200, { candidates })
  }

  private readLabCandidateIcon(url: URL): Response {
    const itemName = url.searchParams.get('itemName')
    const candidate = this.labCandidates.find((entry) => entry.itemName === itemName)

    if (candidate === undefined || !candidate.hasIcon) {
      return failure(404, 'LAB_CANDIDATE_ICON_NOT_FOUND')
    }

    return new Response(PNG_SIGNATURE, { status: 200, headers: { 'Content-Type': 'image/png' } })
  }

  /** 운영 app처럼 묶음 하나만 바꾸고, 비운 묶음은 목록에서 뺀다. 입력 검증은 운영 app 테스트가 맡는다. */
  private replaceLabItems(group: LabItemGroupBody): Response {
    const others = this.labItems.filter(
      ({ category, role, tier }) =>
        category !== group.category || role !== group.role || tier !== group.tier
    )
    this.labItems = group.items.length > 0 ? [...others, group] : others

    return new Response(null, { status: 204 })
  }

  /** 운영 app처럼 아이콘을 빼면 그대로 두고 null이면 지운다. 입력 검증은 운영 app 테스트가 맡는다. */
  private saveLabItemDetail({
    itemName,
    description,
    itemRarity,
    itemTypeDetail,
    availableLevel,
    fame,
    card,
    icon
  }: LabItemDetailRequest): Response {
    const saved = this.labItemDetails.find((detail) => detail.itemName === itemName)
    const hasIcon = icon === undefined ? (saved?.hasIcon ?? false) : icon !== null
    const updatedAt = this.now()
    const stored = storedText(description)
    const storedTypeDetail = storedText(itemTypeDetail)
    const detail = {
      itemName,
      description: stored,
      itemRarity,
      itemTypeDetail: storedTypeDetail,
      availableLevel,
      fame,
      card,
      hasIcon,
      updatedAt
    }

    const others = this.labItemDetails.filter((candidate) => candidate.itemName !== itemName)
    this.labItemDetails = [...others, detail]

    return new Response(null, { status: 204 })
  }

  /** 운영 app처럼 이름이 겹치면 409로 답한다. 아이콘 형식 검증은 운영 app 테스트가 맡는다. */
  private addLabCurrency({
    name,
    description,
    icon
  }: LabCurrencyRequest & { icon: string }): Response {
    if (this.labCurrencies.some((currency) => currency.name === name)) {
      return failure(409, 'LAB_CURRENCY_DUPLICATE')
    }

    const id = this.labCurrencies.length + 1
    const stored = storedText(description)
    const updatedAt = this.now()
    const added = { id, name, description: stored, updatedAt }
    this.labCurrencies = [...this.labCurrencies, added]
    this.labCurrencyIcons.set(id, icon)

    return json(201, { id })
  }

  private updateLabCurrency(id: number, { name, description, icon }: LabCurrencyRequest): Response {
    if (this.labCurrencies.some((currency) => currency.name === name && currency.id !== id)) {
      return failure(409, 'LAB_CURRENCY_DUPLICATE')
    }

    this.labCurrencies = this.labCurrencies.map((currency) => {
      if (currency.id !== id) {
        return currency
      }

      const stored = storedText(description)
      const updatedAt = this.now()

      return { ...currency, name, description: stored, updatedAt }
    })

    if (icon !== undefined) {
      this.labCurrencyIcons.set(id, icon)
    }

    return new Response(null, { status: 204 })
  }

  private changeBatchKey(method: string, path: string): Response {
    const [, id, action] = BATCH_KEY_PATH_PATTERN.exec(path) ?? []
    const target = this.batchKeys.find((candidate) => candidate.id === Number(id))
    if (target === undefined) {
      return failure(404, 'BATCH_NEOPLE_KEY_NOT_FOUND')
    }

    if (method === 'POST' && action !== undefined) {
      target.enabled = action === 'enable'

      if (target.enabled) {
        target.rejectedAt = null
      }

      return new Response(null, { status: 204 })
    }

    if (method === 'DELETE' && action === undefined) {
      this.batchKeys = this.batchKeys.filter((candidate) => candidate !== target)
      this.batchKeyValues.delete(target.id)

      return new Response(null, { status: 204 })
    }

    return failure(404, 'NOT_FOUND')
  }
}
