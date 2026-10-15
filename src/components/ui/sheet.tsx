import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetTitle = DialogPrimitive.Title
const SheetDescription = DialogPrimitive.Description

type KeyboardLayout = { bottom: number; maxHeight: number }

/**
 * iOS Safari/PWA keeps fixed elements attached to the layout viewport while the
 * software keyboard shrinks the visual viewport. Only adjust the sheet when a
 * text field is focused and the visible viewport has actually shrunk.
 */
function useKeyboardLayout() {
  const [layout, setLayout] = React.useState<KeyboardLayout | null>(null)

  React.useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const initialHeight = Math.max(window.innerHeight, viewport.height)
    let frame = 0
    const measure = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const active = document.activeElement
        const isTextInput = active instanceof HTMLElement &&
          (active.matches("textarea, [contenteditable='true']") ||
            active.matches("input:not([type='checkbox']):not([type='radio']):not([type='button']):not([type='date'])"))
        const visibleHeight = viewport.height
        const bottomOffset = Math.max(0, window.innerHeight - viewport.offsetTop - visibleHeight)
        const isKeyboardOpen = isTextInput && (bottomOffset > 120 || initialHeight - visibleHeight > 120)

        if (!isKeyboardOpen) {
          setLayout(previous => previous === null ? previous : null)
          return
        }

        const next: KeyboardLayout = {
          bottom: Math.max(0, Math.round(bottomOffset)),
          maxHeight: Math.max(170, Math.floor(visibleHeight - 12))
        }
        setLayout(previous =>
          previous?.bottom === next.bottom && previous?.maxHeight === next.maxHeight ? previous : next
        )
      })
    }

    viewport.addEventListener("resize", measure)
    viewport.addEventListener("scroll", measure)
    window.addEventListener("resize", measure)
    document.addEventListener("focusin", measure)
    document.addEventListener("focusout", measure)
    measure()

    return () => {
      window.cancelAnimationFrame(frame)
      viewport.removeEventListener("resize", measure)
      viewport.removeEventListener("scroll", measure)
      window.removeEventListener("resize", measure)
      document.removeEventListener("focusin", measure)
      document.removeEventListener("focusout", measure)
    }
  }, [])

  return layout
}

function SheetContent({
  className,
  children,
  onOpenAutoFocus,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const closeTriggerRef = React.useRef<HTMLButtonElement>(null)
  const dragStartRef = React.useRef<{ pointerId: number; x: number; y: number; startedAt: number } | null>(null)
  const [dragOffset, setDragOffset] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const keyboard = useKeyboardLayout()

  const handleGripPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return
    dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startedAt: performance.now() }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const handleGripPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const deltaY = Math.max(0, event.clientY - start.y)
    if (Math.abs(event.clientX - start.x) > deltaY + 12) {
      dragStartRef.current = null
      setDragging(false)
      setDragOffset(0)
      return
    }
    setDragOffset(deltaY)
  }

  const finishGripDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const deltaY = Math.max(0, event.clientY - start.y)
    const elapsed = Math.max(1, performance.now() - start.startedAt)
    const shouldClose = deltaY >= 88 || (deltaY >= 36 && deltaY / elapsed >= 0.65)
    dragStartRef.current = null
    setDragging(false)
    if (shouldClose) closeTriggerRef.current?.click()
    else setDragOffset(0)
  }

  const cancelGripDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current?.pointerId !== event.pointerId) return
    dragStartRef.current = null
    setDragging(false)
    setDragOffset(0)
  }

  React.useEffect(() => {
    if (!keyboard) return
    const scrollArea = contentRef.current?.querySelector<HTMLElement>(".sheet-scroll")
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || !scrollArea?.contains(active)) return

    const frame = window.requestAnimationFrame(() => {
      const field = active.getBoundingClientRect()
      const visibleArea = scrollArea.getBoundingClientRect()
      if (field.bottom > visibleArea.bottom - 8) {
        scrollArea.scrollTop += field.bottom - visibleArea.bottom + 12
      } else if (field.top < visibleArea.top + 8) {
        scrollArea.scrollTop -= visibleArea.top - field.top + 12
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [keyboard])

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="sheet-overlay fixed inset-0 z-50 bg-overlay/45 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        ref={contentRef}
        tabIndex={-1}
        onOpenAutoFocus={event => {
          onOpenAutoFocus?.(event)
          if (!event.defaultPrevented) {
            // Do not open iPhone's keyboard as a side effect of opening the sheet.
            event.preventDefault()
            contentRef.current?.focus({ preventScroll: true })
          }
        }}
        data-keyboard-open={keyboard ? "true" : "false"}
        style={{
          ...style,
          ...(keyboard ? { bottom: keyboard.bottom, maxHeight: keyboard.maxHeight } : {}),
          translate: `0 ${dragOffset}px`,
          transition: dragging ? "none" : "translate 180ms ease-out"
        }}
        className={cn(
          "sheet-content sheet-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[min(90dvh,780px)] w-full max-w-[540px] flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl focus:outline-none",
          className
        )}
        {...props}
      >
        <div aria-hidden="true"
          onPointerDown={handleGripPointerDown}
          onPointerMove={handleGripPointerMove}
          onPointerUp={finishGripDrag}
          onPointerCancel={cancelGripDrag}
          className="mx-auto mt-3 flex h-6 w-12 shrink-0 cursor-grab touch-none items-center justify-center rounded-full active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>
        {children}
        <DialogPrimitive.Close ref={closeTriggerRef}
          className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-3 focus:z-10 focus:min-h-11 focus:rounded-md focus:bg-card focus:px-3 focus:text-sm focus:font-semibold focus:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          閉じる
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("sheet-header shrink-0 px-6 pb-4 pt-6", className)} {...props} />
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("sheet-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-4", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("sheet-footer flex shrink-0 gap-3 border-t border-border px-6 pt-4", className)} {...props} />
}

export { Sheet, SheetTrigger, SheetClose, SheetTitle, SheetDescription, SheetContent, SheetHeader, SheetBody, SheetFooter }
