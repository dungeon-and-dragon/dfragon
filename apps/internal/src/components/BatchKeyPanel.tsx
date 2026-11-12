import { Button, shapes, Switch } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
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
import { styles } from './BatchKeyPanel.style'
import { ConfirmButton } from './ConfirmButton'
import { panelStyles, tableStyles, textStyles } from './panel.style'
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
    <form aria-label="batch key 추가" onSubmit={handleSubmit} {...stylex.props(styles.addRow)}>
      <div {...stylex.props(styles.field, styles.labelField)}>
        <label htmlFor={LABEL_INPUT_ID} {...stylex.props(styles.label)}>
          이름
        </label>
        <input
          id={LABEL_INPUT_ID}
          type="text"
          autoComplete="off"
          value={label}
          onChange={handleLabelChange}
          {...stylex.props(styles.input)}
        />
      </div>
      <div {...stylex.props(styles.field, styles.keyField)}>
        <label htmlFor={KEY_INPUT_ID} {...stylex.props(styles.label)}>
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
          {...stylex.props(styles.input, message !== undefined && styles.invalidInput)}
        />
        {message !== undefined && (
          <p id={KEY_ERROR_ID} role="alert" {...stylex.props(textStyles.error, styles.error)}>
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
      popupStyle={styles.popup}
      onOpen={deleteKey.reset}
      onConfirm={handleConfirm}
    />
  )
}

function BatchKeyRow({ batchKey }: { batchKey: BatchKey }): React.JSX.Element {
  const { label, keySuffix, createdAt, rejectedAt } = batchKey

  return (
    <tr {...stylex.props(tableStyles.row)}>
      <td {...stylex.props(tableStyles.cell, styles.name)}>{label}</td>
      <td {...stylex.props(tableStyles.cell)}>
        <span {...stylex.props(styles.mask)}>
          {KEY_MASK}
          <b {...stylex.props(styles.suffix)}>{keySuffix}</b>
        </span>
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        <span {...stylex.props(styles.status)}>
          <BatchKeyStatusTag status={statusOf(batchKey)} />
          {rejectedAt !== null && (
            <span {...stylex.props(textStyles.muted, textStyles.numeric)}>
              {formatDateMinute(rejectedAt)}
            </span>
          )}
        </span>
      </td>
      <td {...stylex.props(tableStyles.cell, textStyles.muted, tableStyles.numeric)}>
        {formatDateMinute(createdAt)}
      </td>
      <td {...stylex.props(tableStyles.cell)}>
        <EnabledSwitch batchKey={batchKey} />
      </td>
      <td {...stylex.props(tableStyles.cell, tableStyles.end)}>
        <DeleteBatchKeyButton batchKey={batchKey} />
      </td>
    </tr>
  )
}

function BatchKeyTable({ keys }: { keys: readonly BatchKey[] }): React.JSX.Element {
  return (
    <table {...stylex.props(tableStyles.table)}>
      <thead>
        <tr>
          <th {...stylex.props(tableStyles.headerCell)}>이름</th>
          <th {...stylex.props(tableStyles.headerCell)}>key</th>
          <th {...stylex.props(tableStyles.headerCell)}>상태</th>
          <th {...stylex.props(tableStyles.headerCell)}>추가</th>
          <th {...stylex.props(tableStyles.headerCell)}>사용</th>
          <th {...stylex.props(tableStyles.headerCell, tableStyles.end)}>
            <span {...stylex.props(shapes.srOnly)}>삭제</span>
          </th>
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
    <section aria-label="batch key" {...stylex.props(panelStyles.box)}>
      <h2 {...stylex.props(panelStyles.heading)}>
        batch key
        {keys !== undefined && (
          <span {...stylex.props(panelStyles.headingCount)}>{formatCount(keys.length)}</span>
        )}
      </h2>
      <AddBatchKeyForm />
      {keys !== undefined && keys.length === 0 && (
        <p {...stylex.props(panelStyles.empty)}>batch key가 없습니다.</p>
      )}
      {keys !== undefined && keys.length > 0 && <BatchKeyTable keys={keys} />}
    </section>
  )
}
