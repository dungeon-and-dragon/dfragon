export type CharacterRole = 'dealer' | 'buffer' | 'synergy'

export abstract class Character {
  abstract role(): CharacterRole
}

export class DealerCharacter extends Character {
  role(): CharacterRole {
    return 'dealer'
  }
}

export class BufferCharacter extends Character {
  role(): CharacterRole {
    return 'buffer'
  }
}
