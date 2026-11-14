import type { BatchNeopleKeySummary } from '@dfragon/database'
import { Hono } from 'hono'
import { z } from 'zod'
import type { OpsBatchNeopleKeyStore } from '../../../application/batch-neople-keys/ports.js'
import { OpsFailure } from '../../../domain/failure.js'
import { readJsonBody } from '../json-request.js'

// batch_neople_keys.id가 int4라 9자리까지만 받는다.
const POSITIVE_INT4_DIGITS = /^[1-9]\d{0,8}$/

const keyId = z.string().regex(POSITIVE_INT4_DIGITS).transform(Number)

const trimmedText = z.string().trim().min(1)

const addBody = z.object({ label: trimmedText, key: trimmedText })

// 응답에 실을 field를 골라 key 원문이 어떤 경로로도 응답에 섞이지 않게 한다.
function keyResponse({
  id,
  label,
  keySuffix,
  enabled,
  createdAt,
  rejectedAt
}: BatchNeopleKeySummary) {
  return { id, label, keySuffix, enabled, createdAt, rejectedAt }
}

function readKeyId(value: string): number {
  const id = keyId.safeParse(value)

  if (!id.success) {
    throw new OpsFailure('request')
  }

  return id.data
}

function throwWhenMissing(found: boolean): void {
  if (!found) {
    throw new OpsFailure('batchNeopleKeyNotFound')
  }
}

export function createOpsBatchNeopleKeyRoutes(store: OpsBatchNeopleKeyStore): Hono {
  const routes = new Hono()

  routes.get('/', async (c) => {
    const keys = await store.readKeys()
    const responseKeys = keys.map(keyResponse)

    return c.json({ keys: responseKeys })
  })

  routes.post('/', async (c) => {
    const request = addBody.safeParse(await readJsonBody(c))

    if (!request.success) {
      throw new OpsFailure('request')
    }

    const addition = await store.add(request.data)

    if (addition.status === 'duplicate') {
      throw new OpsFailure('batchNeopleKeyDuplicate')
    }

    return c.json({ id: addition.id }, 201)
  })

  routes.post('/:id/enable', async (c) => {
    const id = readKeyId(c.req.param('id'))
    const found = await store.setEnabled(id, true)
    throwWhenMissing(found)

    return c.body(null, 204)
  })

  routes.post('/:id/disable', async (c) => {
    const id = readKeyId(c.req.param('id'))
    const found = await store.setEnabled(id, false)
    throwWhenMissing(found)

    return c.body(null, 204)
  })

  routes.delete('/:id', async (c) => {
    const id = readKeyId(c.req.param('id'))
    const found = await store.delete(id)
    throwWhenMissing(found)

    return c.body(null, 204)
  })

  return routes
}
