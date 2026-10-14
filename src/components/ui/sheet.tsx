import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetTitle = DialogPrimitive.Title
const SheetDescription = DialogPrimitive.Description

function SheetContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="sheet-overlay fixed inset-0 z-50 bg-[#101827]/45 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "sheet-content sheet-panel fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[min(90dvh,780px)] w-full max-w-[540px] flex-col overflow-hidden rounded-t-[28px] border border-border bg-card text-card-foreground shadow-2xl focus:outline-none",
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />
        {children}
        <DialogPrimitive.Close className="tap-target absolute right-3 top-4 flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary" aria-label="閉じる">
          <X className="size-[18px]" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-6 pb-4 pt-6", className)} {...props} />
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("sheet-scroll flex-1 overflow-y-auto px-6 pb-4", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex shrink-0 gap-3 border-t border-border px-6 pt-4", className)} {...props} />
}

export { Sheet, SheetTrigger, SheetClose, SheetTitle, SheetDescription, SheetContent, SheetHeader, SheetBody, SheetFooter }
