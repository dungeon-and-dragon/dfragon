import type { CharacterIdentity } from '../../domain/character-identity.js'
import type { FetchCharacterImage } from './ports.js'

export class CharacterImageService {
  constructor(private readonly fetchImage: FetchCharacterImage) {}

  image(identity: CharacterIdentity, signal: AbortSignal): Promise<Buffer<ArrayBuffer>> {
    return this.fetchImage(identity, signal)
  }
}
