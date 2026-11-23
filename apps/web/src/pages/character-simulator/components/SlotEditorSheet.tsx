import { Drawer } from '@base-ui/react/drawer'

const POPUP =
  'box-border max-h-[80dvh] w-full overflow-y-auto border-t border-line-strong bg-canvas text-fg shadow-popover outline-none ' +
  '[transform:translateY(var(--drawer-swipe-movement-y,0px))] [transition:transform_var(--duration-state)_var(--ease-standard)] ' +
  'data-[starting-style]:[transform:translateY(100%)] data-[ending-style]:[transform:translateY(100%)]'

export function SlotEditorSheet({
  open,
  title,
  onOpenChange,
  children
}: {
  open: boolean
  title: string
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}): React.JSX.Element {
  function changeOpen(next: boolean): void {
    onOpenChange(next)
  }

  return (
    <Drawer.Root open={open} onOpenChange={changeOpen}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-popover bg-overlay" />
        <Drawer.Viewport className="fixed inset-0 z-popover flex items-end">
          <Drawer.Popup className={POPUP}>
            <Drawer.Title className="section-title">{title}</Drawer.Title>
            {children}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
