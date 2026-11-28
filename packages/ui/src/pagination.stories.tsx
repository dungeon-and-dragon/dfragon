import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Pagination } from './pagination'

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  args: {
    page: 1,
    pageCount: 12,
    onPageChange: () => {},
    disabled: false
  },
  argTypes: {
    page: { control: { type: 'number', min: 1 } },
    pageCount: { control: { type: 'number', min: 1 } },
    disabled: { control: 'boolean' }
  }
} satisfies Meta<typeof Pagination>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {
  render: function Render(args) {
    const [page, setPage] = useState(args.page)

    return <Pagination {...args} page={page} onPageChange={setPage} />
  }
}

export const Pages: Story = {
  render: (args) => (
    <div className="grid w-[480px] gap-6">
      <Pagination {...args} page={1} pageCount={12} />
      <Pagination {...args} page={6} pageCount={12} />
      <Pagination {...args} page={12} pageCount={12} />
      <Pagination {...args} page={2} pageCount={3} />
      <Pagination {...args} page={1} pageCount={1} />
      <Pagination {...args} page={6} pageCount={12} disabled />
    </div>
  )
}
