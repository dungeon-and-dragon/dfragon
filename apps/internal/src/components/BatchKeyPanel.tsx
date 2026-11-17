import { Button, Switch } from '@dfragon/ui'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { BATCH_NEOPLE_KEY_DUPLICATE, OpsRequestFailure } from '../api/ops-client'
import type { BatchKey } from '../api/ops-schemas'
import { formatCount, formatDateMinute } from '../format'
import {
  useAddBatchKey,
  useBatchKeys,
  useDeleteBatchKey,
  useSetBatchKeyEnabled
} from '../ops-queries'
import { ConfirmButton } from './ConfirmButton'
import { FIELD_INPUT, panelClasses, tableClasses, textClasses } from './panel-classes'
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
      <div className="field w-50 max-sm:w-full">
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
        className="field w-90 max-sm:w-full"
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

  function handleConfirm(close: () => void): void {
    deleteKey.mutate(batchKey.id, { onSuccess: close })
  }

  return (
    <ConfirmButton
      label="삭제"
      title={`${batchKey.label} 삭제`}
      confirmLabel="삭제"
      disabled={false}
      pending={deleteKey.isPending}
      failed={deleteKey.isError}
      popupClassName="w-60"
      onOpen={deleteKey.reset}
      onConfirm={handleConfirm}
    />
  )
}

function BatchKeyRow({ batchKey }: { batchKey: BatchKey }): React.JSX.Element {
  const { label, keySuffix, createdAt, rejectedAt } = batchKey

  return (
    <tr className={tableClasses.row}>
      <td className={`${tableClasses.cell} font-semibold`}>{label}</td>
      <td className={tableClasses.cell}>
        <span className="font-mono tabular-nums text-fg-muted">
          {KEY_MASK}
          <b className="font-medium text-fg">{keySuffix}</b>
        </span>
      </td>
      <td className={tableClasses.cell}>
        <span className={textClasses.inline}>
          <BatchKeyStatusTag status={statusOf(batchKey)} />
          {rejectedAt !== null && (
            <span className={`${textClasses.muted} ${textClasses.numeric}`}>
              {formatDateMinute(rejectedAt)}
            </span>
          )}
        </span>
      </td>
      <td className={`${tableClasses.cell} ${textClasses.muted} ${textClasses.numeric}`}>
        {formatDateMinute(createdAt)}
      </td>
      <td className={tableClasses.cell}>
        <EnabledSwitch batchKey={batchKey} />
      </td>
      <td className={tableClasses.cellEnd}>
        <DeleteBatchKeyButton batchKey={batchKey} />
      </td>
    </tr>
  )
}

function BatchKeyTable({ keys }: { keys: readonly BatchKey[] }): React.JSX.Element {
  return (
    <table className={tableClasses.table}>
      <thead>
        <tr>
          <th className={tableClasses.headCell}>이름</th>
          <th className={tableClasses.headCell}>key</th>
          <th className={tableClasses.headCell}>상태</th>
          <th className={tableClasses.headCell}>추가</th>
          <th className={tableClasses.headCell}>사용</th>
          <th className={tableClasses.headCellEnd}>
            <span className="sr-only">삭제</span>
          </th>
        </tr>
      </thead>
      <tbody className={tableClasses.body}>
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
      <h2 className={panelClasses.heading}>
        batch key
        {keys !== undefined && (
          <span className={panelClasses.headingCount}>{formatCount(keys.length)}</span>
        )}
      </h2>
      <AddBatchKeyForm />
      {keys !== undefined && keys.length === 0 && (
        <p className={panelClasses.empty}>batch key가 없습니다.</p>
      )}
      {keys !== undefined && keys.length > 0 && (
        <div className={panelClasses.scroll}>
          <BatchKeyTable keys={keys} />
        </div>
      )}
    </section>
  )
}
