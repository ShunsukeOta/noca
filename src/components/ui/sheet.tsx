import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
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
  const keyboard = useKeyboardLayout()

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
          ...(keyboard ? { bottom: keyboard.bottom, maxHeight: keyboard.maxHeight } : {})
        }}
        className={cn(
          "sheet-content sheet-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[min(90dvh,780px)] w-full max-w-[540px] flex-col overflow-hidden rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl focus:outline-none",
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />
        {children}
        <DialogPrimitive.Close className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "tap-target absolute right-3 top-4 rounded-full text-muted-foreground")} aria-label="閉じる">
          <X className="size-[18px]" />
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
