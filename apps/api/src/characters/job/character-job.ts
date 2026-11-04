export type CharacterRole = 'dealer' | 'buffer'

export abstract class CharacterJob {
  abstract isDealer(): boolean

  role(): CharacterRole {
    if (this.isDealer()) {
      return 'dealer'
    }

    return 'buffer'
  }
}

export class DealerJob extends CharacterJob {
  isDealer(): boolean {
    return true
  }
}

export class BufferJob extends CharacterJob {
  isDealer(): boolean {
    return false
  }
}
