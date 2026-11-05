import { Button, shapes, TextField, TextFieldInput } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { SkeletonRow } from '../../components/table/CharacterTable'
import { ListBox } from '../../components/table/ListBox'
import { TitleBox } from '../../components/table/TitleBox'
import { useAdventureWeekly, useRefreshAdventureWeekly } from '../../hooks/useAdventureWeekly'
import { useMyAdventureStore } from '../../hooks/useMyAdventureStore'
import { WeeklyClearTable } from './WeeklyClearTable'
import { styles } from './WeeklyScreen.style'

const LOADING_ROWS = 5

export function WeeklyScreen(): React.JSX.Element {
  const adventureName = useMyAdventureStore((state) => state.adventureName)
  const changeAdventureName = useMyAdventureStore((state) => state.changeAdventureName)
  const [draft, setDraft] = useState(adventureName ?? '')
  const refreshWeekly = useRefreshAdventureWeekly()

  function handleDraftChange(event: ChangeEvent<HTMLInputElement>): void {
    setDraft(event.target.value)
  }

  function handleRefresh(): void {
    if (adventureName != null) {
      refreshWeekly(adventureName)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const next = draft.trim()
    if (next !== '') {
      changeAdventureName(next)
    }
  }

  return (
    <div {...stylex.props(styles.screen)}>
      <TitleBox title="주간 던파">
        <form onSubmit={handleSubmit} {...stylex.props(styles.form)}>
          <TextField size="sm">
            <TextFieldInput
              aria-label="내 모험단"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              onChange={handleDraftChange}
              {...stylex.props(styles.adventureInput)}
            />
          </TextField>
          <Button type="submit" variant="primary" size="sm">
            보기
          </Button>
          {adventureName != null && (
            <Button type="button" size="sm" onClick={handleRefresh}>
              새로고침
            </Button>
          )}
        </form>
      </TitleBox>
      {adventureName != null ? (
        <WeeklyClearList adventureName={adventureName} />
      ) : (
        <ListBox name="내 모험단">
          <p {...stylex.props(styles.state)}>모험단 이름을 넣어 주세요.</p>
        </ListBox>
      )}
    </div>
  )
}

function WeeklyClearList({ adventureName }: { adventureName: string }): React.JSX.Element {
  const result = useAdventureWeekly(adventureName)
  switch (result.status) {
    case 'loading':
      return (
        <ListBox name={adventureName}>
          <div aria-busy="true">
            <span role="status" {...stylex.props(shapes.srOnly)}>
              주간 던파를 받는 중입니다.
            </span>
            <WeeklyClearTable
              clearNames={[]}
              rows={[]}
              trailing={Array.from({ length: LOADING_ROWS }, (_, index) => (
                <SkeletonRow key={index} affiliations={[]} />
              ))}
            />
          </div>
        </ListBox>
      )
    case 'error':
      return (
        <ListBox name={adventureName}>
          <p role="alert" {...stylex.props(styles.state, styles.error)}>
            {result.message}
          </p>
        </ListBox>
      )
    case 'success':
      if (result.value.characters.length === 0) {
        return <ListBox name={adventureName} />
      }

      return (
        <ListBox name={adventureName}>
          <WeeklyClearTable clearNames={result.value.clearNames} rows={result.value.characters} />
        </ListBox>
      )
  }
}
