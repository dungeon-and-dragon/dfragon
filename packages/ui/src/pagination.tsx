import { Button } from './button'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

export type PaginationProps = {
  page: number
  onPrevious: () => void
  onNext: () => void
  previousDisabled?: boolean
  nextDisabled?: boolean
  'aria-label'?: string
}

export function Pagination({
  page,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  'aria-label': label = '페이지'
}: PaginationProps): React.JSX.Element {
  return (
    <nav aria-label={label} className="pagination">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={previousDisabled}
        onClick={onPrevious}
      >
        <ChevronLeftIcon className="size-icon-sm" />
        이전
      </Button>
      <span aria-current="page" className="pagination-page num">
        {page}
      </span>
      <Button type="button" variant="ghost" size="sm" disabled={nextDisabled} onClick={onNext}>
        다음
        <ChevronRightIcon className="size-icon-sm" />
      </Button>
    </nav>
  )
}
