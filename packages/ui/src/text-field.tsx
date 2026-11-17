import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { createContext, useContext, type ComponentType, type ReactNode, type Ref } from 'react'
import { type ForwardedStyle, type PublicProps, withForwardedStyle } from './public-props'

type TextFieldSize = 'sm' | 'md' | 'lg'

type TextFieldState = { invalid: boolean; size: TextFieldSize }

const TextFieldStateContext = createContext<TextFieldState>({
  invalid: false,
  size: 'md'
})

export type TextFieldProps = {
  invalid?: boolean
  disabled?: boolean
  name?: string
  size?: TextFieldSize
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}

export function TextField({
  invalid = false,
  disabled = false,
  name,
  size = 'md',
  children,
  ref
}: TextFieldProps) {
  return (
    <Field.Root ref={ref} name={name} invalid={invalid} disabled={disabled} className="field">
      <TextFieldStateContext value={{ invalid, size }}>{children}</TextFieldStateContext>
    </Field.Root>
  )
}

export type TextFieldLabelProps = PublicProps<typeof Field.Label>

function TextFieldLabelImpl({ className, style, ...props }: TextFieldLabelProps & ForwardedStyle) {
  return (
    <Field.Label
      {...props}
      {...withForwardedStyle({ className: 'field-label' }, { className, style })}
    />
  )
}

export const TextFieldLabel: ComponentType<TextFieldLabelProps> = TextFieldLabelImpl

export type TextFieldInputProps = Omit<PublicProps<typeof Input>, 'ref'> & {
  ref?: Ref<HTMLInputElement>
}

function TextFieldInputImpl({
  className,
  style,
  ...inputProps
}: TextFieldInputProps & ForwardedStyle) {
  const { size } = useContext(TextFieldStateContext)

  return (
    <div className={`field-box field-box-${size}`}>
      <Input
        {...inputProps}
        {...withForwardedStyle({ className: 'field-input' }, { className, style })}
      />
    </div>
  )
}

export const TextFieldInput: ComponentType<TextFieldInputProps> = TextFieldInputImpl

export type TextFieldDescriptionProps = PublicProps<typeof Field.Description>

function TextFieldDescriptionImpl({
  className,
  style,
  ...props
}: TextFieldDescriptionProps & ForwardedStyle) {
  return (
    <Field.Description
      {...props}
      {...withForwardedStyle({ className: 'field-description' }, { className, style })}
    />
  )
}

export const TextFieldDescription: ComponentType<TextFieldDescriptionProps> =
  TextFieldDescriptionImpl

export type TextFieldErrorProps = Omit<PublicProps<typeof Field.Error>, 'match'>

function TextFieldErrorImpl({ className, style, ...props }: TextFieldErrorProps & ForwardedStyle) {
  const { invalid } = useContext(TextFieldStateContext)
  if (!invalid) {
    return null
  }

  return (
    <Field.Error
      match
      {...props}
      {...withForwardedStyle({ className: 'field-error' }, { className, style })}
    />
  )
}

export const TextFieldError: ComponentType<TextFieldErrorProps> = TextFieldErrorImpl
