import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { type ScoreEngineDiagnostic, createScoreEngine } from '../src/score/engine.js'
import type { ScoreWorkerMessage, ScoreWorkerRequest } from '../src/score/worker-protocol.js'
import { readEngineInput } from './score-fixtures.js'

const LIBRARY_PATH = '/synthetic/libdnfscore.so'
const engineResult = {
  calculator: 'equipment',
  score: 1741,
  skipped: null,
  approximate_score: null,
  approximate_source: null,
  warning: null,
  versions: { package: 'dnfscore-native 0.3.1', rules_rev: 'rev14', bundle_id: 'phase32-rev14b' },
  display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null }
}
const skippedResult = {
  ...engineResult,
  score: null,
  skipped: { kind: 'resolution', message: '판정 불가' }
}
const approximateResult = {
  ...skippedResult,
  approximate_score: 1650,
  approximate_source: 'legacy_fusion_policy_a',
  warning: '근사값, 1% 밖일 가능성 높음: 판정 불가'
}
const input = readEngineInput('dealer-blade')

/** Node worker의 메시지, 오류, 종료 이벤트만 흉내 낸다. 응답은 테스트가 정한다. */
class FakeWorker extends EventEmitter {
  readonly requests: ScoreWorkerRequest[] = []
  terminated = false

  postMessage(request: ScoreWorkerRequest): void {
    this.requests.push(request)
  }

  async terminate(): Promise<number> {
    this.terminated = true

    return 1
  }

  send(message: ScoreWorkerMessage): void {
    this.emit('message', message)
  }

  reply(text: string | null, request = this.requests.at(-1)!): void {
    this.send({ kind: 'result', id: request.id, text })
  }
}

function scoreEngine(path: string | null = LIBRARY_PATH) {
  const workers: FakeWorker[] = []
  const reports: ScoreEngineDiagnostic[] = []
  const spawned: { path: string }[] = []
  const engine = createScoreEngine({
    path,
    report: (code) => reports.push(code),
    spawn: (data) => {
      spawned.push(data)
      const worker = new FakeWorker()
      workers.push(worker)

      return worker
    }
  })

  return { engine, workers, reports, spawned }
}

function calculate(
  engine: ReturnType<typeof scoreEngine>['engine'],
  signal = new AbortController().signal
) {
  return engine.calculate(input, 'equipment', signal)
}

test('만들 때 라이브러리 경로로 worker 하나를 띄우고 모든 계산을 그 worker에 보낸다', async () => {
  const { engine, workers, reports, spawned } = scoreEngine()

  const first = calculate(engine)
  workers[0]!.reply(JSON.stringify({ ...engineResult, breakdown: { D18: 1 } }))
  const second = engine.calculate(input, 'buff', new AbortController().signal)
  workers[0]!.reply(JSON.stringify({ ...engineResult, calculator: 'buff' }))

  assert.deepEqual(await first, engineResult)
  assert.deepEqual(await second, { ...engineResult, calculator: 'buff' })
  assert.deepEqual(spawned, [{ path: LIBRARY_PATH }])
  assert.deepEqual(
    workers[0]!.requests.map(({ input, calculator }) => ({ input, calculator })),
    [
      { input, calculator: 'equipment' },
      { input, calculator: 'buff' }
    ]
  )
  assert.deepEqual(reports, [])
})

test('라이브러리 경로가 없으면 worker를 띄우지 않고 진단 없이 점수를 null로 둔다', async () => {
  const { engine, reports, spawned } = scoreEngine(null)

  assert.equal(await calculate(engine), null)
  await engine.onModuleDestroy()
  assert.deepEqual(spawned, [])
  assert.deepEqual(reports, [])
})

test('worker가 라이브러리를 열지 못하면 기다리던 계산을 비우고 다시 띄우지 않는다', async () => {
  const { engine, workers, reports, spawned } = scoreEngine()
  const pending = calculate(engine)

  workers[0]!.send({ kind: 'unavailable' })
  workers[0]!.emit('exit', 0)

  assert.equal(await pending, null)
  assert.equal(await calculate(engine), null)
  assert.equal(workers[0]!.terminated, true)
  assert.equal(spawned.length, 1)
  assert.deepEqual(reports, ['SCORE_ENGINE_UNAVAILABLE'])
})

test('worker를 띄우지 못하면 계산 실패 진단을 남기고 점수를 null로 둔다', async () => {
  const reports: ScoreEngineDiagnostic[] = []
  const engine = createScoreEngine({
    path: LIBRARY_PATH,
    report: (code) => reports.push(code),
    spawn: () => {
      throw new Error('worker failed to start')
    }
  })

  assert.equal(await calculate(engine), null)
  assert.deepEqual(reports, ['SCORE_ENGINE_FAILED'])
})

