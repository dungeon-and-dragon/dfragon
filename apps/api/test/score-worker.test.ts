import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { type ScoreEngineDiagnostic, createScoreEngine } from '../src/score/engine.js'
import { openNativeScore, type ScoreLibrary } from '../src/score/native.js'
import { SCORE_WARMUP_INPUT } from '../src/score/warmup-input.js'
import { serveScoreRequests } from '../src/score/worker.js'
import type { ScoreWorkerMessage, ScoreWorkerRequest } from '../src/score/worker-protocol.js'
import { REAL_SCORE_LIBRARY_PATH, apiEngineInput, readEngineInput } from './score-fixtures.js'

const LIBRARY_PATH = '/synthetic/libdnfscore.so'
const NATIVE_OUTPUT = { native: 'output' }
const ENGINE_OUTPUT = JSON.stringify({ calculator: 'equipment', score: 1741 })

type NativeBehavior = Readonly<{
  version?: unknown
  status?: number
  output?: string | null
  throwOnScore?: boolean
  missing?: string
}>

/** koffi가 돌려주는 함수만 흉내 내어 네이티브 호출 인자와 해제를 기록한다. */
function nativeEngine(behavior: NativeBehavior = {}) {
  const { version = '0.1.0', status = 0, throwOnScore = false } = behavior
  const output = behavior.output === undefined ? ENGINE_OUTPUT : behavior.output
  const scoreCalls: unknown[][] = []
  const freed: unknown[] = []
  const library: ScoreLibrary = {
    func(definition) {
      if (behavior.missing !== undefined && definition.includes(behavior.missing)) {
        throw new Error(`symbol not found in ${LIBRARY_PATH}`)
      }

      if (definition.includes('dnfscore_version')) {
        return () => version
      }

      if (definition.includes('dnfscore_score')) {
        return (...args) => {
          scoreCalls.push(args)
          // koffi는 인자 변환에 실패하면 C 함수를 부르기 전에 던지므로 출력이 할당되지 않는다.
          if (throwOnScore) {
            throw new TypeError('native argument conversion failed')
          }
          const out = args[3] as unknown[]
          out[0] = output === null ? null : NATIVE_OUTPUT

          return status
        }
      }

      return (pointer) => {
        freed.push(pointer)
      }
    }
  }
  const decode = (pointer: unknown): string => {
    assert.equal(pointer, NATIVE_OUTPUT)
    if (output === null) {
      throw new Error('decode called without native output')
    }

    return output
  }

  return { scoreCalls, freed, options: { path: LIBRARY_PATH, load: () => library, decode } }
}

for (const [name, behavior] of [
  ['함수 누락', { missing: 'dnfscore_free' }],
  ['빈 버전', { version: ' ' }],
  ['문자열이 아닌 버전', { version: null }]
] as const) {
  test(`라이브러리에 ${name}이면 null을 돌려준다`, () => {
    assert.equal(openNativeScore(nativeEngine(behavior).options), null)
  })
}

test('라이브러리 파일을 열 수 없으면 원문 오류 없이 null을 돌려준다', () => {
  const load = (): ScoreLibrary => {
    throw new Error(`cannot open ${LIBRARY_PATH}`)
  }

  assert.equal(openNativeScore({ path: LIBRARY_PATH, load }), null)
})

test('입력 문서를 UTF-8 길이와 함께 넘기고 결과 원문을 돌려준 뒤 출력을 엔진으로 해제한다', () => {
  const input = readEngineInput('dealer-blade')
  const native = nativeEngine()
  const score = openNativeScore(native.options)!

  assert.equal(score(input, 'equipment'), ENGINE_OUTPUT)
  const [json, length, calculator] = native.scoreCalls[0]!
  assert.deepEqual(JSON.parse(json as string), input)
  assert.equal(length, Buffer.byteLength(json as string, 'utf8'))
  assert.equal(calculator, 'equipment')
  assert.deepEqual(native.freed, [NATIVE_OUTPUT])
})

