import type { TaskCategory } from "@/app/mock-data"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const categoryTone: Record<TaskCategory, string> = {
  "暮らし": "bg-category-life text-category-life-foreground",
  "おでかけ": "bg-category-outing text-category-outing-foreground",
  "ふたり": "bg-category-couple text-category-couple-foreground",
  "その他": "bg-secondary text-secondary-foreground"
}

export const categoryRing: Record<TaskCategory, string> = {
  "暮らし": "ring-category-life-foreground/75",
  "おでかけ": "ring-category-outing-foreground/75",
  "ふたり": "ring-category-couple-foreground/75",
  "その他": "ring-primary/75"
}

const categories: TaskCategory[] = ["その他", "暮らし", "おでかけ", "ふたり"]

function CategoryBadge({ category, className }: { category: TaskCategory; className?: string }) {
  return (
    <span data-slot="category-badge" className={cn("inline-flex items-center rounded-sm px-2 py-1 text-[10px] font-semibold", categoryTone[category], className)}>
      {category}
    </span>
  )
}

function CategorySelector({ value, onChange, className, id, "aria-labelledby": labelledBy }: {
  value: TaskCategory
  onChange: (category: TaskCategory) => void
  className?: string
  id?: string
  "aria-labelledby"?: string
}) {
  return (
    <div data-slot="category-selector" id={id} role="group" aria-label={labelledBy ? undefined : "カテゴリ"} aria-labelledby={labelledBy} className={cn("flex flex-wrap gap-2", className)}>
      {categories.map(category => (
        <Button
          key={category}
          type="button"
          variant="outline"
          aria-pressed={value === category}
          onClick={() => onChange(category)}
          className={cn(
            "min-h-11 h-auto rounded-md px-4 py-2 text-[13px]",
            value === category ? cn("border-transparent", categoryTone[category], "ring-2 ring-inset", categoryRing[category]) : "border-border bg-card text-muted-foreground"
          )}
        >
          {category}
        </Button>
      ))}
    </div>
  )
}

export { CategoryBadge, CategorySelector }