for (const [name, text] of [
  ['계산하지 못함', null],
  ['JSON이 아닌 출력', 'not json'],
  ['다른 계산기 결과', JSON.stringify({ ...engineResult, calculator: 'buff' })],
  [
    '점수와 건너뛰기 사유가 함께 있음',
    JSON.stringify({ ...engineResult, skipped: { kind: 'x', message: 'y' } })
  ],
  ['점수도 사유도 없음', JSON.stringify({ ...engineResult, score: null })],
  ['소수 점수', JSON.stringify({ ...engineResult, score: 1741.5 })],
  [
    '점수와 근사값이 함께 있음',
    JSON.stringify({ ...approximateResult, score: 1741, skipped: null })
  ],
  [
    '근사값만 있고 출처와 경고가 없음',
    JSON.stringify({ ...skippedResult, approximate_score: 1650 })
  ],
  ['출처만 있고 근사값이 없음', JSON.stringify({ ...approximateResult, approximate_score: null })],
  ['근사값과 출처만 있고 경고가 없음', JSON.stringify({ ...approximateResult, warning: null })],
  [
    '건너뛴 결과에 근사값 없이 경고만 있음',
    JSON.stringify({ ...skippedResult, warning: '아바타 레코드 없음' })
  ],
  [
    '빈 버전 칸',
    JSON.stringify({ ...engineResult, versions: { ...engineResult.versions, rules_rev: '' } })
  ],
  [
    '알 수 없는 표시 역할',
    JSON.stringify({ ...engineResult, display: { ...engineResult.display, role: 'x' } })
  ]
] as const) {
  test(`${name}이면 점수 없이 계산 실패 진단을 남기고 worker는 계속 쓴다`, async () => {
    const { engine, workers, reports } = scoreEngine()

    const result = calculate(engine)
    workers[0]!.reply(text)

    assert.equal(await result, null)
    assert.deepEqual(reports, ['SCORE_ENGINE_FAILED'])
    const next = calculate(engine)
    workers[0]!.reply(JSON.stringify(engineResult))
    assert.deepEqual(await next, engineResult)
  })
}

for (const [name, expected] of [
  ['근사값이 없는 건너뛴 결과', skippedResult],
  ['건너뛴 결과에 엔진이 더한 근사값, 출처, 경고', approximateResult],
  [
    '정확한 점수에 붙은 경고',
    { ...engineResult, warning: '버프 효과에 닿지 않는 부위의 아바타가 번들에 없음' }
  ]
] as const) {
  test(`${name}는 그대로 돌려준다`, async () => {
    const { engine, workers, reports } = scoreEngine()

    const result = calculate(engine)
    workers[0]!.reply(JSON.stringify(expected))

    assert.deepEqual(await result, expected)
    assert.deepEqual(reports, [])
  })
}

test('근사값 칸을 보내지 않는 rev14 이전 엔진의 결과는 근사값 없이 받는다', async () => {
  const { approximate_score, approximate_source, warning, ...rev12 } = {
    ...skippedResult,
    versions: { package: '0.1.0', rules_rev: 'rev12', bundle_id: 'phase31-rev12' }
  }
  const { engine, workers } = scoreEngine()

  const result = calculate(engine)
  workers[0]!.reply(JSON.stringify(rev12))

  assert.deepEqual(await result, {
    ...rev12,
    approximate_score: null,
    approximate_source: null,
    warning: null
  })
})

for (const [name, stop] of [
  ['오류로 끝남', (worker: FakeWorker) => worker.emit('error', new Error('worker failed'))],
  ['예고 없이 종료됨', (worker: FakeWorker) => worker.emit('exit', 1)]
] as const) {
  test(`worker가 ${name}이면 기다리던 점수를 비우고 늦은 응답은 버리며 다시 띄우지 않는다`, async () => {
    const { engine, workers, reports, spawned } = scoreEngine()
    const pending = calculate(engine)

    stop(workers[0]!)
    workers[0]!.emit('exit', 1)

    assert.equal(await pending, null)
    assert.equal(workers[0]!.terminated, true)
    workers[0]!.reply(JSON.stringify(engineResult))
    assert.equal(await calculate(engine), null)
    assert.equal(spawned.length, 1)
    assert.deepEqual(reports, ['SCORE_ENGINE_FAILED'])
  })
}

test('취소된 계산은 응답을 기다리지 않고 취소 이유로 끝나며 늦은 응답은 버린다', async () => {
  const { engine, workers, reports } = scoreEngine()
  const controller = new AbortController()
  const cancelled = calculate(engine, controller.signal)
  const request = workers[0]!.requests[0]

  controller.abort(new Error('cancelled'))

  await assert.rejects(cancelled, { message: 'cancelled' })
  workers[0]!.reply('not json', request)
  const next = calculate(engine)
  workers[0]!.reply(JSON.stringify(engineResult))
  assert.deepEqual(await next, engineResult)
  assert.equal(workers[0]!.terminated, false)
  assert.deepEqual(reports, [])
})

test('이미 취소된 신호로 계산하면 worker에 보내지 않고 취소 이유로 끝난다', async () => {
  const { engine, workers } = scoreEngine()

  await assert.rejects(calculate(engine, AbortSignal.abort(new Error('gone'))), {
    message: 'gone'
  })
  assert.deepEqual(workers[0]!.requests, [])
})

test('module을 닫으면 worker를 끝내고 기다리던 점수를 비운 뒤 진단 없이 null로 둔다', async () => {
  const { engine, workers, reports, spawned } = scoreEngine()
  const pending = calculate(engine)

  await engine.onModuleDestroy()
  workers[0]!.emit('exit', 1)

  assert.equal(await pending, null)
  assert.equal(await calculate(engine), null)
  assert.equal(workers[0]!.terminated, true)
  assert.equal(spawned.length, 1)
  assert.deepEqual(reports, [])
})
