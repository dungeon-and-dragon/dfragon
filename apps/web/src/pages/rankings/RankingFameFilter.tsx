import { Button, TextField, TextFieldInput } from '@dfragon/ui'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import type { FameRankingFameRange } from '#core/ranking'
import { fameRangeOf } from './ranking-fame'

const FAME_INPUT = 'w-[112px]'

function textOf(fame: number | undefined): string {
  if (fame === undefined) {
    return ''
  }

  return String(fame)
}

export function RankingFameFilter({
  range,
  onChange
}: {
  range: FameRankingFameRange
  onChange: (range: FameRankingFameRange) => void
}): React.JSX.Element {
  const [from, setFrom] = useState(textOf(range.fameFrom))
  const [to, setTo] = useState(textOf(range.fameTo))
  const next = fameRangeOf(from, to)

  function handleFromChange(event: ChangeEvent<HTMLInputElement>): void {
    setFrom(event.target.value)
  }

  function handleToChange(event: ChangeEvent<HTMLInputElement>): void {
    setTo(event.target.value)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (next !== null) {
      onChange(next)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className={FAME_INPUT}>
        <TextField size="sm" invalid={next === null}>
          <TextFieldInput
            aria-label="최저 명성"
            inputMode="numeric"
            autoComplete="off"
            value={from}
            onChange={handleFromChange}
          />
        </TextField>
      </div>
      <span className="text-fg-muted">~</span>
      <div className={FAME_INPUT}>
        <TextField size="sm" invalid={next === null}>
          <TextFieldInput
            aria-label="최고 명성"
            inputMode="numeric"
            autoComplete="off"
            value={to}
            onChange={handleToChange}
          />
        </TextField>
      </div>
      <Button type="submit" variant="secondary" size="sm" disabled={next === null}>
        적용
      </Button>
    </form>
  )
}
