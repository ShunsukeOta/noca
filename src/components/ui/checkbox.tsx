import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CheckboxProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  className?: string
}

function Checkbox({ checked, onCheckedChange, label, className }: CheckboxProps) {
  return (
    <Button
      data-slot="checkbox"
      type="button"
      variant="ghost"
      size="icon"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn("tap-target shrink-0 rounded-full", checked ? "text-success" : "text-muted-foreground", className)}
    >
      {checked ? (
        <span aria-hidden="true" className="flex size-[23px] items-center justify-center rounded-full bg-success text-success-foreground">
          <Check className="size-3.5" />
        </span>
      ) : (
        <span aria-hidden="true" className="size-[23px] rounded-full border-[1.7px] border-muted-foreground/45" />
      )}
    </Button>
  )
}

export { Checkbox }