for (const [name, behavior, allocated] of [
  ['0이 아닌 반환값', { status: 2 }, true],
  ['출력 없음', { output: null }, false],
  ['네이티브 호출 예외', { throwOnScore: true }, false]
] as const) {
  test(`${name}이면 null을 돌려주고 받은 출력은 해제한다`, () => {
    const native = nativeEngine(behavior)
    const score = openNativeScore(native.options)!

    assert.equal(score(readEngineInput('dealer-blade'), 'equipment'), null)
    assert.deepEqual(native.freed, allocated ? [NATIVE_OUTPUT] : [])
  })
}

/** worker thread의 port만 흉내 내어 worker가 보낸 메시지를 기록한다. */
function fakePort() {
  const posted: ScoreWorkerMessage[] = []
  const port = Object.assign(new EventEmitter(), {
    postMessage: (message: ScoreWorkerMessage) => posted.push(message)
  })

  return { port, posted }
}

test('worker는 요청을 계산하기 전에 같은 thread에서 두 계산기를 준비 입력으로 한 번씩 부른다', () => {
  const calls: unknown[][] = []
  const { port, posted } = fakePort()
  const input = readEngineInput('dealer-blade')

  serveScoreRequests(port, (scoreInput, calculator) => {
    calls.push([scoreInput, calculator])

    return '{"score":1}'
  })
  port.emit('message', { id: 7, input, calculator: 'equipment' } satisfies ScoreWorkerRequest)

  assert.deepEqual(calls, [
    [SCORE_WARMUP_INPUT, 'equipment'],
    [SCORE_WARMUP_INPUT, 'buff'],
    [input, 'equipment']
  ])
  assert.deepEqual(posted, [{ kind: 'result', id: 7, text: '{"score":1}' }])
})

test('worker는 라이브러리를 열지 못하면 준비 없이 unavailable만 알린다', () => {
  const { port, posted } = fakePort()

  serveScoreRequests(port, null)

  assert.deepEqual(posted, [{ kind: 'unavailable' }])
  assert.equal(port.listenerCount('message'), 0)
})

test('실제 worker가 라이브러리를 열지 못하면 점수를 null로 두고 엔진 없음 진단을 남긴다', async () => {
  const reports: ScoreEngineDiagnostic[] = []
  const engine = createScoreEngine({
    path: '/synthetic/missing/libdnfscore.so',
    report: (code) => reports.push(code)
  })
  try {
    const result = await engine.calculate(
      readEngineInput('dealer-blade'),
      'equipment',
      AbortSignal.timeout(10_000)
    )

    assert.equal(result, null)
    assert.deepEqual(reports, ['SCORE_ENGINE_UNAVAILABLE'])
  } finally {
    await engine.onModuleDestroy()
  }
})

const realLibrary = { skip: REAL_SCORE_LIBRARY_PATH === null && '점수 엔진 submodule이 없음' }

test('실제 엔진은 준비 입력을 두 계산기 모두 오류 없이 계산한다', realLibrary, () => {
  const score = openNativeScore({ path: REAL_SCORE_LIBRARY_PATH! })!

  for (const calculator of ['equipment', 'buff'] as const) {
    const text = score(SCORE_WARMUP_INPUT, calculator)

    assert.notEqual(text, null, calculator)
    assert.equal(JSON.parse(text!).calculator, calculator)
  }
})

test(
  '실제 엔진 worker는 API 입력 변환을 거친 딜러와 버퍼 점수를 golden 입력과 같게 계산한다',
  realLibrary,
  async () => {
    const reports: ScoreEngineDiagnostic[] = []
    const engine = createScoreEngine({
      path: REAL_SCORE_LIBRARY_PATH,
      report: (code) => reports.push(code)
    })
    try {
      const signal = AbortSignal.timeout(30_000)
      for (const [name, calculator, role] of [
        ['dealer-blade', 'equipment', 'dealer'],
        ['buffer-muse', 'buff', 'buffer']
      ] as const) {
        const golden = await engine.calculate(readEngineInput(name), calculator, signal)
        const converted = await engine.calculate(apiEngineInput(name), calculator, signal)

        assert.equal(golden?.display.role, role, name)
        assert.equal(Number.isInteger(golden?.score), true, name)
        assert.deepEqual(converted, golden, name)
      }
      assert.deepEqual(reports, [])
    } finally {
      await engine.onModuleDestroy()
    }
  }
)
