import type { CategoryTone, TaskCategory, TodoCategory } from "@/app/mock-data"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const BUILT_IN_CATEGORIES: TodoCategory[] = [
  { id: "default-other", name: "その他", tone: "neutral" },
  { id: "default-life", name: "暮らし", tone: "life" },
  { id: "default-outing", name: "おでかけ", tone: "outing" },
  { id: "default-couple", name: "ふたり", tone: "couple" }
]

const toneClasses: Record<CategoryTone, string> = {
  peach: "bg-category-outing text-category-outing-foreground",
  green: "bg-category-life text-category-life-foreground",
  lavender: "bg-category-couple text-category-couple-foreground",
  blue: "bg-category-blue text-category-blue-foreground",
  mint: "bg-category-mint text-category-mint-foreground",
  yellow: "bg-category-yellow text-category-yellow-foreground",
  rose: "bg-category-rose text-category-rose-foreground",
  neutral: "bg-secondary text-secondary-foreground",
  life: "bg-category-life text-category-life-foreground",
  outing: "bg-category-outing text-category-outing-foreground",
  couple: "bg-category-couple text-category-couple-foreground"
}
const ringClasses: Record<CategoryTone, string> = {
  peach: "ring-category-outing-foreground/75",
  green: "ring-category-life-foreground/75",
  lavender: "ring-category-couple-foreground/75",
  blue: "ring-category-blue-foreground/75",
  mint: "ring-category-mint-foreground/75",
  yellow: "ring-category-yellow-foreground/75",
  rose: "ring-category-rose-foreground/75",
  neutral: "ring-primary/75",
  life: "ring-category-life-foreground/75",
  outing: "ring-category-outing-foreground/75",
  couple: "ring-category-couple-foreground/75"
}

function toneFor(category: TaskCategory, categories: Pick<TodoCategory, "name" | "tone">[]) {
  return categories.find(item => item.name === category)?.tone ?? "neutral"
}

export function categoryTone(category: TaskCategory, categories: Pick<TodoCategory, "name" | "tone">[] = BUILT_IN_CATEGORIES) {
  return toneClasses[toneFor(category, categories)]
}

export function categoryRing(category: TaskCategory, categories: Pick<TodoCategory, "name" | "tone">[] = BUILT_IN_CATEGORIES) {
  return ringClasses[toneFor(category, categories)]
}

function CategoryBadge({ category, categories = BUILT_IN_CATEGORIES, className }: { category: TaskCategory; categories?: TodoCategory[]; className?: string }) {
  return (
    <span data-slot="category-badge" className={cn("inline-flex items-center rounded-sm px-2 py-1 text-[10px] font-semibold", categoryTone(category, categories), className)}>
      {category}
    </span>
  )
}

function CategorySelector({ value, onChange, categories = BUILT_IN_CATEGORIES, className, id, "aria-labelledby": labelledBy }: {
  value: TaskCategory
  onChange: (category: TaskCategory) => void
  categories?: TodoCategory[]
  className?: string
  id?: string
  "aria-labelledby"?: string
}) {
  return (
    <div data-slot="category-selector" id={id} role="group" aria-label={labelledBy ? undefined : "カテゴリ"} aria-labelledby={labelledBy} className={cn("flex flex-wrap gap-2", className)}>
      {categories.map(category => (
        <Button
          key={category.name}
          type="button"
          variant="outline"
          aria-pressed={value === category.name}
          onClick={() => onChange(category.name)}
          className={cn(
            "min-h-11 h-auto rounded-md px-4 py-2 text-[13px]",
            value === category.name ? cn("border-transparent", toneClasses[category.tone], "ring-2 ring-inset", ringClasses[category.tone]) : "border-border bg-card text-muted-foreground"
          )}
        >
          {category.name}
        </Button>
      ))}
    </div>
  )
}

export function TodoCategoryTile({ name, count, selected, categories, onSelect, all = false, showCount = true, indicator, countId, countTestId, className }: {
  name: string
  count?: number
  selected: boolean
  categories: TodoCategory[]
  onSelect: () => void
  all?: boolean
  showCount?: boolean
  indicator?: ReactNode
  countId?: string
  countTestId?: string
  className?: string
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onSelect}
      aria-label={name} aria-describedby={countId} aria-pressed={selected}
      className={cn(
        "relative flex h-[60px] min-w-[76px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-md border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        all
          ? (selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")
          : cn("border-transparent", categoryTone(name, categories)),
        className
      )}>
      {indicator ?? (selected && (
        <span aria-hidden="true" className={cn(
          "pointer-events-none absolute inset-0 rounded-md",
          all ? "bg-primary" : cn("ring-2 ring-inset", categoryRing(name, categories))
        )} />
      ))}
      <span className="relative z-10 text-[11px] font-semibold leading-[1.3]">{name}</span>
      {showCount && <span id={countId} data-testid={countTestId}
        className="relative z-10 mt-1 text-[10px] font-medium leading-[1.3] opacity-80">{count ?? 0}件</span>}
    </Button>
  )
}

function TodoCategorySelector({ value, onChange, categories, className, id, "aria-label": ariaLabel, "aria-labelledby": labelledBy }: {
  value: TaskCategory
  onChange: (category: TaskCategory) => void
  categories: TodoCategory[]
  className?: string
  id?: string
  "aria-label"?: string
  "aria-labelledby"?: string
}) {
  return (
    <div data-slot="todo-category-selector" id={id} role="group" aria-label={labelledBy ? undefined : (ariaLabel ?? "カテゴリ")} aria-labelledby={labelledBy}
      className={cn("no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 pb-1", className)}>
      {categories.map(category => (
        <TodoCategoryTile key={category.id} name={category.name} showCount={false}
          selected={value === category.name} categories={categories} onSelect={() => onChange(category.name)} />
      ))}
    </div>
  )
}

export { CategoryBadge, CategorySelector, TodoCategorySelector }
