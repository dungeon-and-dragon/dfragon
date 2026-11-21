import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import type { WorkerEventInput } from '@dfragon/database'
import { startWorkerEventRecorder } from '../src/runtime/worker-events.js'

test('1초 동안 남긴 이벤트를 한 번에 저장하고, 남긴 이벤트가 없으면 저장하지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 })
  const batches: (readonly WorkerEventInput[])[] = []
  const recorder = startWorkerEventRecorder({
    recordEvents: async (events) => {
      batches.push(events)
    },
    onFailure: () => assert.fail('저장 실패가 보고되면 안 된다')
  })

  recorder.record('SCORE_NEOPLE_UNAVAILABLE', { unavailable: 1 })
  t.mock.timers.tick(500)
  recorder.record('BATCH_NEOPLE_KEY_READ_FAILED')
  t.mock.timers.tick(500)
  t.mock.timers.tick(1_000)

  assert.deepEqual(batches, [
    [
      { occurredAt: new Date(0), code: 'SCORE_NEOPLE_UNAVAILABLE', details: { unavailable: 1 } },
      { occurredAt: new Date(500), code: 'BATCH_NEOPLE_KEY_READ_FAILED', details: {} }
    ]
  ])
})

test('저장에 실패하면 실패를 알리고 그 묶음을 다시 넣지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 })
  const attempts: string[][] = []
  let failures = 0
  const recorder = startWorkerEventRecorder({
    recordEvents: async (events) => {
      attempts.push(events.map(({ code }) => code))
      if (attempts.length === 1) {
        throw new Error('database closed')
      }
    },
    onFailure: () => {
      failures++
    }
  })

  recorder.record('FIRST')
  t.mock.timers.tick(1_000)
  await setImmediate()
  recorder.record('SECOND')
  t.mock.timers.tick(1_000)
  await setImmediate()

  assert.equal(failures, 1)
  assert.deepEqual(attempts, [['FIRST'], ['SECOND']])
})
