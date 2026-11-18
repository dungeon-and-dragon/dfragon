import type { ComponentPropsWithoutRef } from 'react'

// 칸의 테두리 1px과 안쪽 여백 5px만큼 왼쪽으로 내밀어 이름 글자가 칸이 없는 글자와 같은 세로줄에 오게 한다.
const fieldClass =
  'm-0 box-border h-6 min-w-0 [font-family:inherit] flex-1 basis-0 -ml-[6px] rounded-control border border-solid px-[5px] py-0 text-sm font-semibold text-ellipsis text-fg outline-none transition-colors placeholder:font-medium placeholder:text-fg-subtle focus:border-signal focus:bg-canvas focus:shadow-[0_0_0_1px_var(--color-signal)]'

export type NameFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'size' | 'disabled'> & {
  vacant?: boolean
}

export function NameField({ vacant = false, ...inputProps }: NameFieldProps): React.JSX.Element {
  return (
    <input
      {...inputProps}
      className={`${fieldClass} ${vacant ? 'border-line-input bg-canvas' : 'border-transparent bg-transparent hover:border-line-input hover:bg-canvas'}`}
    />
  )
}
