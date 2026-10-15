import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"

type UndoToastProps = {
  message: string
  onUndo: () => void
  onDismiss: () => void
}

function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
      transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
      className="pointer-events-auto flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-[13px] shadow-xl"
    >
      <span className="min-w-0 flex-1 font-medium">{message}</span>
      <Button type="button" variant="ghost" onClick={onUndo} className="h-11 shrink-0 px-2 font-bold text-primary">
        元に戻す
      </Button>
      <Button type="button" variant="ghost" size="icon" onClick={onDismiss} className="size-11 shrink-0 rounded-full text-muted-foreground" aria-label="通知を閉じる">
        <span aria-hidden="true" className="text-xl leading-none">×</span>
      </Button>
    </motion.div>
  )
}

export { UndoToast }
