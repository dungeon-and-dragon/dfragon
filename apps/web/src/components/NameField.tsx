import * as stylex from '@stylexjs/stylex'
import type { ComponentPropsWithoutRef } from 'react'
import { styles } from './NameField.style'

export type NameFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'size' | 'disabled'> & {
  vacant?: boolean
}

export function NameField({ vacant = false, ...inputProps }: NameFieldProps): React.JSX.Element {
  return <input {...inputProps} {...stylex.props(styles.name, vacant && styles.vacant)} />
}
