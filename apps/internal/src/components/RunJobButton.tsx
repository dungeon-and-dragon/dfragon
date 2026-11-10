import { Popover } from '@base-ui/react/popover'
import { Button } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { type FormEvent, useState } from 'react'
import { JOB_ALREADY_RUNNING, OpsRequestFailure } from '../api/ops-client'
import type { Job } from '../api/ops-schemas'
import { EMPTY_VALUE } from '../format'
import { useRequestRun } from '../ops-queries'
import {
  type ArgDraft,
  type ArgInput,
  argInputs,
  argsFromDraft,
  choicesOf,
  isNumberField
} from '../run-args'
import { popoverStyles, textStyles } from './panel.style'
import { styles } from './RunJobButton.style'

type RunJobButtonProps = {
  job: Job
  variant: 'primary' | 'secondary'
}

function failureMessage(error: Error | null, job: Job): string | undefined {
  if (error === null) {
    return undefined
  }

  // 거절 뒤 다시 읽은 목록에서 실행이 끝났으면 거절 문구도 지난 일이라 지운다.
  if (error instanceof OpsRequestFailure && error.code === JOB_ALREADY_RUNNING) {
    if (job.activeRun === null) {
      return undefined
    }

    return '이미 실행 중입니다.'
  }

  return '요청에 실패했습니다.'
}

function fieldNote({ field, required }: ArgInput): string {
  if (!required) {
    return '선택'
  }

  if (field.type === undefined) {
    return 'string'
  }

  return field.type
}

function ArgField({
  input,
  id,
  value,
  onChange
}: {
  input: ArgInput
  id: string
  value: string
  onChange: (name: string, value: string) => void
}): React.JSX.Element {
  const choices = choicesOf(input)

  function handleChange(event: { currentTarget: { value: string } }): void {
    onChange(input.name, event.currentTarget.value)
  }

  return (
    <div {...stylex.props(styles.field)}>
      <label htmlFor={id} {...stylex.props(styles.label)}>
        {input.name}
        <em {...stylex.props(styles.note)}>{fieldNote(input)}</em>
      </label>
      {choices !== undefined ? (
        <select id={id} value={value} onChange={handleChange} {...stylex.props(styles.input)}>
          <option value="">{EMPTY_VALUE}</option>
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={isNumberField(input) ? 'number' : 'text'}
          step={input.field.type === 'integer' ? 1 : undefined}
          value={value}
          onChange={handleChange}
          {...stylex.props(styles.input)}
        />
      )}
    </div>
  )
}

function ArgsPopover({
  job,
  inputs,
  variant,
  disabled,
  onRun
}: {
  job: Job
  inputs: readonly ArgInput[]
  variant: RunJobButtonProps['variant']
  disabled: boolean
  onRun: (args: Record<string, unknown>) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ArgDraft>({})

  function handleDraftChange(name: string, value: string): void {
    setDraft((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    onRun(argsFromDraft(inputs, draft))
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger disabled={disabled} render={<Button variant={variant} size="sm" />}>
        실행
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          {...stylex.props(popoverStyles.positioner)}
        >
          <Popover.Popup {...stylex.props(popoverStyles.popup, styles.popup)}>
            <form onSubmit={handleSubmit}>
              <Popover.Title {...stylex.props(popoverStyles.title)}>인자</Popover.Title>
              {inputs.map((input) => (
                <ArgField
                  key={input.name}
                  input={input}
                  id={`${job.name}-arg-${input.name}`}
                  value={draft[input.name] ?? ''}
                  onChange={handleDraftChange}
                />
              ))}
              <div {...stylex.props(popoverStyles.actions, styles.actions)}>
                <Popover.Close render={<Button variant="secondary" size="sm" />}>
                  취소
                </Popover.Close>
                <Button type="submit" variant="primary" size="sm">
                  실행
                </Button>
              </div>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function RunJobButton({ job, variant }: RunJobButtonProps): React.JSX.Element {
  const requestRun = useRequestRun()
  const inputs = argInputs(job)
  const disabled = job.activeRun !== null || requestRun.isPending
  const message = failureMessage(requestRun.error, job)

  function run(args: Record<string, unknown>): void {
    requestRun.mutate({ name: job.name, args })
  }

  function handleRunClick(): void {
    run({})
  }

  return (
    <span {...stylex.props(textStyles.inline)}>
      {message !== undefined && (
        <p role="alert" {...stylex.props(textStyles.error)}>
          {message}
        </p>
      )}
      {inputs.length > 0 ? (
        <ArgsPopover job={job} inputs={inputs} variant={variant} disabled={disabled} onRun={run} />
      ) : (
        <Button variant={variant} size="sm" disabled={disabled} onClick={handleRunClick}>
          실행
        </Button>
      )}
    </span>
  )
}
