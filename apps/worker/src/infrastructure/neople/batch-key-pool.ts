import type { UsableBatchNeopleKey } from '@dfragon/database'
import { type NeopleKeyShortage, NeopleRequestFailure } from '@dfragon/neople'
import type { WorkerNeople } from './character-collection.js'
import { type PrioritizedNeople, dispatchNeople } from './request-priority.js'

const RATE_LIMITED_CODE = 'API002'
const RATE_LIMITED_REST_MS = 60_000
// Neople 결과 코드표의 key 미입력, 무효, 차단, 다른 게임용 key다.
// 2026-11-12 실제 응답은 형식이 틀린 key에 401 API000, 형식만 맞는 없는 key에 401 API003이었다.
const REJECTED_KEY_CODES: ReadonlySet<string> = new Set(['API000', 'API003', 'API004', 'API005'])

export interface BatchNeopleKeyRepository {
  readUsableKeys(): Promise<UsableBatchNeopleKey[]>
  recordRejected(id: number): Promise<void>
}

export type BatchNeopleKeyPoolDependencies = {
  store: BatchNeopleKeyRepository
  createNeople: (key: string) => PrioritizedNeople
  concurrencyPerKey: number
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
}

export type BatchNeopleKeyPool = PrioritizedNeople & {
  refresh(): Promise<void>
  readConcurrency(): number
  drainFailures(): string
}

type KeySlot = {
  id: number
  neople: PrioritizedNeople
  active: number
  restingUntil: number
}

/**
 * 쉬는 시각과 동시 요청 수는 worker 메모리에만 있어 worker 하나를 전제로 한다(ADR 0045).
 */
export function createBatchNeopleKeyPool({
  store,
  createNeople,
  concurrencyPerKey,
  report
}: BatchNeopleKeyPoolDependencies): BatchNeopleKeyPool {
  let slots = new Map<number, KeySlot>()
  let waiters: (() => void)[] = []
  let priorityWaiters: (() => void)[] = []
  let failures = new Map<string, number>()

  function countFailure({ kind, upstream }: NeopleRequestFailure): void {
    const reason = upstream !== undefined ? `${upstream.status}/${upstream.code ?? 'none'}` : kind
    failures.set(reason, (failures.get(reason) ?? 0) + 1)
  }

  function createSlot({ id, key }: UsableBatchNeopleKey): KeySlot {
    const neople = createNeople(key)

    return { id, neople, active: 0, restingUntil: 0 }
  }

  // 먼저 깨운 쪽이 먼저 이어 실행되어 빈 슬롯을 먼저 잡으므로, 먼저 내보낼 요청을 먼저 깨운다.
  function wakeWaiters(): void {
    const woken = [...priorityWaiters, ...waiters]
    priorityWaiters = []
    waiters = []

    for (const wake of woken) {
      wake()
    }
  }

  function findShortage(at: number): NeopleKeyShortage | undefined {
    if (slots.size === 0) {
      return 'no-key'
    }

    for (const slot of slots.values()) {
      if (slot.restingUntil <= at) {
        return undefined
      }
    }

    return 'all-resting'
  }

  function findFreeSlot(at: number): KeySlot | undefined {
    let found: KeySlot | undefined

    for (const slot of slots.values()) {
      const free = slot.restingUntil <= at && slot.active < concurrencyPerKey
      if (free && (found === undefined || slot.active < found.active)) {
        found = slot
      }
    }

    return found
  }

  async function acquire(priority: boolean): Promise<KeySlot> {
    for (;;) {
      const at = Date.now()
      const keyShortage = findShortage(at)
      if (keyShortage !== undefined) {
        throw new NeopleRequestFailure('unavailable', { keyShortage })
      }

      const slot = findFreeSlot(at)
      if (slot !== undefined) {
        slot.active++

        return slot
      }

      await new Promise<void>((resolve) => {
        if (priority) {
          priorityWaiters.push(resolve)
        } else {
          waiters.push(resolve)
        }
      })
    }
  }

  function release(slot: KeySlot): void {
    slot.active--
    wakeWaiters()
  }

  function rest(slot: KeySlot): void {
    const at = Date.now()
    if (slot.restingUntil <= at) {
      report('BATCH_NEOPLE_KEY_RESTING', { keyId: slot.id })
    }

    slot.restingUntil = at + RATE_LIMITED_REST_MS
  }

  async function reject(slot: KeySlot, code: string): Promise<void> {
    // 같은 key로 나간 다른 요청도 거절되므로 처음 거절된 요청만 key를 빼고 기록한다.
    if (slots.get(slot.id) !== slot) {
      return
    }

    slots.delete(slot.id)
    report('BATCH_NEOPLE_KEY_REJECTED', { keyId: slot.id, code })
    await store.recordRejected(slot.id)
  }

  async function dispatch<Result>(
    request: (neople: WorkerNeople) => Promise<Result>,
    priority: boolean
  ): Promise<Result> {
    for (;;) {
      const slot = await acquire(priority)
      try {
        const neople = priority ? slot.neople.priorityNeople : slot.neople.neople

        return await request(neople)
      } catch (error) {
        if (!(error instanceof NeopleRequestFailure)) {
          throw error
        }

        countFailure(error)

        const code = error.upstream?.code
        if (code === RATE_LIMITED_CODE) {
          rest(slot)
          continue
        }

        if (code !== undefined && REJECTED_KEY_CODES.has(code)) {
          await reject(slot, code)
          continue
        }

        throw error
      } finally {
        release(slot)
      }
    }
  }

  const neople = dispatchNeople((request) => dispatch(request, false))
  const priorityNeople = dispatchNeople((request) => dispatch(request, true))

  return {
    neople,
    priorityNeople,
    async refresh() {
      const keys = await store.readUsableKeys()
      // 남은 key는 쉬는 시각과 동시 요청 수를 그대로 이어 쓰고, 빠진 key로 나간 요청은 끝날 때까지 둔다.
      slots = new Map(keys.map((key) => [key.id, slots.get(key.id) ?? createSlot(key)]))
      wakeWaiters()
    },
    readConcurrency() {
      if (slots.size === 0) {
        return 1
      }

      return slots.size * concurrencyPerKey
    },
    drainFailures() {
      const drained = [...failures]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([reason, count]) => `${reason}=${count}`)
        .join(',')

      failures = new Map()

      return drained
    }
  }
}
