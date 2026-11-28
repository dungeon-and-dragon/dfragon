import { Button } from './button'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

const VISIBLE_PAGES = 5

export type PaginationProps = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  disabled?: boolean
  'aria-label'?: string
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  disabled = false,
  'aria-label': label = '페이지'
}: PaginationProps): React.JSX.Element {
  function showPrevious(): void {
    onPageChange(page - 1)
  }

  function showNext(): void {
    onPageChange(page + 1)
  }

  function showClickedPage(event: React.MouseEvent<HTMLButtonElement>): void {
    onPageChange(Number(event.currentTarget.value))
  }

  return (
    <nav aria-label={label} className="pagination">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || page <= 1}
        onClick={showPrevious}
      >
        <ChevronLeftIcon className="size-icon-sm" />
        <span className="pagination-label">이전</span>
      </Button>
      {visiblePages(page, pageCount).map((number) =>
        number === page ? (
          <span key={number} aria-current="page" className="pagination-page num">
            {number}
          </span>
        ) : (
          <button
            key={number}
            type="button"
            className="pagination-page num"
            value={number}
            disabled={disabled}
            onClick={showClickedPage}
          >
            {number}
          </button>
        )
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || page >= pageCount}
        onClick={showNext}
      >
        <span className="pagination-label">다음</span>
        <ChevronRightIcon className="size-icon-sm" />
      </Button>
    </nav>
  )
}

function visiblePages(page: number, pageCount: number): number[] {
  const count = Math.min(VISIBLE_PAGES, pageCount)
  const centeredFirst = Math.max(page - Math.floor(VISIBLE_PAGES / 2), 1)
  const first = Math.min(centeredFirst, pageCount - count + 1)

  return Array.from({ length: count }, (_, index) => first + index)
}
