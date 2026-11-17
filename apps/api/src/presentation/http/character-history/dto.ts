import type { AccessLogEnv } from '@dfragon/http-server'
import type { Context } from 'hono'
import { z } from 'zod'
import { CharacterDetailFailure } from '../../../domain/character-failure.js'
import {
  type CharacterIdentity,
  parseCharacterIdentity
} from '../../../domain/character-identity.js'

export type HistoryContext = Context<AccessLogEnv, '/:serverId/:characterId/*'>

const snapshotQuery = z.object({ at: z.iso.datetime({ offset: true }) }).strict()

export function readIdentity(c: HistoryContext): CharacterIdentity {
  return parseCharacterIdentity(c.req.param('serverId'), c.req.param('characterId'))
}

export function parseSnapshotAt(query: unknown): Date {
  const parsed = snapshotQuery.safeParse(query)

  if (!parsed.success) {
    throw new CharacterDetailFailure('query')
  }

  return new Date(parsed.data.at)
}
