import { Button } from '@dfragon/ui'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { LAB_CURRENCY_DUPLICATE, OpsRequestFailure } from '#ops-api/ops-client'
import type { LabCurrency } from '#ops-api/ops-schemas'
import {
  useAddLabCurrency,
  useLabCurrencies,
  useLabCurrencyIconUrl,
  useUpdateLabCurrency
} from '#ops-app/ops-queries'
import { DescriptionInput, ICON_SIZE, IconInput } from './lab-fields'
import { FIELD_INPUT, panelClasses } from './panel-classes'

function failureMessage(error: Error | null): string | undefined {
  if (error === null) {
    return undefined
  }

  if (error instanceof OpsRequestFailure && error.code === LAB_CURRENCY_DUPLICATE) {
    return '같은 이름의 재화가 있습니다.'
  }

  if (error instanceof OpsRequestFailure && error.status === 400) {
    return '아이콘은 64KB 이하의 PNG, JPEG, GIF, WebP 파일이어야 합니다.'
  }

  return '저장하지 못했습니다.'
}

function AddCurrencyForm(): React.JSX.Element {
  const addCurrency = useAddLabCurrency()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<string>()
  const [formKey, setFormKey] = useState(0)
  const message = failureMessage(addCurrency.error)
  const trimmed = name.trim()

  function handleNameChange(event: ChangeEvent<HTMLInputElement>): void {
    setName(event.currentTarget.value)
    addCurrency.reset()
  }

  function handleDescriptionChange(next: string): void {
    setDescription(next)
    addCurrency.reset()
  }

  function handleIconChange(next: string | undefined): void {
    setIcon(next)
    addCurrency.reset()
  }

  function clear(): void {
    setName('')
    setDescription('')
    setIcon(undefined)
    setFormKey((key) => key + 1)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (trimmed === '' || icon === undefined) {
      return
    }

    addCurrency.mutate({ name: trimmed, description, icon }, { onSuccess: clear })
  }

  return (
    <form
      key={formKey}
      aria-label="재화 추가"
      onSubmit={handleSubmit}
      className="m-0 flex flex-wrap items-center gap-3 border-b border-line px-4 py-3"
    >
      <div className="w-[200px] shrink-0">
        <input
          type="text"
          autoComplete="off"
          aria-label="새 재화 이름"
          value={name}
          onChange={handleNameChange}
          className={`${FIELD_INPUT} field-box-sm`}
        />
      </div>
      <DescriptionInput
        label="새 재화 설명"
        value={description}
        onChange={handleDescriptionChange}
      />
      <IconInput label="새 재화 아이콘" onChange={handleIconChange} />
      <Button
        type="submit"
        size="sm"
        variant="primary"
        disabled={addCurrency.isPending || trimmed === '' || icon === undefined}
      >
        추가
      </Button>
      {message !== undefined && (
        <p role="alert" className="field-error m-0">
          {message}
        </p>
      )}
    </form>
  )
}

function CurrencyRow({ currency }: { currency: LabCurrency }): React.JSX.Element {
  const updateCurrency = useUpdateLabCurrency()
  const iconUrl = useLabCurrencyIconUrl()
  const savedDescription = currency.description ?? ''
  const [name, setName] = useState(currency.name)
  const [description, setDescription] = useState(savedDescription)
  const [icon, setIcon] = useState<string>()
  const [formKey, setFormKey] = useState(0)
  const message = failureMessage(updateCurrency.error)
  const trimmed = name.trim()
  const changed =
    trimmed !== currency.name || description.trim() !== savedDescription || icon !== undefined

  function handleNameChange(event: ChangeEvent<HTMLInputElement>): void {
    setName(event.currentTarget.value)
    updateCurrency.reset()
  }

  function handleDescriptionChange(next: string): void {
    setDescription(next)
    updateCurrency.reset()
  }

  function handleIconChange(next: string | undefined): void {
    setIcon(next)
    updateCurrency.reset()
  }

  function clearIcon(): void {
    setName(trimmed)
    setDescription(description.trim())
    setIcon(undefined)
    setFormKey((key) => key + 1)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (trimmed === '' || !changed) {
      return
    }

    updateCurrency.mutate(
      { id: currency.id, name: trimmed, description, icon },
      { onSuccess: clearIcon }
    )
  }

  return (
    <li>
      <form
        key={formKey}
        aria-label={`${currency.name} 재화`}
        onSubmit={handleSubmit}
        className="m-0 flex flex-wrap items-center gap-3"
      >
        <img
          src={iconUrl(currency.id, currency.updatedAt)}
          alt=""
          width={ICON_SIZE}
          height={ICON_SIZE}
        />
        <div className="w-[200px] shrink-0">
          <input
            type="text"
            autoComplete="off"
            aria-label={`${currency.name} 이름`}
            value={name}
            onChange={handleNameChange}
            className={`${FIELD_INPUT} field-box-sm`}
          />
        </div>
        <DescriptionInput
          label={`${currency.name} 설명`}
          value={description}
          onChange={handleDescriptionChange}
        />
        <IconInput label={`${currency.name} 아이콘`} onChange={handleIconChange} />
        <Button
          type="submit"
          size="sm"
          disabled={updateCurrency.isPending || trimmed === '' || !changed}
        >
          저장
        </Button>
        {message !== undefined && (
          <p role="alert" className="field-error m-0">
            {message}
          </p>
        )}
      </form>
    </li>
  )
}

export function LabCurrencyPanel(): React.JSX.Element {
  const currencies = useLabCurrencies()

  return (
    <section aria-label="실험실 재화" className={panelClasses.box}>
      <h2 className="section-title">실험실 재화</h2>
      <AddCurrencyForm />
      {currencies.isError && (
        <p role="alert" className="state state-error">
          재화를 읽지 못했습니다.
        </p>
      )}
      {currencies.data !== undefined && (
        <ul className="m-0 flex list-none flex-col gap-2 p-4">
          {currencies.data.currencies.map((currency) => (
            <CurrencyRow key={currency.id} currency={currency} />
          ))}
        </ul>
      )}
    </section>
  )
}
