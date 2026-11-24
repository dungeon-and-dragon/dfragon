import { Button, ConfirmPopover, Popover, Switch } from '@dfragon/ui'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { BATCH_NEOPLE_KEY_DUPLICATE, OpsRequestFailure } from '#ops-api/ops-client'
import type { BatchKey } from '#ops-api/ops-schemas'
import { formatCount, formatDateMinute } from '#ops-app/format'
import {
  useAddBatchKey,
  useBatchKeys,
  useDeleteBatchKey,
  useSetBatchKeyEnabled
} from '#ops-app/ops-queries'
import { FIELD_INPUT, panelClasses, textClasses } from './panel-classes'
import { type BatchKeyStatus, BatchKeyStatusTag } from './RunStatusTag'

const KEY_MASK = '••••'
const LABEL_INPUT_ID = 'batch-key-label'
const KEY_INPUT_ID = 'batch-key-value'
const KEY_ERROR_ID = 'batch-key-error'

function statusOf(key: BatchKey): BatchKeyStatus {
  if (key.rejectedAt !== null) {
    return 'rejected'
  }

  if (key.enabled) {
    return 'enabled'
  }

  return 'disabled'
}

function additionFailureMessage(error: Error | null): string | undefined {
  if (error === null) {
    return undefined
  }

  if (error instanceof OpsRequestFailure && error.code === BATCH_NEOPLE_KEY_DUPLICATE) {
    return '이미 있는 key입니다.'
  }

  if (error instanceof OpsRequestFailure && error.status === 400) {
    return '이름과 key를 넣어야 합니다.'
  }

  return '요청에 실패했습니다.'
}

function AddBatchKeyForm(): React.JSX.Element {
  const addKey = useAddBatchKey()
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const message = additionFailureMessage(addKey.error)

  function handleLabelChange(event: ChangeEvent<HTMLInputElement>): void {
    setLabel(event.currentTarget.value)
    addKey.reset()
  }

  function handleKeyChange(event: ChangeEvent<HTMLInputElement>): void {
    setKey(event.currentTarget.value)
    addKey.reset()
  }

  function clearInputs(): void {
    setLabel('')
    setKey('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    addKey.mutate({ label, key }, { onSuccess: clearInputs })
  }

  return (
    <form
      aria-label="batch key 추가"
      onSubmit={handleSubmit}
      className="m-0 flex items-end gap-3 border-b border-line px-4 py-3 max-sm:flex-wrap"
    >
      <div className="field w-[200px] max-sm:w-full">
        <label htmlFor={LABEL_INPUT_ID} className="field-label">
          이름
        </label>
        <input
          id={LABEL_INPUT_ID}
          type="text"
          autoComplete="off"
          value={label}
          onChange={handleLabelChange}
          className={`${FIELD_INPUT} field-box-md`}
        />
      </div>
      <div
        className="field w-[360px] max-sm:w-full"
        data-invalid={message !== undefined ? '' : undefined}
      >
        <label htmlFor={KEY_INPUT_ID} className="field-label">
          key
        </label>
        <input
          id={KEY_INPUT_ID}
          type="password"
          autoComplete="off"
          value={key}
          aria-invalid={message !== undefined}
          aria-describedby={message !== undefined ? KEY_ERROR_ID : undefined}
          onChange={handleKeyChange}
          className={`${FIELD_INPUT} field-box-md`}
        />
        {message !== undefined && (
          <p id={KEY_ERROR_ID} role="alert" className="field-error">
            {message}
          </p>
        )}
      </div>
      <Button type="submit" variant="primary" disabled={addKey.isPending}>
        추가
      </Button>
    </form>
  )
}

function EnabledSwitch({ batchKey }: { batchKey: BatchKey }): React.JSX.Element {
  const setEnabled = useSetBatchKeyEnabled()

  function handleCheckedChange(checked: boolean): void {
    setEnabled.mutate({ id: batchKey.id, enabled: checked })
  }

  return (
    <Switch
      checked={batchKey.enabled}
      disabled={setEnabled.isPending}
      onCheckedChange={handleCheckedChange}
      aria-label={`${batchKey.label} 사용`}
    />
  )
}

function DeleteBatchKeyButton({ batchKey }: { batchKey: BatchKey }): React.JSX.Element {
  const deleteKey = useDeleteBatchKey()

  function deleteBatchKey(): Promise<unknown> {
    return deleteKey.mutateAsync(batchKey.id)
  }

  return (
    <ConfirmPopover title={`${batchKey.label} 삭제`} confirmLabel="삭제" onConfirm={deleteBatchKey}>
      <Popover.Trigger render={<Button size="sm" />}>삭제</Popover.Trigger>
    </ConfirmPopover>
  )
}

function BatchKeyRow({ batchKey }: { batchKey: BatchKey }): React.JSX.Element {
  const { label, keySuffix, createdAt, rejectedAt } = batchKey

  return (
    <tr>
      <td className="font-semibold">{label}</td>
      <td>
        <span className="num text-fg-muted">
          {KEY_MASK}
          <b className="font-medium text-fg">{keySuffix}</b>
        </span>
      </td>
      <td>
        <span className={textClasses.inline}>
          <BatchKeyStatusTag status={statusOf(batchKey)} />
          {rejectedAt !== null && (
            <span className={`${textClasses.muted} num`}>{formatDateMinute(rejectedAt)}</span>
          )}
        </span>
      </td>
      <td className={`${textClasses.muted} num`}>{formatDateMinute(createdAt)}</td>
      <td>
        <EnabledSwitch batchKey={batchKey} />
      </td>
      <td className="text-right">
        <DeleteBatchKeyButton batchKey={batchKey} />
      </td>
    </tr>
  )
}

function BatchKeyTable({ keys }: { keys: readonly BatchKey[] }): React.JSX.Element {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>이름</th>
          <th>key</th>
          <th>상태</th>
          <th>추가</th>
          <th>사용</th>
          <th className="table-num" />
        </tr>
      </thead>
      <tbody>
        {keys.map((batchKey) => (
          <BatchKeyRow key={batchKey.id} batchKey={batchKey} />
        ))}
      </tbody>
    </table>
  )
}

export function BatchKeyPanel(): React.JSX.Element {
  const batchKeys = useBatchKeys()
  const keys = batchKeys.data?.keys

  return (
    <section aria-label="batch key" className={panelClasses.box}>
      <h2 className="section-title">
        batch key
        {keys !== undefined && (
          <span className="section-title-count">{formatCount(keys.length)}</span>
        )}
      </h2>
      <AddBatchKeyForm />
      {keys !== undefined && keys.length === 0 && <p className="state">batch key가 없습니다.</p>}
      {keys !== undefined && keys.length > 0 && (
        <div className="table-scroll">
          <BatchKeyTable keys={keys} />
        </div>
      )}
    </section>
  )
}
