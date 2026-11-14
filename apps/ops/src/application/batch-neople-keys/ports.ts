import type {
  BatchNeopleKeyAddition,
  BatchNeopleKeyInput,
  BatchNeopleKeySummary
} from '@dfragon/database'

export type OpsBatchNeopleKeyStore = {
  readKeys: () => Promise<BatchNeopleKeySummary[]>
  add: (input: BatchNeopleKeyInput) => Promise<BatchNeopleKeyAddition>
  setEnabled: (id: number, enabled: boolean) => Promise<boolean>
  delete: (id: number) => Promise<boolean>
}
