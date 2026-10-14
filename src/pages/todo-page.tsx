import { useState } from "react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"
import { format, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { Check, ChevronDown, ChevronRight, Clock3, ListChecks, Sparkles } from "lucide-react"
import { type Task, type TaskCategory } from "@/app/mock-data"
import { useTodos } from "@/features/todos/todo-store"
import { cn } from "@/lib/utils"

type Filter = "すべて" | TaskCategory
const filters: Filter[] = ["すべて", "おでかけ", "暮らし", "ふたり", "その他"]
const categoryColor: Record<TaskCategory, string> = {
  "暮らし": "bg-[#e7f2e9] text-[#52785d] dark:bg-[#294535] dark:text-[#add6b3]",
  "おでかけ": "bg-[#f6e9e1] text-[#956e5b] dark:bg-[#523e35] dark:text-[#f0c5ac]",
  "ふたり": "bg-[#ece9f7] text-[#756b9c] dark:bg-[#3b3655] dark:text-[#d6cafa]",
  "その他": "bg-secondary text-secondary-foreground"
}
const categorySelectedRing: Record<TaskCategory, string> = {
  "暮らし": "ring-[#52785d]/75 dark:ring-[#add6b3]/75",
  "おでかけ": "ring-[#956e5b]/75 dark:ring-[#f0c5ac]/75",
  "ふたり": "ring-[#756b9c]/75 dark:ring-[#d6cafa]/75",
  "その他": "ring-primary/75"
}

export function TodoPage() {
  const [filter, setFilter] = useState<Filter>("すべて")
  const { todos: tasks, toggleTodo, openEdit, openCreate } = useTodos()
  const [showCompleted, setShowCompleted] = useState(false)
  const reduceMotion = useReducedMotion()
  const unfinishedCounts = tasks.reduce<Record<Filter, number>>((counts, task) => {
    if (!task.done) {
      counts["すべて"] += 1
      counts[task.category] += 1
    }
    return counts
  }, { "すべて": 0, "おでかけ": 0, "暮らし": 0, "ふたり": 0, "その他": 0 })
  const visible = tasks.filter(task => filter === "すべて" || task.category === filter)
  const active = visible.filter((task) => !task.done)
  const completed = visible.filter((task) => task.done)
  const toggle = (task: Task) => toggleTodo(task.id)

  return (
    <div className="space-y-6" data-testid="todo-page">

      <section className="noca-shadow relative overflow-hidden rounded-[23px] bg-primary px-5 py-5 text-primary-foreground">
        <div className="pointer-events-none absolute -right-7 -top-12 size-40 rounded-full border-[27px] border-white/8" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-primary-foreground/70">残りのタスク</p>
            <div className="mt-1 flex items-baseline gap-2"><span className="relative inline-flex h-9 min-w-5 items-center overflow-hidden text-[34px] font-bold leading-none">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={unfinishedCounts["すべて"]}
                  initial={reduceMotion ? false : { opacity: 0, y: 9 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -9 }}
                  transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}>
                  {unfinishedCounts["すべて"]}
                </motion.span>
              </AnimatePresence>
            </span><span className="text-sm text-primary-foreground/70">件</span></div>
          </div>
          <div className="flex size-[62px] items-center justify-center rounded-[20px] bg-white/14"><ListChecks className="size-7" strokeWidth={1.75} /></div>
        </div>
      </section>

      <LayoutGroup id="todo-filters">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="TODOの絞り込み">
          {filters.map((item, index) => (
            <button key={item} type="button" onClick={() => setFilter(item)}
              aria-label={item} aria-describedby={`todo-filter-count-${index}`} aria-pressed={filter === item}
              className={cn(
                "relative flex h-[60px] min-w-[76px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-[14px] border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                item === "すべて"
                  ? (filter === item ? "border-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")
                  : cn("border-transparent", categoryColor[item])
              )}>
              {filter === item && (
                <motion.span layoutId="filter-indicator" aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-[13px]",
                    item === "すべて" ? "bg-primary" : cn("ring-2 ring-inset", categorySelectedRing[item])
                  )}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 38 }} />
              )}
              <span className="relative z-10 text-[11px] font-semibold leading-[1.3]">{item}</span>
              <span id={`todo-filter-count-${index}`} data-testid={`todo-filter-count-${item}`}
                className="relative z-10 mt-1 text-[10px] font-medium leading-[1.3] opacity-80">
                {unfinishedCounts[item]}件
              </span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      <section aria-label="未完了のTODO">
        <LayoutGroup id="todo-items">
          <div className="noca-card overflow-hidden rounded-[20px] border border-border bg-card">
            <AnimatePresence initial={false} mode="popLayout">
          {active.length === 0 ? (
            <motion.div key="empty" layout initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} className="flex flex-col items-center gap-2 px-4 py-11 text-center">
              <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Sparkles className="size-5" /></div>
              <p className="text-sm font-semibold">{tasks.length === 0 ? "タスクはありません" : visible.length === 0 ? "このカテゴリのタスクはありません" : "すべて終わりました"}</p>
              <button type="button" onClick={openCreate} className="mt-3 min-h-11 rounded-xl bg-secondary px-4 text-[13px] font-bold text-primary">＋ タスクを追加</button>
            </motion.div>
          ) : active.map((task, index) => (
            <motion.div key={task.id} layout data-todo-row={task.id}
              initial={reduceMotion ? false : { opacity: 0, height: 0, x: 12 }}
              animate={{ opacity: 1, height: "auto", x: 0 }}
              exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, height: 0, x: -14 }}
              transition={reduceMotion ? { duration: 0 } : { opacity: { duration: 0.18 }, height: { duration: 0.23, ease: "easeOut" }, x: { duration: 0.18 }, layout: { type: "spring", stiffness: 460, damping: 40 } }}
              className="overflow-hidden">
            <div className={cn("flex min-h-[85px] items-center gap-2.5 px-3.5 py-3", index > 0 && "border-t border-border/70")}>
              <button type="button" aria-label={task.title + "を完了"} onClick={() => toggle(task)}
                className="tap-target flex shrink-0 items-center justify-center rounded-full text-muted-foreground">
                <span className="size-[23px] rounded-full border-[1.7px] border-[#b5c1d0]" />
              </button>
              <button type="button" onClick={() => openEdit(task.id)} aria-label={task.title + "を編集"} className="min-w-0 flex-1 text-left">
                <p className="break-words text-[14px] font-semibold leading-snug">{task.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold", categoryColor[task.category])}>{task.category}</span>
                  {task.dueDate && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{format(parseISO(task.dueDate), "M/d (E)", { locale: ja })}</span>}
                </div>
              </button>
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", task.by === "A" ? "bg-[#d7e7ea] text-[#3e6470]" : "bg-[#f3dfda] text-[#90625a]")} aria-label={"作成者 " + task.by}>{task.by}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </div>
            </motion.div>
          ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </section>

      {completed.length > 0 && (
        <section className="pb-3">
          <button type="button" onClick={() => setShowCompleted(v => !v)} aria-expanded={showCompleted} aria-controls="completed-tasks"
            className="mb-2 flex min-h-11 w-full items-center justify-between text-left">
            <span className="text-sm font-semibold text-muted-foreground">完了したこと <span className="ml-1 text-xs">({completed.length})</span></span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showCompleted && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
          {showCompleted && <motion.div id="completed-tasks" initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            className="overflow-hidden rounded-[18px] border border-border/75 bg-card/60">
            <AnimatePresence initial={false} mode="popLayout">
            {completed.map((task) => (
              <motion.div key={task.id} layout initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }} className="overflow-hidden">
              <div className="flex items-center gap-2 px-3.5 py-2.5">
                <button type="button" aria-label={task.title + "の完了を解除"} onClick={() => toggle(task)}
                  className="tap-target flex shrink-0 items-center justify-center rounded-full text-success">
                  <span className="flex size-[23px] items-center justify-center rounded-full bg-success text-white"><Check className="size-3.5" /></span>
                </button>
                <button type="button" onClick={() => openEdit(task.id)} aria-label={task.title + "を編集"}
                  className="min-h-11 min-w-0 flex-1 break-words text-left text-[13px] text-muted-foreground line-through">{task.title}</button>
              </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </motion.div>}
          </AnimatePresence>
        </section>
      )}
    </div>
  )
}
