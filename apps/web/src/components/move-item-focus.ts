import type { KeyboardEvent } from 'react'

const ITEM_STEPS: Readonly<Record<string, number>> = { ArrowUp: -1, ArrowDown: 1 }

export function moveItemFocus(event: KeyboardEvent<HTMLElement>): void {
  const step = ITEM_STEPS[event.key]
  const items = [...event.currentTarget.querySelectorAll('a')]
  const index = items.findIndex((item) => item === event.target)
  if (step === undefined || index < 0) {
    return
  }
  event.preventDefault()
  items[(index + step + items.length) % items.length].focus()
}
