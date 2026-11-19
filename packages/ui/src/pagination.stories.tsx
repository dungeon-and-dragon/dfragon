import type { Meta, StoryObj } from '@storybook/react-vite'
import { Pagination } from './pagination'

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  args: {
    page: 1,
    onPrevious: () => {},
    onNext: () => {},
    previousDisabled: true,
    nextDisabled: false
  },
  argTypes: {
    page: { control: { type: 'number', min: 1 } },
    previousDisabled: { control: 'boolean' },
    nextDisabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Pagination>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Pages: Story = {
  render: (args) => (
    <div className="grid w-[480px] gap-6">
      <Pagination {...args} page={1} previousDisabled nextDisabled={false} />
      <Pagination {...args} page={3} previousDisabled={false} nextDisabled={false} />
      <Pagination {...args} page={7} previousDisabled={false} nextDisabled />
      <Pagination {...args} page={1} previousDisabled nextDisabled />
    </div>
  )
}
