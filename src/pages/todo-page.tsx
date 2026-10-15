import { useState } from "react"
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from "motion/react"
import { format, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { ChevronDown, ChevronRight, Clock3, Sparkles } from "lucide-react"
import { type Task } from "@/app/mock-data"
import { useTodos } from "@/features/todos/todo-store"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CategoryBadge, categoryRing, TodoCategoryTile } from "@/components/category-ui"
import { OwnerAvatar } from "@/components/owner-ui"
import { useWorkspaceMembership } from "@/features/workspace/workspace-membership"
import { cn } from "@/lib/utils"
import { preloadTodoEditor } from "@/components/editor-loaders"

export function TodoPage() {
  const [filter, setFilter] = useState("すべて")
  const { todos: tasks, categories, toggleTodo, openEdit, openCreate } = useTodos()
  const { isPaired } = useWorkspaceMembership()
  const [showCompleted, setShowCompleted] = useState(false)
  const reduceMotion = useReducedMotion()
  const filters = ["すべて", ...categories.map(category => category.name)]
  const unfinishedCounts = tasks.reduce<Record<string, number>>((counts, task) => {
    if (!task.done) {
      counts["すべて"] += 1
      counts[task.category] = (counts[task.category] ?? 0) + 1
    }
    return counts
  }, { "すべて": 0 })
  const currentFilter = filters.includes(filter) ? filter : "すべて"
  const visible = tasks.filter(task => currentFilter === "すべて" || task.category === currentFilter)
  const active = visible.filter((task) => !task.done)
  const completed = visible.filter((task) => task.done)
  const toggle = (task: Task) => toggleTodo(task.id)

  return (
    <div className="space-y-6" data-testid="todo-page">

      <LayoutGroup id="todo-filters">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="TODOの絞り込み">
          {filters.map(item => (
            <TodoCategoryTile key={item} name={item} count={unfinishedCounts[item]} selected={currentFilter === item}
              all={item === "すべて"} categories={categories} onSelect={() => setFilter(item)}
              countId={`todo-filter-count-${item}`} countTestId={`todo-filter-count-${item}`}
              indicator={currentFilter === item && (
                <m.span layoutId="filter-indicator" aria-hidden="true"
                  className={cn("pointer-events-none absolute inset-0 rounded-md",
                    item === "すべて" ? "bg-primary" : cn("ring-2 ring-inset", categoryRing(item, categories)))}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 38 }} />
              )} />
          ))}
        </div>
      </LayoutGroup>

      <section aria-label="未完了のTODO">
        <LayoutGroup id="todo-items">
          <div className="noca-card overflow-hidden rounded-2xl border border-border bg-card">
            <AnimatePresence initial={false} mode="popLayout">
          {active.length === 0 ? (
            <m.div key="empty" layout initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.12 }} className="flex flex-col items-center gap-2 px-4 py-11 text-center">
              <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Sparkles className="size-5" /></div>
              <p className="text-sm font-semibold">{tasks.length === 0 ? "タスクはありません" : visible.length === 0 ? "このカテゴリのタスクはありません" : "すべて終わりました"}</p>
              <Button type="button" variant="secondary" onClick={openCreate} onPointerEnter={preloadTodoEditor} onPointerDown={preloadTodoEditor} onFocus={preloadTodoEditor} className="mt-3 text-[13px]">＋ タスクを追加</Button>
            </m.div>
          ) : active.map((task, index) => (
            <m.div key={task.id} layout data-todo-row={task.id}
              initial={reduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, height: 0 }}
              transition={reduceMotion ? { duration: 0 } : { opacity: { duration: 0.12 }, height: { duration: 0.18, ease: "easeOut" }, layout: { type: "spring", stiffness: 520, damping: 44 } }}
              className="overflow-hidden">
            <div className={cn("flex min-h-[68px] items-center gap-2.5 px-3.5 py-3", index > 0 && "border-t border-border/70")}>
              <Checkbox checked={false} label={task.title + "を完了"} onCheckedChange={() => toggle(task)} />
              <Button type="button" variant="ghost" onClick={() => openEdit(task.id)} onPointerEnter={preloadTodoEditor} onPointerDown={preloadTodoEditor} onFocus={preloadTodoEditor} aria-label={task.title + "を編集"} className="h-auto min-w-0 flex-1 self-stretch flex-col items-start justify-center whitespace-normal rounded-none px-0 py-0 text-left hover:bg-transparent">
                <p className="break-words text-[14px] font-semibold leading-snug">{task.title}</p>
                {(currentFilter === "すべて" || task.dueDate) && (
                  <div className="mt-0 flex min-h-5 flex-wrap items-center gap-2">
                    {currentFilter === "すべて" && <CategoryBadge category={task.category} categories={categories} className="leading-none" />}
                    {task.dueDate && <span className="inline-flex h-5 items-center gap-1 text-[11px] leading-none text-muted-foreground"><Clock3 className="size-3" />{format(parseISO(task.dueDate), "M/d (E)", { locale: ja })}</span>}
                  </div>
                )}
              </Button>
              {isPaired && <OwnerAvatar owner={task.by} size="md" />}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </div>
            </m.div>
          ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </section>

      {completed.length > 0 && (
        <section className="pb-3">
          <Button type="button" variant="ghost" onClick={() => setShowCompleted(v => !v)} aria-expanded={showCompleted} aria-controls="completed-tasks"
            className="mb-2 min-h-11 w-full justify-between px-0 text-left hover:bg-transparent">
            <span className="text-sm font-semibold text-muted-foreground">完了したこと <span className="ml-1 text-xs">({completed.length})</span></span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showCompleted && "rotate-180")} />
          </Button>
          <AnimatePresence initial={false}>
          {showCompleted && <m.div id="completed-tasks" initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
            className="overflow-hidden rounded-xl border border-border/75 bg-card/60">
            <AnimatePresence initial={false} mode="popLayout">
            {completed.map((task) => (
              <m.div key={task.id} layout initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.15 }} className="overflow-hidden">
              <div className="flex items-center gap-2 px-3.5 py-3">
                <Checkbox checked label={task.title + "の完了を解除"} onCheckedChange={() => toggle(task)} />
                <Button type="button" variant="ghost" onClick={() => openEdit(task.id)} onPointerEnter={preloadTodoEditor} onPointerDown={preloadTodoEditor} onFocus={preloadTodoEditor} aria-label={task.title + "を編集"}
                  className="h-auto min-h-11 min-w-0 flex-1 justify-start whitespace-normal break-words rounded-none px-0 py-0 text-left text-[13px] text-muted-foreground line-through hover:bg-transparent">{task.title}</Button>
              </div>
              </m.div>
            ))}
            </AnimatePresence>
          </m.div>}
          </AnimatePresence>
        </section>
      )}
    </div>
  )
}
