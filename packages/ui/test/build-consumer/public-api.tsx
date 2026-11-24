import { createRef } from 'react'
import {
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  IconButton,
  Select,
  StatusChip,
  Switch,
  Tabs,
  TextField,
  TextFieldDescription,
  TextFieldError,
  TextFieldInput,
  TextFieldLabel,
  Tooltip
} from '@dfragon/ui'
import type {
  ButtonProps,
  IconButtonProps,
  SelectPopupProps,
  StatusChipProps,
  TextFieldDescriptionProps,
  TextFieldErrorProps,
  TextFieldInputProps,
  TextFieldLabelProps,
  TextFieldProps
} from '@dfragon/ui'

export const components = [
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  IconButton,
  StatusChip,
  Switch,
  TextField,
  TextFieldDescription,
  TextFieldError,
  TextFieldInput,
  TextFieldLabel,
  Select.Trigger,
  Tabs.List,
  Tooltip.Popup
]

export type PublicProps = {
  button: ButtonProps
  field: TextFieldProps
  fieldLabel: TextFieldLabelProps
  input: TextFieldInputProps
  fieldDescription: TextFieldDescriptionProps
  fieldError: TextFieldErrorProps
  iconButton: IconButtonProps
  selectPopup: SelectPopupProps
  statusChip: StatusChipProps
}

export const button = (
  <Button variant="primary" ref={createRef<HTMLButtonElement>()}>
    산출물 소비자
  </Button>
)
export const input = <TextFieldInput ref={createRef<HTMLInputElement>()} placeholder="입력" />
export const iconButton = (
  <IconButton
    aria-label="설정"
    ref={createRef<HTMLButtonElement>()}
    icon={<svg aria-hidden="true" />}
  />
)
export const select = (
  <Select.Root defaultValue="siroco">
    <Select.Trigger size="xs" aria-label="서버">
      <Select.Value />
    </Select.Trigger>
    <Select.Popup aria-label="서버">
      <Select.Item value="siroco">
        <Select.ItemText>시로코</Select.ItemText>
      </Select.Item>
    </Select.Popup>
  </Select.Root>
)
export const statusChip = (
  <StatusChip tone="success" role="status">
    연결됨
  </StatusChip>
)

// @ts-expect-error 공개 Button은 화면별 className override를 허용하지 않는다.
export const unsupportedAppearance = <Button className="override" />
// @ts-expect-error 내부 source는 package export가 아니다.
export type InternalSourceEntry = typeof import('@dfragon/ui/src/button')
