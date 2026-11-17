import type { ComponentPropsWithRef, CSSProperties, ElementType } from 'react'

export type PublicProps<T extends ElementType> = Omit<
  ComponentPropsWithRef<T>,
  'style' | 'className'
>

// 공개 타입은 className, style을 받지 않지만, Base UI의 render 합성이 넘기는 className, style은
// 구현이 받아 자기 class 뒤에 합친다. 구현 함수만 이 타입을 받는다.
export type ForwardedStyle = {
  className?: string
  style?: CSSProperties
}

export function withForwardedStyle(
  own: ForwardedStyle,
  { className, style }: ForwardedStyle
): ForwardedStyle {
  const classNames = [own.className, className].filter((name) => {
    const hasName = name != null && name !== ''

    return hasName
  })
  const hasStyle = own.style != null || style != null
  const mergedClassName = classNames.length > 0 ? classNames.join(' ') : undefined
  const mergedStyle = hasStyle ? { ...own.style, ...style } : undefined

  return { className: mergedClassName, style: mergedStyle }
}
