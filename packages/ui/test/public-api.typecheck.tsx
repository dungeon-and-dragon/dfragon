import { createRef, type ChangeEvent, type MouseEvent, type Ref } from 'react'
import { expectTypeOf } from 'vitest'
import {
  Button,
  Chip,
  ChipGroup,
  IconButton,
  NumberField,
  Popover,
  Select,
  StatusChip,
  Switch,
  Tabs,
  TextField,
  TextFieldDescription,
  TextFieldError,
  TextFieldInput,
  TextFieldLabel,
  Tooltip,
  type ButtonProps,
  type ChipGroupProps,
  type ChipProps,
  type IconButtonProps,
  type NumberFieldProps,
  type PopoverPopupProps,
  type PopoverTitleProps,
  type SelectItemProps,
  type SelectPopupProps,
  type SelectTriggerProps,
  type StatusChipProps,
  type StatusChipTone,
  type SwitchProps,
  type TabsListProps,
  type TabsTabProps,
  type TextFieldDescriptionProps,
  type TextFieldErrorProps,
  type TextFieldInputProps,
  type TextFieldLabelProps,
  type TextFieldProps,
  type TooltipPopupProps
} from '@dfragon/ui'

type PublicPropKeys =
  | keyof ButtonProps
  | keyof IconButtonProps
  | keyof NumberFieldProps
  | keyof TextFieldProps
  | keyof TextFieldLabelProps
  | keyof TextFieldInputProps
  | keyof TextFieldDescriptionProps
  | keyof TextFieldErrorProps
  | keyof SelectTriggerProps
  | keyof SelectPopupProps
  | keyof SelectItemProps
  | keyof TabsListProps
  | keyof TabsTabProps
  | keyof SwitchProps
  | keyof ChipProps
  | keyof ChipGroupProps<string>
  | keyof TooltipPopupProps
  | keyof PopoverPopupProps
  | keyof PopoverTitleProps
  | keyof StatusChipProps

expectTypeOf<Extract<PublicPropKeys, 'style' | 'className'>>().toEqualTypeOf<never>()
expectTypeOf<ButtonProps['ref']>().toEqualTypeOf<Ref<HTMLButtonElement> | undefined>()
expectTypeOf<ButtonProps['variant']>().toEqualTypeOf<
  'primary' | 'secondary' | 'ghost' | 'danger' | undefined
>()
expectTypeOf<ButtonProps['size']>().toEqualTypeOf<'sm' | 'md' | 'lg' | undefined>()
expectTypeOf<IconButtonProps['ref']>().toEqualTypeOf<Ref<HTMLButtonElement> | undefined>()
expectTypeOf<IconButtonProps['size']>().toEqualTypeOf<'sm' | 'md' | 'lg' | undefined>()
expectTypeOf<TextFieldProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>()
expectTypeOf<TextFieldProps['size']>().toEqualTypeOf<'sm' | 'md' | 'lg' | undefined>()
expectTypeOf<TextFieldErrorProps>().not.toHaveProperty('match')
expectTypeOf<TextFieldInputProps['ref']>().toEqualTypeOf<Ref<HTMLInputElement> | undefined>()
expectTypeOf<StatusChipTone>().toEqualTypeOf<
  'neutral' | 'success' | 'danger' | 'warning' | 'signal'
>()
expectTypeOf<NumberFieldProps['onValueChange']>().toEqualTypeOf<(value: number) => void>()
expectTypeOf<NumberFieldProps['aria-label']>().toEqualTypeOf<string>()
expectTypeOf<StatusChipProps['busy']>().toEqualTypeOf<boolean | undefined>()
expectTypeOf<StatusChipProps['size']>().toEqualTypeOf<'sm' | 'md' | undefined>()

const buttonRef = createRef<HTMLButtonElement>()
const inputRef = createRef<HTMLInputElement>()
const divRef = createRef<HTMLDivElement>()

export const componentExamples = (
  <>
    <Button
      ref={buttonRef}
      type="button"
      variant="primary"
      size="lg"
      loading
      disabled
      aria-label="작업 실행"
      onClick={(event) => {
        expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLButtonElement>>()
      }}
    >
      실행
    </Button>
    <TextField ref={divRef} invalid size="lg">
      <TextFieldLabel>표시 이름</TextFieldLabel>
      <TextFieldInput
        ref={inputRef}
        name="displayName"
        placeholder="이름 입력"
        autoComplete="off"
        required
        readOnly
        value="예시"
        onValueChange={(value) => {
          expectTypeOf(value).toEqualTypeOf<string>()
        }}
        onChange={(event) => {
          expectTypeOf(event).toExtend<ChangeEvent<HTMLInputElement>>()
        }}
      />
      <TextFieldDescription>예시 이름입니다.</TextFieldDescription>
      <TextFieldError>이름을 입력하세요.</TextFieldError>
    </TextField>
    <NumberField
      aria-label="무기 수치"
      value={12}
      min={0}
      max={20}
      disabled
      format={{ signDisplay: 'always' }}
      decrementLabel="무기 수치 내리기"
      incrementLabel="무기 수치 올리기"
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<number>()
      }}
    />
  </>
)

