import type { AccessLogEnv } from '@dfragon/http-server'
import type { Context } from 'hono'
import {
  type CharacterIdentity,
  parseCharacterIdentity
} from '../../../domain/character-identity.js'

export type DetailContext = Context<AccessLogEnv, '/:serverId/:characterId'>

export function readIdentity(c: DetailContext): CharacterIdentity {
  return parseCharacterIdentity(c.req.param('serverId'), c.req.param('characterId'))
}
