import { useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import type { CharacterCandidate } from '@dfragon/client-core/preload/common/types/character'
import { type CharacterNameQuery, useClientHost } from './useClientHost'

export type CharacterNameSearchState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'searching' }>
  | Readonly<{ status: 'choices'; rows: readonly CharacterCandidate[] }>
  | Readonly<{ status: 'empty' }>
  | Readonly<{ status: 'error'; message: string }>

const IDLE: CharacterNameSearchState = { status: 'idle' }

export function useCharacterNameSearch(): {
  state: CharacterNameSearchState
  search: (query: CharacterNameQuery) => Promise<void>
  close: () => void
} {
  const { searchCharacters } = useClientHost()
  const navigate = useNavigate()
  const [state, setState] = useState<CharacterNameSearchState>(IDLE)
  const latest = useRef(0)

  async function search(query: CharacterNameQuery): Promise<void> {
    latest.current += 1
    const sequence = latest.current
    // 다시 검색했거나 닫은 뒤 늦게 온 응답이 지금 결과를 덮거나 화면을 옮기지 않게 한다.
    const isLatest = () => latest.current === sequence
    setState({ status: 'searching' })
    let rows: readonly CharacterCandidate[]
    try {
      rows = await searchCharacters(query)
    } catch (error) {
      if (isLatest()) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error)
        })
      }

      return
    }
    if (!isLatest()) {
      return
    }

    if (rows.length === 1) {
      setState(IDLE)
      const [{ serverId, characterId }] = rows
      await navigate({ to: '/c/$serverId/$characterId', params: { serverId, characterId } })

      return
    }
    setState(rows.length === 0 ? { status: 'empty' } : { status: 'choices', rows })
  }

  function close(): void {
    latest.current += 1
    setState(IDLE)
  }

  return { state, search, close }
}
