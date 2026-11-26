import { type ChangeEvent } from 'react'
import { FIELD_INPUT } from './panel-classes'

const ICON_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'
export const ICON_SIZE = 28
// 운영 app이 받는 설명 길이 상한과 같다.
const DESCRIPTION_MAX_LENGTH = 500

async function readIconBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')

  return btoa(binary)
}

export function IconInput({
  label,
  onChange
}: {
  label: string
  onChange: (icon: string | undefined) => void
}): React.JSX.Element {
  async function handleChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0]

    if (file === undefined) {
      onChange(undefined)

      return
    }

    onChange(await readIconBase64(file))
  }

  return (
    <input
      type="file"
      accept={ICON_ACCEPT}
      aria-label={label}
      onChange={handleChange}
      className="min-w-0 text-xs"
    />
  )
}

export function DescriptionInput({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onChange(event.currentTarget.value)
  }

  return (
    <div className="w-[320px] shrink-0">
      <textarea
        aria-label={label}
        rows={2}
        maxLength={DESCRIPTION_MAX_LENGTH}
        value={value}
        onChange={handleChange}
        className={`${FIELD_INPUT} field-box-sm resize-y`}
      />
    </div>
  )
}
