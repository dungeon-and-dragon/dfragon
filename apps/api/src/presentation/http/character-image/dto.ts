import type { AccessLogEnv } from '@dfragon/http-server'
import type { Context } from 'hono'
import {
  type CharacterIdentity,
  parseCharacterIdentity
} from '../../../domain/character-identity.js'

export function readIdentity(
  c: Context<AccessLogEnv, '/:serverId/:characterId/image'>
): CharacterIdentity {
  return parseCharacterIdentity(c.req.param('serverId'), c.req.param('characterId'))
}