export const designExamples = (
  <>
    <IconButton
      ref={buttonRef}
      size="sm"
      aria-label="설정"
      aria-haspopup="dialog"
      icon={<svg aria-hidden="true" />}
      disabled
      onClick={(event) => {
        expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLButtonElement>>()
      }}
    />
    <StatusChip tone="signal" role="status" busy>
      인식 중
    </StatusChip>
    <StatusChip tone="success" size="md">
      창 감지됨
    </StatusChip>
  </>
)

export const behaviorExamples = (
  <>
    <Select.Root
      value="siroco"
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<string | null>()
      }}
    >
      <Select.Trigger size="xs" aria-label="서버">
        <Select.Value placeholder="서버" />
      </Select.Trigger>
      <Select.Popup aria-label="서버 목록" container={divRef}>
        <Select.Group>
          <Select.GroupLabel>서버</Select.GroupLabel>
          <Select.Item value="siroco">
            <Select.ItemText>시로코</Select.ItemText>
          </Select.Item>
        </Select.Group>
        <Select.Separator />
      </Select.Popup>
    </Select.Root>
    <Tabs.Root defaultValue="collection">
      <Tabs.List aria-label="도구">
        <Tabs.Tab value="collection">수집</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="collection">수집 패널</Tabs.Panel>
    </Tabs.Root>
    <Switch aria-label="자동 캡처" defaultChecked />
    <Chip defaultPressed>원본</Chip>
    <ChipGroup
      aria-label="기간"
      items={[{ value: 'half', label: '반년' }]}
      value="half"
      size="md"
      onValueChange={(value) => {
        expectTypeOf(value).toEqualTypeOf<'half'>()
      }}
    />
    <Popover.Root>
      <Popover.Trigger render={<Button size="sm" />}>열기</Popover.Trigger>
      <Popover.Popup side="bottom" align="end" initialFocus={false}>
        <Popover.Title>제목</Popover.Title>
        <Popover.Close render={<Button size="sm" />}>닫기</Popover.Close>
      </Popover.Popup>
    </Popover.Root>
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger render={<IconButton aria-label="도움말" icon={<svg />} />} />
        <Tooltip.Popup>설명</Tooltip.Popup>
      </Tooltip.Root>
    </Tooltip.Provider>
  </>
)

export const invalidDesignExamples = (
  <>
    {/* @ts-expect-error 아이콘만 보이는 IconButton은 접근 가능한 이름을 요구한다. */}
    <IconButton icon={<svg aria-hidden="true" />} />
    {/* @ts-expect-error IconButton의 임의 className은 공개 prop이 아니다. */}
    <IconButton className="square" aria-label="설정" icon={<svg />} />
    {/* @ts-expect-error StatusChip tone은 디자인 상태 tone 중 하나여야 한다. 대기 톤은 주의 톤으로 바뀌었다. */}
    <StatusChip tone="waiting">상태</StatusChip>
    {/* @ts-expect-error IconButton은 외형 variant를 받지 않는다. */}
    <IconButton variant="ghost" aria-label="설정" icon={<svg />} />
    {/* @ts-expect-error ChipGroup 크기는 sm, md 중 하나다. */}
    <ChipGroup items={[]} value="" size="lg" onValueChange={() => undefined} />
    {/* @ts-expect-error Select trigger 크기는 2xs, xs, sm, md 중 하나다. */}
    <Select.Trigger size="lg" />
  </>
)

export const invalidComponentExamples = (
  <>
    {/* @ts-expect-error Button의 임의 inline style은 공개 prop이 아니다. */}
    <Button style={{ padding: 8 }}>실행</Button>
    {/* @ts-expect-error Button variant는 디자인 변형 중 하나여야 한다. */}
    <Button variant="brandSolid">실행</Button>
    {/* @ts-expect-error TextField의 임의 className은 공개 prop이 아니다. */}
    <TextField className="field">{null}</TextField>
    {/* @ts-expect-error TextField는 children을 요구한다. */}
    <TextField invalid />
    {/* @ts-expect-error TextField는 라벨을 prop이 아니라 TextFieldLabel로 받는다. */}
    <TextField label="이름">{null}</TextField>
    {/* @ts-expect-error TextField 크기는 sm, md, lg 중 하나다. */}
    <TextField size="medium">{null}</TextField>
    {/* @ts-expect-error TextFieldInput은 자식 요소 합성에 render를 쓴다. */}
    <TextFieldInput asChild />
    {/* @ts-expect-error TextFieldInput의 ref는 input element를 가리킨다. */}
    <TextFieldInput ref={buttonRef} />
  </>
)
